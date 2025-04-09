import { Memory } from "../core/memory/Memory";
import { Address } from "../types";
import { Logger } from "../utils/log";

export class Dictionary {
  private memory: Memory;
  private logger: Logger;
  private dictAddr: Address;
  private separators: Array<number>;

  constructor(memory: Memory, logger: Logger, dictAddr: Address) {
    this.memory = memory;
    this.logger = logger;
    this.dictAddr = dictAddr;

    // Read separators from dictionary
    this.separators = this.readSeparators();
  }

  private readSeparators(): Array<number> {
    const numSeparators = this.memory.getByte(this.dictAddr);
    const separators: Array<number> = [];

    for (let i = 0; i < numSeparators; i++) {
      separators.push(this.memory.getByte(this.dictAddr + 1 + i));
    }

    return separators;
  }

  public getSeparators(): Array<number> {
    return [...this.separators];
  }

  public getEntryLength(): number {
    return this.memory.getByte(this.dictAddr + this.separators.length + 1);
  }

  public getNumEntries(): number {
    return this.memory.getWord(this.dictAddr + this.separators.length + 2);
  }

  public getEntryAddress(index: number): Address {
    const entriesStart = this.dictAddr + this.separators.length + 4;
    const entryLength = this.getEntryLength();
    return entriesStart + index * entryLength;
  }

  /**
   * Compares token words with a dictionary entry
   * @param entryAddress Address of dictionary entry
   * @param encodedTokenWords Encoded token words to compare
   * @returns <0 if entry is less than token, 0 if equal, >0 if greater
   */
  public compareTokenWords(
    entryAddress: Address,
    encodedTokenWords: Array<number>,
    version: number
  ): number {
    let comparison = this.memory.getWord(entryAddress) - encodedTokenWords[0];

    if (comparison === 0) {
      comparison = this.memory.getWord(entryAddress + 2) - encodedTokenWords[1];
    }

    if (version > 3 && comparison === 0) {
      comparison = this.memory.getWord(entryAddress + 4) - encodedTokenWords[2];
    }

    return comparison;
  }

  /**
   * Looks up a token in the dictionary
   * @param encodedTokenWords Encoded token words to find
   * @param version Z-machine version
   * @returns Address of the token in the dictionary, or 0 if not found
   */
  public lookupToken(
    encodedTokenWords: Array<number>,
    version: number
  ): Address {
    const numEntries = this.getNumEntries();
    const entryLength = this.getEntryLength();
    const entriesStart = this.dictAddr + this.separators.length + 4;

    // Check if entries are sorted
    if (numEntries < 0) {
      // Entries are not sorted, linear search
      this.logger.debug("Dictionary using linear search");
      const upper = -numEntries - 1;
      for (let i = 0; i <= upper; i++) {
        const entryAddr = entriesStart + i * entryLength;
        const c = this.compareTokenWords(entryAddr, encodedTokenWords, version);
        if (c === 0) {
          return entryAddr;
        }
      }
      return 0; // Not found
    }

    // Sorted case, binary search
    this.logger.debug("Dictionary using binary search");
    let lower = 0;
    let upper = numEntries - 1;

    while (lower <= upper) {
      const mid = Math.floor((lower + upper) / 2);
      const entryAddr = entriesStart + mid * entryLength;

      this.logger.debug(`Comparing against dictionary entry ${mid}`);
      const c = this.compareTokenWords(entryAddr, encodedTokenWords, version);

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
}
