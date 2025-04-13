// src/core/memory/Memory.ts
import { Address } from '../../types';
import { ZString } from '../../parsers/ZString';

/**
 * Provides access to the Z-machine's memory, handling byte and word operations
 * with bounds checking and specialized Z-string retrieval.
 */
export class Memory {
  private _mem: Buffer;

  /**
   * Creates a new Memory instance
   * @param buffer The raw story file buffer
   */
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
    this._mem[addr] = b & 0xff; // Ensure it's a byte
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
    // Z-machine uses big-endian byte order for words
    const ub = this._mem[addr + 0];
    const lb = this._mem[addr + 1];
    return (ub << 8) + lb;
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
    // Z-machine uses big-endian byte order for words
    this._mem[addr + 0] = (value >> 8) & 0xff; // High byte
    this._mem[addr + 1] = value & 0xff; // Low byte
  }

  /**
   * Get a Z-string from memory at the specified address
   * @param addr Memory address
   * @returns Array of Z-characters
   */
  getZString(addr: Address): ZString {
    const chars: Array<number> = [];
    let word: number;

    do {
      word = this.getWord(addr);
      chars.push((word >> 10) & 0x1f); // First Z-character (bits 15-11)
      chars.push((word >> 5) & 0x1f); // Second Z-character (bits 10-6)
      chars.push(word & 0x1f); // Third Z-character (bits 5-1)

      // If the top bit is set, this is the last word of the string
      if ((word & 0x8000) !== 0) {
        break;
      }

      addr += 2;

      // Safety check to prevent infinite loops
      if (addr >= this._mem.length - 1) {
        break;
      }
    } while (true);

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

    // Process each word in the string
    while (len-- > 0) {
      const word = this.getWord(addr);

      chars.push((word >> 10) & 0x1f); // First Z-character
      chars.push((word >> 5) & 0x1f); // Second Z-character
      chars.push(word & 0x1f); // Third Z-character

      // If high bit is set, we're done (although this is unusual in a length-prefixed string)
      if ((word & 0x8000) !== 0) {
        break;
      }

      addr += 2;

      // Safety check
      if (addr >= this._mem.length - 1) {
        break;
      }
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
      throw new Error(`Source memory access out of bounds: ${sourceAddr} to ${sourceAddr + length}`);
    }

    if (destAddr < 0 || destAddr + length > this._mem.length) {
      throw new Error(`Destination memory access out of bounds: ${destAddr} to ${destAddr + length}`);
    }

    // Handle overlapping regions correctly
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
   * Compare two memory regions
   * @param addr1 First memory address
   * @param addr2 Second memory address
   * @param length Number of bytes to compare
   * @returns 0 if equal, negative if addr1 < addr2, positive if addr1 > addr2
   */
  compareBlock(addr1: Address, addr2: Address, length: number): number {
    if (addr1 < 0 || addr1 + length > this._mem.length) {
      throw new Error(`First memory address out of bounds: ${addr1} to ${addr1 + length}`);
    }

    if (addr2 < 0 || addr2 + length > this._mem.length) {
      throw new Error(`Second memory address out of bounds: ${addr2} to ${addr2 + length}`);
    }

    for (let i = 0; i < length; i++) {
      const diff = this._mem[addr1 + i] - this._mem[addr2 + i];
      if (diff !== 0) {
        return diff;
      }
    }

    return 0;
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
