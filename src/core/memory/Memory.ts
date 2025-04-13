import { ZString } from '../../parsers/ZString';
import { Address } from '../../types';
import { HeaderLocation } from '../../utils/constants';
import { Logger } from '../../utils/log';

/**
 * Manages Z-Machine memory access and enforces memory constraints
 * according to the Z-Machine 1.1 specification.
 */
export class Memory {
  private _mem: Buffer;
  private logger: Logger;

  // Cached memory boundary values
  private _dynamicMemoryEnd: number = 0;
  private _highMemoryStart: number = 0;
  private _version: number = 0;

  /**
   * Creates a new Memory instance from a story file buffer
   * @param buffer The story file buffer
   */
  constructor(buffer: Buffer) {
    this._mem = buffer;
    this.logger = new Logger();

    // Cache version and memory boundaries
    this._version = this._mem[HeaderLocation.Version];
    this._dynamicMemoryEnd = this.getWord(HeaderLocation.StaticMemBase);
    this._highMemoryStart = this.getWord(HeaderLocation.HighMemBase);

    // Validate memory size constraints
    this.validateMemorySize();
  }

  /**
   * Validates that the story file size meets Z-Machine requirements
   */
  private validateMemorySize(): void {
    const maxSize = this.getMaxFileSize();
    if (this._mem.length > maxSize) {
      this.logger.warn(
        `Story file size (${this._mem.length} bytes) exceeds maximum for version ${this._version} (${maxSize} bytes)`
      );
    }

    // Check dynamic + static memory limit
    if (this._dynamicMemoryEnd > 65534) {
      // 64KB - 2 bytes
      this.logger.warn(`Dynamic memory end (${this._dynamicMemoryEnd}) exceeds maximum allowed (65534)`);
    }
  }

  /**
   * Gets the maximum allowed file size for the current version
   */
  private getMaxFileSize(): number {
    if (this._version <= 3) return 128 * 1024; // 128KB
    if (this._version <= 5) return 256 * 1024; // 256KB
    return 512 * 1024; // 512KB for v6-8
  }

  /**
   * Determines if the specified address is in dynamic memory
   * @param addr Memory address
   */
  isDynamicMemory(addr: Address): boolean {
    return addr >= 0 && addr < this._dynamicMemoryEnd;
  }

  /**
   * Determines if the specified address is in static memory
   * @param addr Memory address
   */
  isStaticMemory(addr: Address): boolean {
    return addr >= this._dynamicMemoryEnd && addr < this._highMemoryStart;
  }

  /**
   * Determines if the specified address is in high memory
   * @param addr Memory address
   */
  isHighMemory(addr: Address): boolean {
    return addr >= this._highMemoryStart && addr < this._mem.length;
  }

  /**
   * Checks if an address can be written to (dynamic memory only)
   * @param addr Memory address
   */
  private canWrite(addr: Address): boolean {
    return this.isDynamicMemory(addr);
  }

  /**
   * Gets a byte from memory
   * @param addr Memory address
   * @returns The byte value
   * @throws Error if address is out of bounds
   */
  getByte(addr: Address): number {
    if (addr < 0 || addr >= this._mem.length) {
      throw new Error(
        `Memory access out of bounds: address 0x${addr.toString(16)} (max: 0x${(this._mem.length - 1).toString(16)})`
      );
    }
    return this._mem[addr];
  }

  /**
   * Sets a byte in memory
   * @param addr Memory address
   * @param b Byte value
   * @throws Error if address is out of bounds or in read-only memory
   */
  setByte(addr: Address, b: number): void {
    if (addr < 0 || addr >= this._mem.length) {
      throw new Error(
        `Memory access out of bounds: address 0x${addr.toString(16)} (max: 0x${(this._mem.length - 1).toString(16)})`
      );
    }

    if (!this.canWrite(addr)) {
      throw new Error(`Cannot write to read-only memory at address: 0x${addr.toString(16)}`);
    }

    this._mem[addr] = b & 0xff;
  }

  /**
   * Gets a word (2 bytes) from memory
   * @param addr Memory address
   * @returns The word value
   * @throws Error if address is out of bounds
   */
  getWord(addr: Address): number {
    if (addr < 0 || addr >= this._mem.length - 1) {
      throw new Error(
        `Memory access out of bounds: address range 0x${addr.toString(16)}-0x${(addr + 1).toString(16)} (max: 0x${(
          this._mem.length - 1
        ).toString(16)})`
      );
    }

    const ub = this._mem[addr + 0];
    const lb = this._mem[addr + 1];
    return (ub << 8) + lb;
  }

  /**
   * Sets a word (2 bytes) in memory
   * @param addr Memory address
   * @param value Word value
   * @throws Error if address is out of bounds or in read-only memory
   */
  setWord(addr: Address, value: number): void {
    if (addr < 0 || addr >= this._mem.length - 1) {
      throw new Error(
        `Memory access out of bounds: address range 0x${addr.toString(16)}-0x${(addr + 1).toString(16)} (max: 0x${(
          this._mem.length - 1
        ).toString(16)})`
      );
    }

    if (!this.canWrite(addr) || !this.canWrite(addr + 1)) {
      throw new Error(
        `Cannot write to read-only memory at address range: 0x${addr.toString(16)}-0x${(addr + 1).toString(16)}`
      );
    }

    this._mem[addr + 0] = (value >> 8) & 0xff;
    this._mem[addr + 1] = value & 0xff;
  }

  /**
   * Gets a Z-string from memory
   * @param addr Memory address
   * @returns Array of Z-characters
   * @throws Error if address is out of bounds
   */
  getZString(addr: Address): ZString {
    const chars: Array<number> = [];
    let wordCount = 0;
    const MAX_WORDS = 1000; // Safeguard against infinite loops

    while (wordCount < MAX_WORDS) {
      try {
        const w = this.getWord(addr);
        chars.push((w >> 10) & 0x1f, (w >> 5) & 0x1f, (w >> 0) & 0x1f);

        if ((w & 0x8000) !== 0) {
          break;
        }

        addr += 2;
        wordCount++;
      } catch (e) {
        this.logger.warn(`Z-string read terminated due to error: ${e}`);
        break;
      }
    }

    if (wordCount >= MAX_WORDS) {
      this.logger.warn(`Z-string read exceeded maximum length at address: 0x${addr.toString(16)}`);
    }

    return chars;
  }

  /**
   * Gets a length-prefixed Z-string from memory
   * @param addr Memory address
   * @returns Array of Z-characters
   * @throws Error if address is out of bounds
   */
  getLenZString(addr: Address): ZString {
    let len = this.getByte(addr);
    addr++;
    const chars: Array<number> = [];

    while (len-- > 0 && chars.length < 3000) {
      // Safety limit
      try {
        const word = this.getWord(addr);
        chars.push((word >> 10) & 0x1f, (word >> 5) & 0x1f, (word >> 0) & 0x1f);

        if ((word & 0x8000) !== 0) {
          this.logger.warn('High bit found in length string; terminating early.');
          break;
        }

        addr += 2;
      } catch (e) {
        this.logger.warn(`Length-prefixed Z-string read terminated due to error: ${e}`);
        break;
      }
    }

    return chars;
  }

  /**
   * Copies a block of memory from one location to another
   * @param sourceAddr Source address
   * @param destAddr Destination address
   * @param length Number of bytes to copy
   * @throws Error if access is out of bounds or trying to write to read-only memory
   */
  copyBlock(sourceAddr: Address, destAddr: Address, length: number): void {
    if (sourceAddr < 0 || sourceAddr + length > this._mem.length) {
      throw new Error(
        `Source memory access out of bounds: address range 0x${sourceAddr.toString(16)}-0x${(
          sourceAddr +
          length -
          1
        ).toString(16)}`
      );
    }

    if (destAddr < 0 || destAddr + length > this._mem.length) {
      throw new Error(
        `Destination memory access out of bounds: address range 0x${destAddr.toString(16)}-0x${(
          destAddr +
          length -
          1
        ).toString(16)}`
      );
    }

    // Check if all destination bytes are writable
    for (let i = 0; i < length; i++) {
      if (!this.canWrite(destAddr + i)) {
        throw new Error(`Cannot write to read-only memory at address: 0x${(destAddr + i).toString(16)}`);
      }
    }

    // Perform the copy, handling potential overlap
    if (destAddr > sourceAddr && destAddr < sourceAddr + length) {
      // Overlap: copy backward
      for (let i = length - 1; i >= 0; i--) {
        this._mem[destAddr + i] = this._mem[sourceAddr + i];
      }
    } else {
      // No overlap or forward overlap: copy forward
      for (let i = 0; i < length; i++) {
        this._mem[destAddr + i] = this._mem[sourceAddr + i];
      }
    }
  }

  /**
   * Compares two blocks of memory
   * @param addr1 First block address
   * @param addr2 Second block address
   * @param length Number of bytes to compare
   * @returns Negative if addr1 < addr2, positive if addr1 > addr2, 0 if equal
   * @throws Error if access is out of bounds
   */
  compareBlock(addr1: Address, addr2: Address, length: number): number {
    if (addr1 < 0 || addr1 + length > this._mem.length) {
      throw new Error(
        `First memory address out of bounds: address range 0x${addr1.toString(16)}-0x${(addr1 + length - 1).toString(
          16
        )}`
      );
    }

    if (addr2 < 0 || addr2 + length > this._mem.length) {
      throw new Error(
        `Second memory address out of bounds: address range 0x${addr2.toString(16)}-0x${(addr2 + length - 1).toString(
          16
        )}`
      );
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
   * Gets multiple bytes from memory as a Buffer
   * @param addr Starting address
   * @param length Number of bytes to read
   * @returns A new Buffer containing the bytes
   * @throws Error if access is out of bounds
   */
  getBytes(addr: Address, length: number): Buffer {
    if (addr < 0 || addr + length > this._mem.length) {
      throw new Error(
        `Memory access out of bounds: address range 0x${addr.toString(16)}-0x${(addr + length - 1).toString(16)}`
      );
    }

    return Buffer.from(this._mem.subarray(addr, addr + length));
  }

  /**
   * Sets multiple bytes in memory from a Buffer
   * @param addr Destination address
   * @param buffer Source buffer
   * @throws Error if access is out of bounds or trying to write to read-only memory
   */
  setBytes(addr: Address, buffer: Buffer): void {
    if (addr < 0 || addr + buffer.length > this._mem.length) {
      throw new Error(
        `Memory access out of bounds: address range 0x${addr.toString(16)}-0x${(addr + buffer.length - 1).toString(16)}`
      );
    }

    // Check if all destination bytes are writable
    for (let i = 0; i < buffer.length; i++) {
      if (!this.canWrite(addr + i)) {
        throw new Error(`Cannot write to read-only memory at address: 0x${(addr + i).toString(16)}`);
      }
    }

    buffer.copy(this._mem, addr);
  }

  /**
   * Gets the total size of memory
   * @returns Size in bytes
   */
  get size(): number {
    return this._mem.length;
  }

  /**
   * Gets the underlying buffer
   * @returns The memory buffer
   */
  get buffer(): Buffer {
    return this._mem;
  }

  /**
   * Gets the Z-Machine version
   * @returns Version number
   */
  get version(): number {
    return this._version;
  }

  /**
   * Gets the end address of dynamic memory
   * @returns Address
   */
  get dynamicMemoryEnd(): number {
    return this._dynamicMemoryEnd;
  }

  /**
   * Gets the start address of high memory
   * @returns Address
   */
  get highMemoryStart(): number {
    return this._highMemoryStart;
  }

  /**
   * Dumps a region of memory for debugging purposes
   * @param startAddr Starting address
   * @param length Number of bytes to dump
   * @returns Formatted string representation
   */
  dumpMemory(startAddr: Address, length: number): string {
    if (startAddr < 0 || startAddr + length > this._mem.length) {
      throw new Error(
        `Memory dump range out of bounds: 0x${startAddr.toString(16)}-0x${(startAddr + length - 1).toString(16)}`
      );
    }

    const lines: string[] = [];
    for (let i = 0; i < length; i += 16) {
      const bytes: string[] = [];
      const chars: string[] = [];

      for (let j = 0; j < 16 && i + j < length; j++) {
        const byte = this._mem[startAddr + i + j];
        bytes.push(byte.toString(16).padStart(2, '0'));
        chars.push(byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.');
      }

      const addrHex = (startAddr + i).toString(16).padStart(4, '0');
      lines.push(`${addrHex}: ${bytes.join(' ').padEnd(48, ' ')} | ${chars.join('')}`);
    }

    return lines.join('\n');
  }
}
