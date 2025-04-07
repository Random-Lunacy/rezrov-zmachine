// src/core/memory/Memory.ts
import { Address } from '../../types';
import { ZString } from '../../parsers/ZString';

export class Memory {
  private _mem: Buffer;

  constructor(buffer: Buffer) {
    this._mem = buffer;
  }

  getByte(addr: Address): number {
    if (addr < 0 || addr >= this._mem.length) {
      throw new Error(`Memory access out of bounds: ${addr}`);
    }
    return this._mem[addr];
  }

  setByte(addr: Address, b: number): void {
    if (addr < 0 || addr >= this._mem.length) {
      throw new Error(`Memory access out of bounds: ${addr}`);
    }
    this._mem[addr] = b;
  }

  getWord(addr: Address): number {
    if (addr < 0 || addr > this._mem.length - 2) {
      throw new Error(`Memory access out of bounds: ${addr}`);
    }
    const ub = this._mem[addr + 0];
    const lb = this._mem[addr + 1];
    return ub * 256 + lb;
  }

  setWord(addr: Address, value: number): void {
    if (addr < 0 || addr > this._mem.length - 2) {
      throw new Error(`Memory access out of bounds: ${addr}`);
    }
    const lb = value & 255;
    const ub = value >> 8;
    this._mem[addr + 0] = ub;
    this._mem[addr + 1] = lb;
  }

  getZString(addr: Address): ZString {
    const chars: Array<number> = [];
    while (true) {
      const w = this.getWord(addr);
      chars.push((w >> 10) & 0x1f, (w >> 5) & 0x1f, (w >> 0) & 0x1f);
      if ((w & 0x8000) !== 0) {
        break;
      }
      addr += 2;
    }
    return chars;
  }

  // Other memory access methods...

  get buffer(): Buffer {
    return this._mem;
  }
}