// src/core/objects/GameObject.ts
import { Memory } from "../memory/Memory";
import { Address } from "../../types";
import { decodeZString } from "../../parsers/ZString";
import { Logger } from "../../utils/log";

/**
 * Represents an object in the Z-machine world with properties, attributes,
 * and hierarchical relationships (parent, child, sibling)
 */
export class GameObject {
  private memory: Memory;
  private logger: Logger;
  private version: number;
  private objTable: number;

  /** Object number in the object table */
  readonly objnum: number;

  /** Address of the object in memory */
  private objaddr: Address;

  /**
   * Creates a new GameObject instance
   * @param memory Memory access
   * @param logger Logging service
   * @param version Z-machine version
   * @param objTable Address of the object table
   * @param objnum Object number
   */
  constructor(memory: Memory, logger: Logger, version: number, objTable: number, objnum: number) {
    this.memory = memory;
    this.logger = logger;
    this.version = version;
    this.objTable = objTable;
    this.objnum = objnum;

    // Calculate the object's address based on version-specific object table structure
    if (this.version <= 3) {
      this.objaddr = this.objTable + 31 * 2 + (objnum - 1) * 9;
    } else {
      this.objaddr = this.objTable + 63 * 2 + (objnum - 1) * 14;
    }
  }

  /**
   * Get the object's name
   */
  get name(): string {
    return decodeZString(
      this.memory,
      this.memory.getZString(this.propertyTableAddr + 1),
      false
    );
  }

  /**
   * Get the object's parent object
   */
  get parent(): GameObject | null {
    const parentObjNum = this.version <= 3
      ? this.memory.getByte(this.objaddr + 4)
      : this.memory.getWord(this.objaddr + 6);

    // Return null for object 0, which means "no object"
    return parentObjNum === 0 ? null : this.getObject(parentObjNum);
  }

  /**
   * Set the object's parent
   */
  set parent(po: GameObject | null) {
    const pobjnum = po === null ? 0 : po.objnum;
    if (this.version <= 3) {
      this.memory.setByte(this.objaddr + 4, pobjnum);
    } else {
      this.memory.setWord(this.objaddr + 6, pobjnum);
    }
  }

  /**
   * Get the object's first child
   */
  get child(): GameObject | null {
    const childObjNum = this.version <= 3
      ? this.memory.getByte(this.objaddr + 6)
      : this.memory.getWord(this.objaddr + 10);

    return childObjNum === 0 ? null : this.getObject(childObjNum);
  }

  /**
   * Set the object's first child
   */
  set child(co: GameObject | null) {
    const cobjnum = co === null ? 0 : co.objnum;
    if (this.version <= 3) {
      this.memory.setByte(this.objaddr + 6, cobjnum);
    } else {
      this.memory.setWord(this.objaddr + 10, cobjnum);
    }
  }

  /**
   * Get the object's sibling
   */
  get sibling(): GameObject | null {
    const siblingObjNum = this.version <= 3
      ? this.memory.getByte(this.objaddr + 5)
      : this.memory.getWord(this.objaddr + 8);

    return siblingObjNum === 0 ? null : this.getObject(siblingObjNum);
  }

  /**
   * Set the object's sibling
   */
  set sibling(so: GameObject | null) {
    const sobjnum = so === null ? 0 : so.objnum;
    if (this.version <= 3) {
      this.memory.setByte(this.objaddr + 5, sobjnum);
    } else {
      this.memory.setWord(this.objaddr + 8, sobjnum);
    }
  }

  /**
   * Get the address of the object's property table
   */
  get propertyTableAddr(): Address {
    return this.memory.getWord(
      this.objaddr + (this.version <= 3 ? 7 : 12)
    );
  }

  /**
   * Check if the object has a specific attribute
   * @param attr Attribute number
   */
  hasAttribute(attr: number): boolean {
    this.validateAttributeNumber(attr);

    const byte_index = Math.floor(attr / 8);
    const value = this.memory.getByte(this.objaddr + byte_index);
    return (value & (0x80 >> (attr & 7))) !== 0;
  }

  /**
   * Set an attribute on the object
   * @param attr Attribute number
   */
  setAttribute(attr: number): void {
    this.validateAttributeNumber(attr);

    const byte_index = Math.floor(attr / 8);
    let value = this.memory.getByte(this.objaddr + byte_index);
    value |= 0x80 >> (attr & 7);
    this.memory.setByte(this.objaddr + byte_index, value);
  }

  /**
   * Clear an attribute from the object
   * @param attr Attribute number
   */
  clearAttribute(attr: number): void {
    this.validateAttributeNumber(attr);

    const byte_index = Math.floor(attr / 8);
    let value = this.memory.getByte(this.objaddr + byte_index);
    value &= ~(0x80 >> (attr & 7));
    this.memory.setByte(this.objaddr + byte_index, value);
  }

  /**
   * Remove the object from its parent's child list
   */
  unlink(): void {
    // Get our parent object, since we clear it below
    const parent = this.parent;
    if (!parent) {
      // No parent, nothing to be done
      return;
    }

    const sibling = this.sibling;

    this.parent = null;
    this.sibling = null;

    // If we're the first child, it's easy
    if (parent.child?.objnum === this.objnum) {
      parent.child = sibling;
      return;
    }

    // Otherwise loop through children looking for the child before us
    for (let c = parent.child; c !== null; c = c.sibling) {
      if (c.sibling && c.sibling.objnum === this.objnum) {
        // Found the previous node. Skip ourselves and return.
        c.sibling = sibling;
        return;
      }
    }

    // If we didn't find the previous child, something is definitely wrong
    throw new Error("Sibling list is in a bad state, couldn't find previous node");
  }

  /**
   * Get the address of the next property entry
   * @param propAddr Address of the current property entry
   */
  private _nextPropEntry(propAddr: Address): Address {
    return propAddr + this._propEntrySize(propAddr);
  }

  /**
   * Get the size of a property entry
   * @param propAddr Address of the property entry
   */
  private _propEntrySize(propAddr: Address): number {
    return GameObject._propDataLen(this.memory, this.version, propAddr) + 1;
  }

  /**
   * Get the property number from a property entry
   * @param entryAddr Address of the property entry
   */
  private _propEntryNum(entryAddr: Address): number {
    const mask = this.version <= 3 ? 0x1f : 0x3f;
    const sizeByte = this.memory.getByte(entryAddr);
    return sizeByte & mask;
  }

  /**
   * Calculate the length of property data
   * @param memory Memory access
   * @param version Z-machine version
   * @param propAddr Address of the property
   */
  static _propDataLen(memory: Memory, version: number, propAddr: Address): number {
    let size = memory.getByte(propAddr);

    if (version <= 3) {
      size >>= 5;
    } else {
      if (!(size & 0x80)) {
        size >>= 6;
      } else {
        size = memory.getByte(propAddr + 1);
        size &= 0x3f;
        if (size === 0) {
          size = 64; /* demanded by Spec 1.0 */
        }
      }
    }

    return size + 1;
  }

  /**
   * Get the address of the property data
   * @param propAddr Address of the property entry
   */
  private _propDataPtr(propAddr: Address): Address {
    if (this.version <= 3) {
      return propAddr + 1;
    } else {
      const size = this.memory.getByte(propAddr);
      if (!(size & 0x80)) {
        return propAddr + 1;
      } else {
        return propAddr + 2;
      }
    }
  }

  /**
   * Get the address of the first property entry
   */
  private _firstPropEntry(): Address {
    const addr = this.propertyTableAddr;
    // Skip the name
    const nameLen = this.memory.getByte(addr);
    return addr + 1 + 2 * nameLen;
  }

  /**
   * Find a property entry by property number
   * @param prop Property number
   */
  private _getPropEntry(prop: number): Address {
    let entry = this._firstPropEntry();
    let propNum;
    do {
      propNum = this._propEntryNum(entry);
      if (propNum === prop) {
        return entry;
      }
      entry = this._nextPropEntry(entry);
    } while (propNum > prop);
    return 0;
  }

  /**
   * Get a property value
   * @param prop Property number
   */
  getProperty(prop: number): number {
    const propAddr = this._getPropEntry(prop);
    if (propAddr === 0) {
      throw new Error(`Property ${prop} not found`);
    }

    const propLen = GameObject._propDataLen(this.memory, this.version, propAddr);
    const dataPtr = this._propDataPtr(propAddr);

    switch (propLen) {
      case 1:
        return this.memory.getByte(dataPtr);
      case 2:
        return this.memory.getWord(dataPtr);
      default:
        throw new Error(`Invalid property length in getProperty: ${propLen}`);
    }
  }

  /**
   * Set a property value
   * @param prop Property number
   * @param value Value to set
   */
  putProperty(prop: number, value: number): void {
    const propAddr = this._getPropEntry(prop);
    if (propAddr === 0) {
      throw new Error(`Property ${prop} not found`);
    }

    const propLen = GameObject._propDataLen(this.memory, this.version, propAddr);
    const dataPtr = this._propDataPtr(propAddr);

    switch (propLen) {
      case 1:
        this.memory.setByte(dataPtr, value & 0xff);
        break;
      case 2:
        this.memory.setWord(dataPtr, value & 0xffff);
        break;
      default:
        throw new Error(`Invalid property length in putProperty: ${propLen}`);
    }
  }

  /**
   * Get the address of a property's data
   * @param prop Property number
   */
  getPropertyAddress(prop: number): Address {
    const propAddr = this._getPropEntry(prop);
    if (propAddr === 0) {
      return 0;
    }
    return this._propDataPtr(propAddr);
  }

  /**
   * Convert a data pointer to its property entry address
   * @param dataAddr Address of the property data
   */
  static entryFromDataPtr(dataAddr: Address): Address {
    return dataAddr - 1;
  }

  /**
   * Get the length of a property from its data address
   * @param memory Memory access
   * @param version Z-machine version
   * @param dataAddr Address of the property data
   */
  static getPropertyLength(memory: Memory, version: number, dataAddr: Address): number {
    if (dataAddr === 0) {
      return 0;
    }
    const entry = GameObject.entryFromDataPtr(dataAddr);
    return GameObject._propDataLen(memory, version, entry);
  }

  /**
   * Get the next property number after a specified property
   * @param prop Property number, or 0 to get the first property
   */
  getNextProperty(prop: number): number {
    let propAddr;
    if (prop === 0) {
      propAddr = this._firstPropEntry();
    } else {
      propAddr = this._getPropEntry(prop);
      if (propAddr === 0) {
        throw new Error(`Property ${prop} not found`);
      }
      propAddr = this._nextPropEntry(propAddr);
    }

    if (propAddr === 0) {
      return 0;
    }

    return this._propEntryNum(propAddr);
  }

  /**
   * Debug method to dump property data
   * @param entry Address of the property entry
   */
  dumpPropData(entry: Address): string {
    const propDataPtr = this._propDataPtr(entry);
    const propDataLen = GameObject._propDataLen(this.memory, this.version, entry);
    const data: Array<number> = [];

    for (let i = 0; i < propDataLen; i++) {
      data.push(this.memory.getByte(propDataPtr + i));
    }

    return data.map(val => this.hexString(val)).join(" ");
  }

  /**
   * Debug method to dump the object hierarchy to console
   * @param indent Indentation level
   */
  dump(indent = 0): void {
    const _indent = " . ".repeat(indent);

    this.logger.debug(`${_indent}[${this.objnum}] "${this.name}"`);
    this.logger.debug(`${_indent}  Properties:`);

    let entry = this._firstPropEntry();
    for (;;) {
      const propNum = this._propEntryNum(entry);
      if (propNum === 0) {
        break;
      }
      this.logger.debug(
        `${_indent}   ${this.hexString(entry)} [${propNum}] ${this.dumpPropData(entry)}`
      );
      entry = this._nextPropEntry(entry);
    }

    for (let c = this.child; c !== null; c = c.sibling) {
      c.dump(indent + 1);
    }
  }

  /**
   * Helper method to get an object by number
   * This will need to be provided by a factory or game state
   * @param objnum Object number
   */
  private getObject(objnum: number): GameObject | null {
    // This is a stub - the actual implementation would be provided
    // by the GameState class that creates GameObject instances
    throw new Error("getObject() must be implemented by a provider");
  }

  /**
   * Validate that an attribute number is in range for the current version
   * @param attr Attribute number to validate
   */
  private validateAttributeNumber(attr: number): void {
    const maxAttr = this.version <= 3 ? 32 : 48;
    if (attr >= maxAttr) {
      throw new Error(`Attribute number out of range: ${attr}`);
    }
  }

  /**
   * Convert a number to hexadecimal string
   * @param v Number to convert
   */
  private hexString(v: number): string {
    return v !== undefined ? v.toString(16) : "";
  }
}
