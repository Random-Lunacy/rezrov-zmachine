import { Memory } from '../core/memory/Memory';
import { Address } from '../types';
import { HeaderLocation } from '../utils/constants';
import { Logger } from '../utils/log';
import { Dictionary } from './Dictionary';
import { encodeZString, packZCharacters } from './ZString';

export class TextParser {
  private memory: Memory;
  private logger: Logger;
  private version: number;
  private dictionaries: Map<Address, Dictionary>;

  constructor(memory: Memory, options?: { logger?: Logger }) {
    this.memory = memory;
    this.logger = options?.logger || new Logger('TextParser');
    this.version = this.memory.getByte(HeaderLocation.Version);
    this.dictionaries = new Map();
  }

  private getDictionary(dictAddr: Address = 0): Dictionary {
    // If no dictionary address provided, use the default
    if (dictAddr === 0) {
      dictAddr = this.memory.getWord(HeaderLocation.Dictionary);
    }

    // Create a new dictionary instance if we haven't seen this one before
    if (!this.dictionaries.has(dictAddr)) {
      this.dictionaries.set(dictAddr, new Dictionary(this.memory, dictAddr, this.version));
    }

    return this.dictionaries.get(dictAddr)!;
  }

  /**
   * Tokenize a line of text from a text buffer and store the results in a parse buffer
   * @param textBuffer Address of the text buffer
   * @param parseBuffer Address of the parse buffer
   * @param dict Address of the dictionary to use (0 for default)
   * @param flag If true, only recognized words are added to the parse buffer
   */
  tokenizeLine(textBuffer: Address, parseBuffer: Address, dict: Address = 0, flag: boolean = false): void {
    this.logger.debug(
      `Tokenizing line: textBuffer=0x${textBuffer.toString(16)}, parseBuffer=0x${parseBuffer.toString(16)}`
    );

    // Get the dictionary
    const dictionary = this.getDictionary(dict);

    // Reset the token count to 0
    this.memory.setByte(parseBuffer + 1, 0);

    // NOTE: Do NOT clear the entire parse buffer area!
    // The game may store other data in the unused token slots.
    // Only the token count byte needs to be reset.

    // Skip the separators
    const separators = dictionary.getSeparators();
    this.logger.debug(`Separators: ${dictionary.getSeparatorsAsString()}`);

    let text: string;
    const version = this.version;

    // Read text based on version format
    if (version >= 5) {
      // V5+: Text buffer format is:
      // Byte 0: Max length
      // Byte 1: Actual length
      // Byte 2+: Characters (no terminator)
      const length = this.memory.getByte(textBuffer + 1);
      text = this.readChars(textBuffer + 2, length);
    } else {
      // V1-4: Text buffer format is:
      // Byte 0: Max length
      // Byte 1+: Characters until 0 byte
      text = '';
      let addr = textBuffer + 1;
      const maxLength = this.memory.getByte(textBuffer);

      while (text.length < maxLength) {
        const c = this.memory.getByte(addr++);
        if (c === 0) break;
        text += String.fromCharCode(c);
      }
    }

    text = text.toLowerCase();
    this.logger.debug(`Input text after lowercase: "${text}"`);

    // Helper functions for character classification
    const isSpace = (c: string): boolean => c === ' ';
    const isSeparator = (c: string): boolean => separators.includes(c.charCodeAt(0));

    // Process the text character by character
    let wordStart = -1;

    for (let i = 0; i <= text.length; i++) {
      const c = i < text.length ? text[i] : null;
      const isWordChar = c !== null && !isSpace(c) && !isSeparator(c);

      // Start of a word
      if (isWordChar && wordStart === -1) {
        wordStart = i;
      }

      // End of a word
      if ((!isWordChar || i === text.length) && wordStart !== -1) {
        const wordText = text.substring(wordStart, i);
        this.processWord(wordText, wordStart, parseBuffer, dictionary, flag);
        wordStart = -1;
      }

      // Process separator characters as individual "words"
      if (c !== null && isSeparator(c)) {
        this.processWord(c, i, parseBuffer, dictionary, flag);
      }
    }

    this.dumpParseBuffer(parseBuffer);
  }

  /**
   * Read characters from memory into a string
   */
  private readChars(address: Address, length: number): string {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += String.fromCharCode(this.memory.getByte(address + i));
    }
    return result;
  }

  /**
   * Process a word and add it to the parse buffer
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
      this.logger.debug('Parse buffer full, cannot add more tokens');
      return;
    }

    // Encode the word for dictionary lookup
    const encodedText = encodeZString(this.memory, word, this.version);
    const encodedWord = packZCharacters(encodedText, this.version);

    // Look up the word in the dictionary
    const dictEntry = dictionary.lookupToken(encodedWord);

    // If found or if we're adding all words
    if (dictEntry !== 0 || !flag) {
      const tokenOffset = 2 + tokenCount * 4;

      // Store dictionary address (or 0 if not found)
      this.memory.setWord(parseBuffer + tokenOffset, dictEntry);

      // Store word length
      this.memory.setByte(parseBuffer + tokenOffset + 2, word.length);

      // Store word position - this should be the byte offset into the text buffer
      // For V5+, text starts at textBuffer+2, so position in text buffer = position + 2
      // For V1-4, text starts at textBuffer+1, so position in text buffer = position + 1
      const bufferPosition = this.version >= 5 ? position + 2 : position + 1;
      this.memory.setByte(parseBuffer + tokenOffset + 3, bufferPosition);

      // Increment token count
      this.memory.setByte(parseBuffer + 1, tokenCount + 1);

      this.logger.debug(
        `Token stored: addr=${dictEntry !== 0 ? '0x' + dictEntry.toString(16) : 'not found'}, ` +
          `length=${word.length}, position=${position + 1}`
      );
    }
  }

  /**
   * Dump the parse buffer contents for debugging
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

    this.logger.debug(']');
  }

  /**
   * Tokenize an external string (not from game memory)
   */
  tokenizeString(text: string, parseBuffer: Address, dict: Address = 0, flag: boolean = false): void {
    this.logger.debug(`Tokenizing string: "${text}"`);

    // Reset the token count to 0
    this.memory.setByte(parseBuffer + 1, 0);

    // NOTE: Do NOT clear the entire parse buffer area!
    // The game may store other data in the unused token slots.

    // Get the dictionary
    const dictionary = this.getDictionary(dict);

    // Get the separators
    const separators = dictionary.getSeparators();

    // Helper functions for character classification
    const isSpace = (c: string): boolean => c === ' ';
    const isSeparator = (c: string): boolean => separators.includes(c.charCodeAt(0));

    // Process the text character by character
    let wordStart = -1;

    for (let i = 0; i <= text.length; i++) {
      const c = i < text.length ? text[i] : null;
      const isWordChar = c !== null && !isSpace(c) && !isSeparator(c);

      // Start of a word
      if (isWordChar && wordStart === -1) {
        wordStart = i;
      }

      // End of a word
      if ((!isWordChar || i === text.length) && wordStart !== -1) {
        this.processWord(text.substring(wordStart, i), wordStart, parseBuffer, dictionary, flag);
        wordStart = -1;
      }

      // Process separator characters as individual "words"
      if (c !== null && isSeparator(c)) {
        this.processWord(c, i, parseBuffer, dictionary, flag);
      }
    }

    this.dumpParseBuffer(parseBuffer);
  }
}
