import { decodeZString } from '../../parsers/ZString';
import { Address } from '../../types';
import { Logger } from '../../utils/log';
import { Memory } from '../memory/Memory';

/**
 * Represents an object in the Z-machine world with properties, attributes,
 * and hierarchical relationships (parent, child, sibling)
 */
export class GameObject {
  // Static method for property data length calculation
  static _propDataLen(memory: Memory, version: number, propAddr: Address): number {
    const sizeByte = memory.getByte(propAddr);

    if (version <= 3) {
      // V1-3: size is in top 3 bits + 1
      return ((sizeByte >> 5) & 0x7) + 1;
    } else {
      // V4+: depends on bit 7
      if ((sizeByte & 0x80) === 0) {
        // Top bit clear: size in top 2 bits + 1
        return ((sizeByte >> 6) & 0x3) + 1;
      } else {
        // Top bit set: size in next byte
        const size = memory.getByte(propAddr + 1) & 0x3f;
        return size === 0 ? 64 : size;
      }
    }
  }

  static entryFromDataPtr(dataAddr: Address, memory: Memory, version: number): Address {
    if (version <= 3 || (memory.getByte(dataAddr - 1) & 0x80) === 0) {
      return dataAddr - 1;
    } else {
      // V4+ with size byte format
      return dataAddr - 2;
    }
  }

  static getPropertyLength(memory: Memory, version: number, dataAddr: Address): number {
    if (dataAddr === 0) {
      return 0;
    }

    const entry = GameObject.entryFromDataPtr(dataAddr, memory, version);
    return GameObject._propDataLen(memory, version, entry);
  }

  private readonly memory: Memory;
  private readonly logger: Logger;
  private readonly version: number;
  private readonly objTable: number;
  private readonly _objNum: number;
  private readonly objAddr: Address;

  constructor(memory: Memory, version: number, objTable: number, objNum: number, options?: { logger?: Logger }) {
    this.memory = memory;
    this.version = version;
    this.objTable = objTable;
    this._objNum = objNum;
    this.logger = options?.logger || new Logger('GameObject');

    // Calculate object address based on version-specific object entry size
    if (this.version <= 3) {
      // V1-3: 9-byte entries, 31 * 2 bytes for default properties
      this.objAddr = this.objTable + 31 * 2 + (objNum - 1) * 9;
    } else {
      // V4+: 14-byte entries, 63 * 2 bytes for default properties
      this.objAddr = this.objTable + 63 * 2 + (objNum - 1) * 14;
    }

    // Verify this is a valid object address
    try {
      // Access first byte of the object to verify it's valid
      memory.getByte(this.objAddr);
    } catch (error) {
      throw new Error(
        `Invalid object address for object ${objNum}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  public get objNum(): number {
    return this._objNum;
  }

  // Attribute Handling
  public getMaxAttributes(): number {
    return this.version <= 3 ? 32 : 48;
  }

  private validateAttributeNumber(attr: number): void {
    const maxAttr = this.getMaxAttributes();
    if (attr < 0 || attr >= maxAttr) {
      throw new Error(`Attribute number out of range: ${attr} (max ${maxAttr - 1})`);
    }
  }

  hasAttribute(attr: number): boolean {
    this.validateAttributeNumber(attr);

    // For V1-3: Attributes 0-31 are in 4 bytes
    // For V4+: Attributes 0-47 are in 6 bytes
    const byteIndex = Math.floor(attr / 8);
    const bitPosition = 7 - (attr % 8); // Attribute 0 is highest bit
    const bitMask = 1 << bitPosition;

    const attributeByte = this.memory.getByte(this.objAddr + byteIndex);
    return (attributeByte & bitMask) !== 0;
  }

  setAttribute(attr: number): void {
    this.validateAttributeNumber(attr);

    const byteIndex = Math.floor(attr / 8);
    const bitPosition = 7 - (attr % 8);
    const bitMask = 1 << bitPosition;

    const currentByte = this.memory.getByte(this.objAddr + byteIndex);
    this.memory.setByte(this.objAddr + byteIndex, currentByte | bitMask);
    this.logger.debug(`Set attribute ${attr} on object ${this.objNum}`);
  }

  clearAttribute(attr: number): void {
    this.validateAttributeNumber(attr);

    const byteIndex = Math.floor(attr / 8);
    const bitPosition = 7 - (attr % 8);
    const bitMask = ~(1 << bitPosition);

    const currentByte = this.memory.getByte(this.objAddr + byteIndex);
    this.memory.setByte(this.objAddr + byteIndex, currentByte & bitMask);
    this.logger.debug(`Cleared attribute ${attr} from object ${this.objNum}`);
  }

  // Relationship Handling
  get parent(): GameObject | null {
    try {
      const parentObjNum =
        this.version <= 3 ? this.memory.getByte(this.objAddr + 4) : this.memory.getWord(this.objAddr + 6);

      return parentObjNum === 0 ? null : this.getObject(parentObjNum);
    } catch (error) {
      this.logger.warn(
        `Error accessing parent for object ${this.objNum}: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  set parent(po: GameObject | null) {
    const parentObjNum = po === null ? 0 : po.objNum;

    if (this.version <= 3) {
      this.memory.setByte(this.objAddr + 4, parentObjNum);
    } else {
      this.memory.setWord(this.objAddr + 6, parentObjNum);
    }
  }

  get sibling(): GameObject | null {
    try {
      const siblingObjNum =
        this.version <= 3 ? this.memory.getByte(this.objAddr + 5) : this.memory.getWord(this.objAddr + 8);

      return siblingObjNum === 0 ? null : this.getObject(siblingObjNum);
    } catch (error) {
      this.logger.warn(
        `Error accessing sibling for object ${this.objNum}: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  set sibling(so: GameObject | null) {
    const siblingObjNum = so === null ? 0 : so.objNum;

    if (this.version <= 3) {
      this.memory.setByte(this.objAddr + 5, siblingObjNum);
    } else {
      this.memory.setWord(this.objAddr + 8, siblingObjNum);
    }
  }

  get child(): GameObject | null {
    try {
      const childObjNum =
        this.version <= 3 ? this.memory.getByte(this.objAddr + 6) : this.memory.getWord(this.objAddr + 10);

      return childObjNum === 0 ? null : this.getObject(childObjNum);
    } catch (error) {
      this.logger.warn(
        `Error accessing child for object ${this.objNum}: ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  set child(co: GameObject | null) {
    const childObjNum = co === null ? 0 : co.objNum;

    if (this.version <= 3) {
      this.memory.setByte(this.objAddr + 6, childObjNum);
    } else {
      this.memory.setWord(this.objAddr + 10, childObjNum);
    }
  }

  // Property Handling
  get propertyTableAddr(): Address {
    return this.memory.getWord(this.objAddr + (this.version <= 3 ? 7 : 12));
  }

  // Find property entry
  private _getPropEntry(prop: number): Address {
    const propTableAddr = this.propertyTableAddr;

    // Skip the object name
    const nameLength = this.memory.getByte(propTableAddr);
    let addr = propTableAddr + 1 + 2 * nameLength;

    // Search for the property
    while (true) {
      const sizeByte = this.memory.getByte(addr);
      if (sizeByte === 0) break; // End of property list

      // Get property number - different for V5+
      let propNum;
      if (this.version <= 3) {
        propNum = sizeByte & 0x1f; // V1-3: bits 0-4
      } else {
        // V4+: depends on bit 7
        if ((sizeByte & 0x80) === 0) {
          propNum = sizeByte & 0x3f; // V4+: bits 0-5 when bit 7 is clear
        } else {
          propNum = sizeByte & 0x3f; // V4+: bits 0-5 when bit 7 is set
        }
      }

      if (propNum === prop) return addr;
      if (propNum < prop) break; // Properties are in descending order

      // Skip to next property
      const propLen = GameObject._propDataLen(this.memory, this.version, addr);

      // The increment depends on version and size byte format
      if (this.version <= 3) {
        addr += propLen + 1; // V1-3: size byte + data
      } else if ((sizeByte & 0x80) === 0) {
        addr += propLen + 1; // V4+: simple format (bit 7 clear)
      } else {
        addr += propLen + 2; // V4+: long format (bit 7 set)
      }
    }

    return 0; // Property not found
  }

  // Get property value
  getProperty(prop: number): number {
    const propAddr = this._getPropEntry(prop);

    if (propAddr === 0) {
      // Return default property value
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
        this.logger.warn(`Reading ${propLen}-byte property as word`);
        return this.memory.getWord(dataPtr);
    }
  }

  // Retrieve property address
  getPropertyAddress(prop: number): Address {
    const propAddr = this._getPropEntry(prop);
    return propAddr === 0 ? 0 : this._propDataPtr(propAddr);
  }

  // Get next property
  getNextProperty(prop: number): number {
    let entry;

    if (prop === 0) {
      // First property
      entry = this._firstPropEntry();
    } else {
      // Find current property entry
      entry = this._getPropEntry(prop);
      if (entry === 0) {
        throw new Error(`Property ${prop} not found in object ${this.objNum}`);
      }

      // Move to next entry
      entry = this._nextPropEntry(entry);
    }

    // Return property number or 0 if no more properties
    return entry === 0 ? 0 : this._propEntryNum(entry);
  }

  // Helper methods for property handling
  private _firstPropEntry(): Address {
    const addr = this.propertyTableAddr;
    const nameLen = this.memory.getByte(addr);
    return addr + 1 + 2 * nameLen;
  }

  private _nextPropEntry(propAddr: Address): Address {
    const propLen = GameObject._propDataLen(this.memory, this.version, propAddr);
    const entrySize = propLen + (this.version <= 3 ? 1 : 2);
    return propAddr + entrySize;
  }

  private _propEntryNum(entry: Address): number {
    const sizeByte = this.memory.getByte(entry);
    return this.version <= 3 ? sizeByte & 0x1f : sizeByte & 0x3f;
  }

  private _propDataPtr(propAddr: Address): Address {
    if (this.version <= 3) {
      return propAddr + 1;
    } else {
      const sizeByte = this.memory.getByte(propAddr);
      return sizeByte & 0x80 ? propAddr + 2 : propAddr + 1;
    }
  }

  private _getDefaultPropertyValue(prop: number): number {
    if (prop <= 0 || prop > (this.version <= 3 ? 31 : 63)) {
      throw new Error(`Invalid property number: ${prop}`);
    }

    // The property defaults table starts at objTable - (maxProps * 2)
    const maxProps = this.version <= 3 ? 31 : 63;
    return this.memory.getWord(this.objTable - maxProps * 2 + (prop - 1) * 2);
  }

  // Unlink object from its parent
  unlink(): void {
    // Get the parent object
    const parent = this.parent;
    if (!parent) {
      return; // Nothing to do if no parent
    }

    // Get current position information
    const parentObj = parent;
    const sibling = this.sibling;

    // Clear our own parent and sibling pointers
    this.parent = null;
    this.sibling = null;

    // If we're the parent's direct child, update parent's child pointer
    if (parentObj.child?.objNum === this.objNum) {
      parentObj.child = sibling;
      return;
    }

    // Otherwise we must be a sibling of one of the children
    // Find the sibling that points to us and update its sibling pointer
    let currentChild = parentObj.child;
    while (currentChild) {
      if (currentChild.sibling?.objNum === this.objNum) {
        currentChild.sibling = sibling;
        return;
      }
      currentChild = currentChild.sibling;
    }
  }

  // Protected method to get object (to be implemented by factory)
  protected getObject(objNum: number): GameObject | null {
    throw new Error(`getObject() must be implemented by object provider [${objNum}]`);
  }

  get name(): string {
    try {
      const propTableAddr = this.propertyTableAddr;
      if (propTableAddr === 0) {
        return `[Invalid Object ${this.objNum}]`;
      }

      // Get the length of the name in Z-characters
      const nameLength = this.memory.getByte(propTableAddr);

      // If length is 0, return a placeholder
      if (nameLength === 0) {
        return `[Unnamed Object ${this.objNum}]`;
      }

      // Verify the name is within memory bounds before decoding
      try {
        // Each word contains 3 Z-characters, so we need to check all words
        for (let i = 0; i < nameLength; i++) {
          this.memory.getWord(propTableAddr + 1 + i * 2);
        }

        // Now decode the name if verification passed
        return decodeZString(this.memory, this.memory.getZString(propTableAddr + 1), false);
      } catch (error) {
        this.logger.debug(`[Object ${this.objNum} - Name Error] - ${error}`);
        return `[Object ${this.objNum} - Name Error]`;
      }
    } catch (error) {
      this.logger.debug(`[Object ${this.objNum} - Property Table Error] - ${error}`);
      return `[Object ${this.objNum} - Property Table Error]`;
    }
  }

  putProperty(prop: number, value: number): void {
    const propAddr = this._getPropEntry(prop);

    if (propAddr === 0) {
      throw new Error(`Property ${prop} not found in object ${this.objNum}`);
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
        this.logger.warn(`Writing to ${propLen}-byte property ${prop} as a word`);
        this.memory.setWord(dataPtr, value & 0xffff);
    }
  }

  private hexString(v: number): string {
    return v !== undefined ? '0x' + v.toString(16).padStart(4, '0') : '';
  }

  dumpPropData(entry: Address): string {
    const propDataPtr = this._propDataPtr(entry);
    const propDataLen = GameObject._propDataLen(this.memory, this.version, entry);
    const data: Array<number> = [];

    for (let i = 0; i < propDataLen; i++) {
      data.push(this.memory.getByte(propDataPtr + i));
    }

    return data.map((val) => this.hexString(val)).join(' ');
  }

  dump(indent = 0): void {
    const _indent = ' . '.repeat(indent);

    this.logger.debug(`${_indent}[${this.objNum}] "${this.name}"`);
    this.logger.debug(`${_indent}  Attributes:`);

    const maxAttrs = this.getMaxAttributes();
    const activeAttrs: number[] = [];

    for (let i = 0; i < maxAttrs; i++) {
      if (this.hasAttribute(i)) {
        activeAttrs.push(i);
      }
    }

    if (activeAttrs.length > 0) {
      this.logger.debug(`${_indent}    ${activeAttrs.join(', ')}`);
    } else {
      this.logger.debug(`${_indent}    None`);
    }

    this.logger.debug(`${_indent}  Properties:`);

    let entry = this._firstPropEntry();
    let propNum: number;

    do {
      propNum = this._propEntryNum(entry);

      if (propNum === 0) {
        break;
      }

      this.logger.debug(`${_indent}   ${this.hexString(entry)} [${propNum}] ${this.dumpPropData(entry)}`);

      entry = this._nextPropEntry(entry);
    } while (propNum > 0);

    // Recursively dump children
    for (let c = this.child; c !== null; c = c.sibling) {
      c.dump(indent + 1);
    }
  }
}
