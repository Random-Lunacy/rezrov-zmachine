// src/core/objects/GameObject.ts
import { Memory } from '../memory/Memory';
import { Address } from '../../types';
import { decodeZString } from '../../parsers/ZString';
import { Logger } from '../../utils/log';

export class GameObject {
  private memory: Memory;
  private logger: Logger;
  private version: number;
  
  readonly objnum: number;
  private objaddr: Address;

  constructor(memory: Memory, logger: Logger, version: number, objnum: number, objectTable: number) {
    this.memory = memory;
    this.logger = logger;
    this.version = version;
    this.objnum = objnum;

    if (version <= 3) {
      this.objaddr = objectTable + 31 * 2 + (objnum - 1) * 9;
    } else {
      this.objaddr = objectTable + 63 * 2 + (objnum - 1) * 14;
    }
  }

  get name(): string {
    return decodeZString(
      this.memory,
      this.memory.getZString(this.propertyTableAddr + 1)
    );
  }

  get parent(): GameObject | null {
    // Implementation...
  }
  
  set parent(po: GameObject | null) {
    // Implementation...
  }

  // Other methods...
}