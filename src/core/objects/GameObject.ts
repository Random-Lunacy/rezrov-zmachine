import { Memory } from "../memory/Memory";
import { Address } from "../../types";
import { decodeZString } from "../../parsers/ZString";
import { Logger } from "../../utils/log";
import { MAX_ATTRIBUTES_V3, MAX_ATTRIBUTES_V4 } from "../../utils/constants";

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
   * @param logger Logger instance
   * @param version Z-machine version
   * @param objTable Address of the object table
   * @param objnum Object number
   */
  constructor(
    memory: Memory,
    logger: Logger,
    version: number,
    objTable: number,
    objnum: number
  ) {
    this.memory = memory;
    this.logger = logger;
    this.version = version;
    this.objTable = objTable;
    this.objnum = objnum;

    // Calculate the object's address based on version-specific object table structure
    if (this.version <= 3) {
      // 31 property defaults * 2 bytes + (objnum - 1) * object entry size
      this.objaddr = this.objTable + 31 * 2 + (objnum - 1) * 9;
    } else {
      // 63 property defaults * 2 bytes + (objnum - 1) * object entry size
      this.objaddr = this.objTable + 63 * 2 + (objnum - 1) * 14;
    }
  }

  /**
   * Get the object's name as a string
   * @returns The object's name
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
   * @returns The parent object or null if none
   */
  get parent(): GameObject | null {
    const parentObjNum =
      this.version <= 3
        ? this.memory.getByte(this.objaddr + 4)
        : this.memory.getWord(this.objaddr + 6);

    // Return null for object 0, which means "no object"
    return parentObjNum === 0 ? null : this.getObject(parentObjNum);
  }

  /**
   * Set the object's parent
   * @param po The parent object or null to remove parent
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
   * @returns The first child object or null if none
   */
  get child(): GameObject | null {
    const childObjNum =
      this.version <= 3
        ? this.memory.getByte(this.objaddr + 6)
        : this.memory.getWord(this.objaddr + 10);

    return childObjNum === 0 ? null : this.getObject(childObjNum);
  }

  /**
   * Set the object's first child
   * @param co The child object or null to remove child
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
   * @returns The sibling object or null if none
   */
  get sibling(): GameObject | null {
    const siblingObjNum =
      this.version <= 3
        ? this.memory.getByte(this.objaddr + 5)
        : this.memory.getWord(this.objaddr + 8);

    return siblingObjNum === 0 ? null : this.getObject(siblingObjNum);
  }

  /**
   * Set the object's sibling
   * @param so The sibling object or null to remove sibling
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
   * @returns The property table address
   */
  get propertyTableAddr(): Address {
    return this.memory.getWord(this.objaddr + (this.version <= 3 ? 7 : 12));
  }

  /**
   * Return the maximum number of attributes for this object based on version
   * @returns Maximum number of attributes
   */
  getMaxAttributes(): number {
    return this.version <= 3 ? MAX_ATTRIBUTES_V3 : MAX_ATTRIBUTES_V4;
  }

  /**
   * Check if the object has a specific attribute
   * @param attr Attribute number
   * @returns True if the attribute is set
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

    this.logger.debug(`Set attribute ${attr} on object ${this.objnum}`);
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

    this.logger.debug(`Cleared attribute ${attr} from object ${this.objnum}`);
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
    throw new Error(
      `Sibling list is in a bad state, couldn't find previous node for object ${this.objnum}`
    );
  }

  /**
   * Get the address of the next property entry
   * @param propAddr Address of the current property entry
   * @returns Address of the next property entry
   */
  private _nextPropEntry(propAddr: Address): Address {
    return propAddr + this._propEntrySize(propAddr);
  }

  /**
   * Get the size of a property entry
   * @param propAddr Address of the property entry
   * @returns Size of the property entry in bytes
   */
  private _propEntrySize(propAddr: Address): number {
    return GameObject._propDataLen(this.memory, this.version, propAddr) +
      (this.version <= 3 || !(this.memory.getByte(propAddr) & 0x80) ? 1 : 2);
  }

  /**
   * Get the property number from a property entry
   * @param entryAddr Address of the property entry
   * @returns The property number
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
   * @returns Length of the property data in bytes
   */
  static _propDataLen(
    memory: Memory,
    version: number,
    propAddr: Address
  ): number {
    let size = memory.getByte(propAddr);

    if (version <= 3) {
      // Top 3 bits encode size - 1
      size = (size >> 5) + 1;
    } else {
      if (!(size & 0x80)) {
        // Top 2 bits encode size - 1
        size = (size >> 6) + 1;
      } else {
        // Size byte is in the next byte
        size = memory.getByte(propAddr + 1) & 0x3f;
        // A size of 0 means 64 bytes
        if (size === 0) {
          size = 64;
        }
      }
    }

    return size;
  }

  /**
   * Get the address of the property data
   * @param propAddr Address of the property entry
   * @returns Address of the property data
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
   * @returns Address of the first property entry
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
   * @returns Address of the property entry or 0 if not found
   */
  private _getPropEntry(prop: number): Address {
    let entry = this._firstPropEntry();

    // Properties are stored in descending order of property number
    let propNum;
    do {
      propNum = this._propEntryNum(entry);

      if (propNum === prop) {
        return entry;
      }

      if (propNum < prop) {
        // We've gone past where the property should be
        break;
      }

      entry = this._nextPropEntry(entry);
    } while (propNum > 0);

    return 0; // Not found
  }

  /**
   * Get the default value for a property
   * @param prop Property number
   * @returns The default value for the property
   */
  private _getDefaultPropertyValue(prop: number): number {
    // Default properties are stored in a table at the beginning of the object table
    // Each default is 2 bytes
    if (prop <= 0) {
      throw new Error(`Invalid property number: ${prop}`);
    }

    const maxProps = this.version <= 3 ? 31 : 63;
    if (prop > maxProps) {
      throw new Error(`Property number ${prop} out of range (max ${maxProps})`);
    }

    return this.memory.getWord(this.objTable + (prop - 1) * 2);
  }

  /**
   * Get a property value
   * @param prop Property number
   * @returns The property value
   */
  getProperty(prop: number): number {
    const propAddr = this._getPropEntry(prop);

    if (propAddr === 0) {
      // Property not found, return default value
      return this._getDefaultPropertyValue(prop);
    }

    const dataPtr = this._propDataPtr(propAddr);
    const propLen = GameObject._propDataLen(this.memory, this.version, propAddr);

    switch (propLen) {
      case 1:
        return this.memory.getByte(dataPtr);
      case 2:
        return this.memory.getWord(dataPtr);
      default:
        // For longer properties, spec says to return the first 2 bytes as a word
        this.logger.warn(
          `Reading ${propLen}-byte property ${prop} as a word (address ${dataPtr})`
        );
        return this.memory.getWord(dataPtr);
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
      throw new Error(`Property ${prop} not found in object ${this.objnum}`);
    }

    const dataPtr = this._propDataPtr(propAddr);
    const propLen = GameObject._propDataLen(this.memory, this.version, propAddr);

    switch (propLen) {
      case 1:
        this.memory.setByte(dataPtr, value & 0xff);
        break;
      case 2:
        this.memory.setWord(dataPtr, value & 0xffff);
        break;
      default:
        // For longer properties, spec says to set the first 2 bytes as a word
        this.logger.warn(
          `Writing to ${propLen}-byte property ${prop} as a word (address ${dataPtr})`
        );
        this.memory.setWord(dataPtr, value & 0xffff);
    }
  }

  /**
   * Get the address of a property's data
   * @param prop Property number
   * @returns Address of the property data or 0 if not found
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
   * @returns Address of the property entry
   */
  static entryFromDataPtr(dataAddr: Address, memory: Memory, version: number): Address {
    // This is a bit tricky because the data could be 1 or 2 bytes after the entry
    // We look at the byte before - if version <= 3 or the high bit is clear, it's 1 byte before
    if (version <= 3 || !(memory.getByte(dataAddr - 1) & 0x80)) {
      return dataAddr - 1;
    } else {
      return dataAddr - 2;
    }
  }

  /**
   * Get the length of a property from its data address
   * @param memory Memory access
   * @param version Z-machine version
   * @param dataAddr Address of the property data
   * @returns Length of the property in bytes
   */
  static getPropertyLength(
    memory: Memory,
    version: number,
    dataAddr: Address
  ): number {
    if (dataAddr === 0) {
      return 0;
    }

    const entry = GameObject.entryFromDataPtr(dataAddr, memory, version);
    return GameObject._propDataLen(memory, version, entry);
  }

  /**
   * Get the next property number after a specified property
   * @param prop Property number, or 0 to get the first property
   * @returns The next property number or 0 if none
   */
  getNextProperty(prop: number): number {
    let propAddr;

    if (prop === 0) {
      // If prop is 0, get the first property
      propAddr = this._firstPropEntry();
    } else {
      // Otherwise, get the specified property and then the next one
      propAddr = this._getPropEntry(prop);

      if (propAddr === 0) {
        throw new Error(`Property ${prop} not found in object ${this.objnum}`);
      }

      propAddr = this._nextPropEntry(propAddr);
    }

    if (propAddr === 0) {
      return 0;
    }

    // Get the property number
    return this._propEntryNum(propAddr);
  }

  /**
   * Debug method to dump property data
   * @param entry Address of the property entry
   * @returns String representation of the property data
   */
  dumpPropData(entry: Address): string {
    const propDataPtr = this._propDataPtr(entry);
    const propDataLen = GameObject._propDataLen(this.memory, this.version, entry);
    const data: Array<number> = [];

    for (let i = 0; i < propDataLen; i++) {
      data.push(this.memory.getByte(propDataPtr + i));
    }

    return data.map((val) => this.hexString(val)).join(" ");
  }

  /**
   * Debug method to dump the object hierarchy to console
   * @param indent Indentation level
   */
  dump(indent = 0): void {
    const _indent = " . ".repeat(indent);

    this.logger.debug(`${_indent}[${this.objnum}] "${this.name}"`);
    this.logger.debug(`${_indent}  Attributes:`);

    // Dump attributes
    const maxAttrs = this.getMaxAttributes();
    const activeAttrs: number[] = [];

    for (let i = 0; i < maxAttrs; i++) {
      if (this.hasAttribute(i)) {
        activeAttrs.push(i);
      }
    }

    if (activeAttrs.length > 0) {
      this.logger.debug(`${_indent}    ${activeAttrs.join(", ")}`);
    } else {
      this.logger.debug(`${_indent}    None`);
    }

    // Dump properties
    this.logger.debug(`${_indent}  Properties:`);

    let entry = this._firstPropEntry();
    let propNum: number;

    do {
      propNum = this._propEntryNum(entry);

      if (propNum === 0) {
        break;
      }

      this.logger.debug(
        `${_indent}   ${this.hexString(entry)} [${propNum}] ${this.dumpPropData(
          entry
        )}`
      );

      entry = this._nextPropEntry(entry);
    } while (propNum > 0);

    // Recursively dump children
    for (let c = this.child; c !== null; c = c.sibling) {
      c.dump(indent + 1);
    }
  }

  /**
   * Helper method to get an object by number
   * This must be overridden by the object provider
   * @param objnum Object number
   */
  protected getObject(objnum: number): GameObject | null {
    // This should be overridden by the provider to return the actual object
    throw new Error("getObject() must be implemented by a provider");
  }

  /**
   * Validate that an attribute number is in range for the current version
   * @param attr Attribute number to validate
   */
  private validateAttributeNumber(attr: number): void {
    const maxAttr = this.version <= 3 ? MAX_ATTRIBUTES_V3 : MAX_ATTRIBUTES_V4;

    if (attr < 0 || attr >= maxAttr) {
      throw new Error(`Attribute number out of range: ${attr} (max ${maxAttr-1})`);
    }
  }

  /**
   * Convert a number to hexadecimal string
   * @param v Number to convert
   */
  private hexString(v: number): string {
    return v !== undefined ? "0x" + v.toString(16).padStart(4, "0") : "";
  }
}
