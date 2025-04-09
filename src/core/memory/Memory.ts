// src/core/memory/Memory.ts
import { Address } from "../../types";
import { ZString } from "../../parsers/ZString";

export class Memory {
  private _mem: Buffer;

  constructor(buffer: Buffer) {
    this._mem = buffer;
  }

  /**
   * Get a byte from memory at the specified address
   * @param addr Memory address
   * @returns The byte value at the address
   * @throws Error if address is out of bounds
   */
  getByte(addr: Address): number {
    if (addr < 0 || addr >= this._mem.length) {
      throw new Error(`Memory access out of bounds: ${addr}`);
    }
    return this._mem[addr];
  }

  /**
   * Set a byte in memory at the specified address
   * @param addr Memory address
   * @param b Byte value to set
   * @throws Error if address is out of bounds
   */
  setByte(addr: Address, b: number): void {
    if (addr < 0 || addr >= this._mem.length) {
      throw new Error(`Memory access out of bounds: ${addr}`);
    }
    this._mem[addr] = b;
  }

  /**
   * Get a word (2 bytes) from memory at the specified address
   * @param addr Memory address
   * @returns The word value at the address
   * @throws Error if address is out of bounds
   */
  getWord(addr: Address): number {
    if (addr < 0 || addr > this._mem.length - 2) {
      throw new Error(`Memory access out of bounds: ${addr}`);
    }
    const ub = this._mem[addr + 0];
    const lb = this._mem[addr + 1];
    return ub * 256 + lb;
  }

  /**
   * Set a word (2 bytes) in memory at the specified address
   * @param addr Memory address
   * @param value Word value to set
   * @throws Error if address is out of bounds
   */
  setWord(addr: Address, value: number): void {
    if (addr < 0 || addr > this._mem.length - 2) {
      throw new Error(`Memory access out of bounds: ${addr}`);
    }
    const lb = value & 255;
    const ub = value >> 8;
    this._mem[addr + 0] = ub;
    this._mem[addr + 1] = lb;
  }

  /**
   * Get a Z-string from memory at the specified address
   * @param addr Memory address
   * @returns Array of Z-characters
   */
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

  /**
   * Get a length-prefixed Z-string from memory at the specified address
   * @param addr Memory address
   * @returns Array of Z-characters
   */
  getLenZString(addr: Address): ZString {
    let len = this.getByte(addr);
    addr++;
    const chars: Array<number> = [];
    while (len-- > 0) {
      const w = this.getWord(addr);
      chars.push((w >> 10) & 0x1f, (w >> 5) & 0x1f, (w >> 0) & 0x1f);
      if ((w & 0x8000) !== 0) {
        // High bit found in length string - this is unusual but we'll handle it
        break;
      }
      addr += 2;
    }
    return chars;
  }

  /**
   * Copy a block of memory
   * @param sourceAddr Source address
   * @param destAddr Destination address
   * @param length Number of bytes to copy
   */
  copyBlock(sourceAddr: Address, destAddr: Address, length: number): void {
    if (sourceAddr < 0 || sourceAddr + length > this._mem.length) {
      throw new Error(
        `Source memory access out of bounds: ${sourceAddr} to ${
          sourceAddr + length
        }`
      );
    }
    if (destAddr < 0 || destAddr + length > this._mem.length) {
      throw new Error(
        `Destination memory access out of bounds: ${destAddr} to ${
          destAddr + length
        }`
      );
    }

    // Handle overlapping memory regions correctly
    if (destAddr > sourceAddr && destAddr < sourceAddr + length) {
      // Copy backwards to avoid overwriting source data
      for (let i = length - 1; i >= 0; i--) {
        this._mem[destAddr + i] = this._mem[sourceAddr + i];
      }
    } else {
      // Copy forwards
      for (let i = 0; i < length; i++) {
        this._mem[destAddr + i] = this._mem[sourceAddr + i];
      }
    }
  }

  /**
   * Get the size of the memory buffer
   * @returns The length of the memory buffer
   */
  get size(): number {
    return this._mem.length;
  }

  /**
   * Get the underlying buffer
   * @returns The memory buffer
   */
  get buffer(): Buffer {
    return this._mem;
  }
}
