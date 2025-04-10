// src/parsers/TextParser.ts
import { Memory } from "../core/memory/Memory";
import { Logger } from "../utils/log";
import { Address } from "../types";
import { Dictionary } from "./Dictionary";
import { HeaderLocation } from "../utils/constants";

/**
 * Handles parsing and tokenizing text input for the Z-machine
 */
export class TextParser {
  private memory: Memory;
  private logger: Logger;
  private version: number;
  private dictionaries: Map<Address, Dictionary>;

  constructor(memory: Memory, logger: Logger) {
    this.memory = memory;
    this.logger = logger;
    this.version = this.memory.getByte(HeaderLocation.Version);
    this.dictionaries = new Map();
  }

  /**
   * Get a Dictionary instance for the given address
   * @param dictAddr Dictionary address (0 for default)
   * @returns Dictionary instance
   */
  private getDictionary(dictAddr: Address = 0): Dictionary {
    // Use default dictionary if none specified
    if (dictAddr === 0) {
      dictAddr = this.memory.getWord(HeaderLocation.Dictionary);
    }

    // Create dictionary instance if not cached
    if (!this.dictionaries.has(dictAddr)) {
      this.dictionaries.set(
        dictAddr,
        new Dictionary(this.memory, this.logger, dictAddr, this.version)
      );
    }

    return this.dictionaries.get(dictAddr)!;
  }

  /**
   * Tokenize a line of text and populate the parse buffer
   * @param textBuffer Address of text buffer containing input
   * @param parseBuffer Address of parse buffer to populate
   * @param dict Dictionary address (0 for default)
   * @param flag If true, only recognized words are added to parse buffer
   */
  tokeniseLine(
    textBuffer: Address,
    parseBuffer: Address,
    dict: Address = 0,
    flag: boolean = false
  ): void {
    this.logger.debug(`Tokenizing line: textBuffer=${textBuffer}, parseBuffer=${parseBuffer}`);

    // Get dictionary to use
    const dictionary = this.getDictionary(dict);

    // Reset token count to 0
    this.memory.setByte(parseBuffer + 1, 0);

    // Get text buffer content based on version
    let text = this.getTextBufferContent(textBuffer);
    this.logger.debug(`Input text: "${text}"`);

    // Get separators
    const separators = dictionary.getSeparators();
    this.logger.debug(`Separators: ${dictionary.getSeparatorsAsString()}`);

    // Helper functions for character classification
    const isSpace = (c: string): boolean => c === ' ';
    const isSeparator = (c: string): boolean => separators.includes(c.charCodeAt(0));

    // Tokenize the text
    let wordStart = -1;

    for (let i = 0; i <= text.length; i++) {
      const c = i < text.length ? text[i] : null;
      const isWordChar = c !== null && !isSpace(c) && !isSeparator(c);

      // Start of a word
      if (isWordChar && wordStart === -1) {
        wordStart = i;
      }

      // End of a word or end of input
      if ((!isWordChar || i === text.length) && wordStart !== -1) {
        this.processWord(text.substring(wordStart, i), wordStart, parseBuffer, dictionary, flag);
        wordStart = -1;
      }

      // Process separator as a single character token
      if (c !== null && isSeparator(c)) {
        this.processWord(c, i, parseBuffer, dictionary, flag);
      }
    }

    this.dumpParseBuffer(parseBuffer);
  }

  /**
   * Get text content from the text buffer
   * @param textBuffer Address of text buffer
   * @returns Text content
   */
  private getTextBufferContent(textBuffer: Address): string {
    let result = "";

    if (this.version <= 4) {
      // V1-4: Text buffer format is:
      // Byte 0: Max length
      // Byte 1+: Characters until 0 byte
      const maxLength = this.memory.getByte(textBuffer);
      let addr = textBuffer + 1;

      while (addr - textBuffer <= maxLength) {
        const c = this.memory.getByte(addr++);
        if (c === 0) break;
        result += String.fromCharCode(c);
      }
    } else {
      // V5+: Text buffer format is:
      // Byte 0: Max length
      // Byte 1: Actual length
      // Byte 2+: Characters (no terminator)
      const length = this.memory.getByte(textBuffer + 1);
      let addr = textBuffer + 2;

      for (let i = 0; i < length; i++) {
        const c = this.memory.getByte(addr++);
        result += String.fromCharCode(c);
      }
    }

    return result.toLowerCase();
  }

  /**
   * Process a word and add it to the parse buffer
   * @param word Word to process
   * @param position Position in the input
   * @param parseBuffer Parse buffer address
   * @param dictionary Dictionary to use
   * @param flag If true, only recognized words are added
   */
  private processWord(
    word: string,
    position: number,
    parseBuffer: Address,
    dictionary: Dictionary,
    flag: boolean
  ): void {
    this.logger.debug(`Processing word: "${word}" at position ${position}`);

    // Check if we have room for more tokens
    const maxTokens = this.memory.getByte(parseBuffer);
    const tokenCount = this.memory.getByte(parseBuffer + 1);

    if (tokenCount >= maxTokens) {
      this.logger.debug("Parse buffer full, cannot add more tokens");
      return;
    }

    // Encode the word
    const encodedWord = this.encodeWord(word);

    // Look up in dictionary
    const dictEntry = dictionary.lookupToken(encodedWord);

    // Store the token if found or if flag is false
    if (dictEntry !== 0 || !flag) {
      const tokenOffset = 2 + tokenCount * 4;

      // Store dictionary address
      this.memory.setWord(parseBuffer + tokenOffset, dictEntry);

      // Store word length
      this.memory.setByte(parseBuffer + tokenOffset + 2, word.length);

      // Store word position (1-based)
      this.memory.setByte(parseBuffer + tokenOffset + 3, position + 1);

      // Increment token count
      this.memory.setByte(parseBuffer + 1, tokenCount + 1);

      this.logger.debug(
        `Token stored: addr=${dictEntry !== 0 ? '0x' + dictEntry.toString(16) : 'not found'}, ` +
        `length=${word.length}, position=${position + 1}`
      );
    }
  }

  /**
   * Encode a word for dictionary lookup
   * @param word Word to encode
   * @returns Encoded word as an array of word values
   */
  private encodeWord(word: string): Array<number> {
    this.logger.debug(`Encoding word: "${word}"`);

    // Use default alphabet tables
    const a0 = "abcdefghijklmnopqrstuvwxyz";
    const a1 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const a2 = " \n0123456789.,!?_#'\"/\\-:()";

    // Convert to lowercase
    word = word.toLowerCase();

    // Limit length based on version
    const maxZChars = this.version <= 3 ? 6 : 9;

    // Prepare Z-characters array
    const zchars: Array<number> = [];

    // Encode each character
    for (let i = 0; i < word.length && zchars.length < maxZChars; i++) {
      const char = word[i];

      if (a0.includes(char)) {
        // Alphabet 0 (lowercase)
        zchars.push(a0.indexOf(char) + 6);
      } else if (a2.includes(char)) {
        // Alphabet 2 (symbols)
        zchars.push(5); // Shift to A2
        zchars.push(a2.indexOf(char) + 6);
      } else {
        // Unknown character
        zchars.push(5); // Shift to A2
        zchars.push(a2.indexOf(' ') + 6); // Default to space
      }
    }

    // Pad with shift+space (5 for A2, then 6 for space)
    while (zchars.length < maxZChars) {
      zchars.push(5);
      zchars.push(6);
    }

    // Pack Z-characters into words (3 Z-chars per word)
    const result: Array<number> = [];
    const wordCount = this.version <= 3 ? 2 : 3;

    for (let i = 0; i < wordCount; i++) {
      const char1 = i * 3 < zchars.length ? zchars[i * 3] : 5;
      const char2 = i * 3 + 1 < zchars.length ? zchars[i * 3 + 1] : 5;
      const char3 = i * 3 + 2 < zchars.length ? zchars[i * 3 + 2] : 5;

      let word = (char1 << 10) | (char2 << 5) | char3;

      // Set terminator bit in last word
      if (i === wordCount - 1) {
        word |= 0x8000;
      }

      result.push(word);
    }

    this.logger.debug(`Encoded to: [${result.map(w => '0x' + w.toString(16)).join(', ')}]`);
    return result;
  }

  /**
   * Debug utility to dump the parse buffer contents
   * @param parseBuffer Parse buffer address
   */
  private dumpParseBuffer(parseBuffer: Address): void {
    const maxTokens = this.memory.getByte(parseBuffer);
    const tokenCount = this.memory.getByte(parseBuffer + 1);

    this.logger.debug(`Parse buffer: max=${maxTokens}, count=${tokenCount}, tokens=[`);

    for (let i = 0; i < tokenCount; i++) {
      const offset = parseBuffer + 2 + i * 4;
      const dictAddr = this.memory.getWord(offset);
      const length = this.memory.getByte(offset + 2);
      const position = this.memory.getByte(offset + 3);

      this.logger.debug(`  Token ${i}: dictAddr=0x${dictAddr.toString(16)}, length=${length}, position=${position}`);
    }

    this.logger.debug("]");
  }

  /**
   * Convenience method for direct string tokenization
   * @param text Text to tokenize
   * @param parseBuffer Parse buffer address
   * @param dict Dictionary address (0 for default)
   * @param flag If true, only recognized words are added
   */
  tokenizeString(
    text: string,
    parseBuffer: Address,
    dict: Address = 0,
    flag: boolean = false
  ): void {
    this.logger.debug(`Tokenizing string: "${text}"`);

    // Reset parse buffer
    this.memory.setByte(parseBuffer + 1, 0);

    // Get dictionary
    const dictionary = this.getDictionary(dict);

    // Get separators
    const separators = dictionary.getSeparators();

    // Helper functions for character classification
    const isSpace = (c: string): boolean => c === ' ';
    const isSeparator = (c: string): boolean => separators.includes(c.charCodeAt(0));

    // Tokenize the text
    let wordStart = -1;

    for (let i = 0; i <= text.length; i++) {
      const c = i < text.length ? text[i] : null;
      const isWordChar = c !== null && !isSpace(c) && !isSeparator(c);

      // Start of a word
      if (isWordChar && wordStart === -1) {
        wordStart = i;
      }

      // End of a word or end of input
      if ((!isWordChar || i === text.length) && wordStart !== -1) {
        this.processWord(text.substring(wordStart, i), wordStart, parseBuffer, dictionary, flag);
        wordStart = -1;
      }

      // Process separator as a single character token
      if (c !== null && isSeparator(c)) {
        this.processWord(c, i, parseBuffer, dictionary, flag);
      }
    }

    this.dumpParseBuffer(parseBuffer);
  }
}
