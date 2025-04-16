import { Memory } from '../core/memory/Memory';
import { HeaderLocation } from '../utils/constants';
import { Logger } from '../utils/log';

export class AlphabetTableManager {
  private static readonly DEFAULT_ALPHABET_TABLE_V1 = [
    'abcdefghijklmnopqrstuvwxyz',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    ' 0123456789.,!?_#\'"/\\<-:()',
  ];

  private static readonly DEFAULT_ALPHABET_TABLE = [
    'abcdefghijklmnopqrstuvwxyz',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    ' \n0123456789.,!?_#\'"/\\-:()',
  ];

  private readonly memory: Memory;
  private readonly logger: Logger;
  private readonly version: number;
  private customAlphabetTable: string[] | null = null;

  constructor(memory: Memory, options?: { logger?: Logger }) {
    this.memory = memory;
    this.logger = options?.logger || new Logger('AlphabetTableManager');

    this.version = this.memory.getByte(HeaderLocation.Version);
    this.loadAlphabetTable();
  }

  private loadAlphabetTable(): void {
    const alphabetTableAddr = this.memory.getWord(HeaderLocation.AlphabetTable);

    // Only Version 5+ supports custom alphabet tables per the spec
    if (this.version >= 5 && alphabetTableAddr !== 0) {
      try {
        this.customAlphabetTable = ['', '', ''];

        // Read the 78 bytes (3 blocks of 26 characters)
        for (let alphabet = 0; alphabet < 3; alphabet++) {
          for (let i = 0; i < 26; i++) {
            const zscii = this.memory.getByte(alphabetTableAddr + alphabet * 26 + i);
            this.customAlphabetTable[alphabet] += String.fromCharCode(zscii);
          }
        }

        this.logger.debug(`Loaded custom alphabet table from 0x${alphabetTableAddr.toString(16)}`);
      } catch (e) {
        this.logger.warn(`Failed to load custom alphabet table: ${e}`);
        this.customAlphabetTable = null;
      }
    }
  }

  public getAlphabetTables(): string[] {
    if (this.customAlphabetTable !== null) {
      return this.customAlphabetTable;
    }

    return this.version === 1
      ? AlphabetTableManager.DEFAULT_ALPHABET_TABLE_V1
      : AlphabetTableManager.DEFAULT_ALPHABET_TABLE;
  }

  public getCharacterFromAlphabet(alphabet: number, zChar: number): string {
    const tables = this.getAlphabetTables();

    // Handle special cases
    if (alphabet === 2) {
      if (zChar === 6) {
        // This is a placeholder; actual ZSCII escape sequence handling happens elsewhere
        return '';
      }
      if (zChar === 7) {
        return '\n';
      }
    }

    const index = zChar - 6;
    if (index >= 0 && index < tables[alphabet].length) {
      return tables[alphabet][index];
    }

    return '?'; // Invalid character
  }

  public getZCharForCharacter(char: string): { alphabet: number; zChar: number } | null {
    const tables = this.getAlphabetTables();

    // Check special cases
    if (char === '\n') {
      return { alphabet: 2, zChar: 7 };
    }

    // Check each alphabet
    for (let alphabet = 0; alphabet < 3; alphabet++) {
      const index = tables[alphabet].indexOf(char);
      if (index >= 0) {
        return { alphabet, zChar: index + 6 };
      }
    }

    return null; // Character not found in any alphabet
  }
}
