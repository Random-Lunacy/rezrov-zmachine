// src/parsers/Dictionary.ts
import { Memory } from '../core/memory/Memory';
import { Address } from '../types';
import { Logger } from '../utils/log';

/**
 * Represents a Z-machine dictionary
 * Handles word lookups and dictionary structure
 */
export class Dictionary {
  private memory: Memory;
  private logger: Logger;
  private dictAddr: Address;
  private separators: Array<number>;
  private entryLength: number;
  private numEntries: number;
  private entriesStart: Address;
  private version: number;

  /**
   * Creates a new Dictionary instance
   * @param memory Memory instance
   * @param logger Logger instance
   * @param dictAddr Dictionary address
   * @param version Z-machine version
   */
  constructor(memory: Memory, logger: Logger, dictAddr: Address, version: number) {
    this.memory = memory;
    this.logger = logger;
    this.dictAddr = dictAddr;
    this.version = version;

    // Read dictionary header
    this.separators = this.readSeparators();
    this.entryLength = this.memory.getByte(this.dictAddr + this.separators.length + 1);
    this.numEntries = this.memory.getWord(this.dictAddr + this.separators.length + 2);
    this.entriesStart = this.dictAddr + this.separators.length + 4;

    this.logger.debug(
      `Dictionary at 0x${dictAddr.toString(16)}: ${Math.abs(this.numEntries)} entries, each ${this.entryLength} bytes`
    );
    this.logger.debug(`Separators: ${this.getSeparatorsAsString()}`);
  }

  /**
   * Reads the separator characters from the dictionary
   * @returns Array of separator character codes
   */
  private readSeparators(): Array<number> {
    const numSeparators = this.memory.getByte(this.dictAddr);
    const separators: Array<number> = [];

    for (let i = 0; i < numSeparators; i++) {
      separators.push(this.memory.getByte(this.dictAddr + 1 + i));
    }

    return separators;
  }

  /**
   * Get all separator characters
   * @returns Array of separator character codes
   */
  public getSeparators(): Array<number> {
    return [...this.separators];
  }

  /**
   * Get separator characters as a readable string
   * @returns String representation of separators
   */
  public getSeparatorsAsString(): string {
    return this.separators.map(s => `'${String.fromCharCode(s)}'`).join(', ');
  }

  /**
   * Get the entry length in bytes
   * @returns Entry length
   */
  public getEntryLength(): number {
    return this.entryLength;
  }

  /**
   * Get the number of entries in the dictionary
   * @returns Number of entries (absolute value)
   */
  public getNumEntries(): number {
    return Math.abs(this.numEntries);
  }

  /**
   * Check if dictionary entries are sorted
   * @returns True if entries are sorted
   */
  public isSorted(): boolean {
    return this.numEntries >= 0;
  }

  /**
   * Get the address of a dictionary entry by index
   * @param index Entry index
   * @returns Address of the entry
   */
  public getEntryAddress(index: number): Address {
    if (index < 0 || index >= Math.abs(this.numEntries)) {
      throw new Error(`Dictionary entry index out of range: ${index}`);
    }
    return this.entriesStart + index * this.entryLength;
  }

  /**
   * Compares token words with a dictionary entry
   * @param entryAddr Address of dictionary entry
   * @param encodedTokenWords Encoded token words to compare
   * @returns <0 if entry is less than token, 0 if equal, >0 if greater
   */
  public compareTokenWords(entryAddr: Address, encodedTokenWords: Array<number>): number {
    let comparison = this.memory.getWord(entryAddr) - encodedTokenWords[0];

    if (comparison === 0 && encodedTokenWords.length > 1) {
      comparison = this.memory.getWord(entryAddr + 2) - encodedTokenWords[1];
    }

    if (this.version > 3 && comparison === 0 && encodedTokenWords.length > 2) {
      comparison = this.memory.getWord(entryAddr + 4) - encodedTokenWords[2];
    }

    return comparison;
  }

  /**
   * Looks up a token in the dictionary
   * @param encodedTokenWords Encoded token words to find
   * @returns Address of the token in the dictionary, or 0 if not found
   */
  public lookupToken(encodedTokenWords: Array<number>): Address {
    // Check if entries are sorted
    if (!this.isSorted()) {
      // Entries are not sorted, linear search
      this.logger.debug('Dictionary using linear search');
      const count = this.getNumEntries();

      for (let i = 0; i < count; i++) {
        const entryAddr = this.getEntryAddress(i);
        const c = this.compareTokenWords(entryAddr, encodedTokenWords);
        if (c === 0) {
          return entryAddr;
        }
      }
      return 0; // Not found
    }

    // Sorted case, binary search
    this.logger.debug('Dictionary using binary search');
    let lower = 0;
    let upper = this.getNumEntries() - 1;

    while (lower <= upper) {
      const mid = Math.floor((lower + upper) / 2);
      const entryAddr = this.getEntryAddress(mid);

      this.logger.debug(`Comparing against dictionary entry ${mid}`);
      const c = this.compareTokenWords(entryAddr, encodedTokenWords);

      if (c < 0) {
        // Entry is < encoded, pick upper half
        lower = mid + 1;
      } else if (c > 0) {
        // Entry is > encoded, pick lower half
        upper = mid - 1;
      } else {
        // Entry === encoded, found it
        return entryAddr;
      }
    }

    return 0; // Not found
  }

  /**
   * Extract any data from a dictionary entry beyond the word itself
   * @param entryAddr Address of the entry
   * @returns Object containing entry data
   */
  public getEntryData(entryAddr: Address): { [key: string]: number } {
    // The format depends on the Z-machine version and the dictionary
    // This is a simplified implementation
    const result: { [key: string]: number } = {};

    // For v3 dictionaries, typically there are 4 bytes after the word
    // Often first byte is part-of-speech, remaining 3 are flags
    const dataOffset = this.version <= 3 ? 4 : 6;

    for (let i = 0; i < this.entryLength - dataOffset; i++) {
      result[`byte${i}`] = this.memory.getByte(entryAddr + dataOffset + i);
    }

    return result;
  }
}
