import { Memory } from "../core/memory/Memory";
import { Dictionary } from "./Dictionary";
import { Logger } from "../utils/log";

export class TextParser {
  private memory: Memory;
  private dictionary: Dictionary;
  private logger: Logger;

  constructor(memory: Memory, dictionary: Dictionary, logger: Logger) {
    this.memory = memory;
    this.dictionary = dictionary;
    this.logger = logger;
  }

  /**
   * Parse input text and populate parse buffer with tokens
   * @param textBuffer Address of text buffer containing input
   * @param parseBuffer Address of parse buffer to populate
   * @param dict Optional custom dictionary address (0 for default)
   * @param flag If true, only recognized words are added to parse buffer
   */
  tokeniseLine(
    textBuffer: number,
    parseBuffer: number,
    dict: number = 0,
    flag: boolean = false
  ): void {
    // Reset token count to 0
    this.memory.setByte(parseBuffer + 1, 0);

    let addr1 = textBuffer;
    let addr2 = 0;
    let length = 0;
    let version = this.memory.getByte(0x00); // Version stored at header address 0

    if (version >= 5) {
      addr1++; // Skip the max length byte
      length = this.memory.getByte(addr1);
    }

    let c;
    do {
      let sepAddr: number;
      let sepCount: number;
      let separator: number;

      addr1++;

      // Fetch next character
      if (version >= 5 && addr1 === textBuffer + 2 + length) {
        c = 0;
      } else {
        c = this.memory.getByte(addr1);
      }

      // Check for separator
      const dictAddr = dict === 0 ? this.getDictionaryAddress() : dict;
      sepAddr = dictAddr;
      sepCount = this.memory.getByte(sepAddr++);

      do {
        separator = this.memory.getByte(sepAddr++);
      } while (c != separator && --sepCount != 0);

      // This could be the start or the end of a word
      if (sepCount == 0 && c != 32 && c != 0) {
        if (addr2 == 0) {
          addr2 = addr1;
        }
      } else if (addr2 != 0) {
        this.tokeniseText(
          textBuffer,
          addr1 - addr2,
          addr2 - textBuffer,
          parseBuffer,
          dictAddr,
          flag
        );

        addr2 = 0;
      }

      if (sepCount != 0) {
        this.tokeniseText(
          textBuffer,
          1,
          addr1 - textBuffer,
          parseBuffer,
          dictAddr,
          flag
        );
      }
    } while (c != 0);
  }

  /**
   * Tokenize a specific part of text
   * @param textBuffer Text buffer address
   * @param length Length of the word
   * @param from Starting position in the text buffer
   * @param parseBuffer Parse buffer address
   * @param dict Dictionary address
   * @param flag If true, only recognized words are added
   */
  private tokeniseText(
    textBuffer: number,
    length: number,
    from: number,
    parseBuffer: number,
    dict: number,
    flag: boolean
  ): void {
    const tokenMax = this.memory.getByte(parseBuffer);
    const tokenCount = this.memory.getByte(parseBuffer + 1);

    if (tokenCount >= tokenMax) {
      // No space for more tokens
      return;
    }

    this.memory.setByte(parseBuffer + 1, tokenCount + 1);

    // Extract the word characters
    const wordZChars: Array<string> = [];
    for (let i = 0; i < length; i++) {
      wordZChars.push(String.fromCharCode(this.memory.getByte(textBuffer + from + i)));
    }

    // Encode the word
    const tokenWords = this.encodeToken(wordZChars.join(""));
    const version = this.memory.getByte(0x00);
    const tokenAddr = this.dictionary.lookupToken(tokenWords, version);

    if (tokenAddr !== 0 || !flag) {
      const tokenStorage = 4 * tokenCount + parseBuffer + 2;
      this.memory.setWord(tokenStorage, tokenAddr);
      this.memory.setByte(tokenStorage + 2, length);
      this.memory.setByte(tokenStorage + 3, from);
    }
  }

  /**
   * Encode a token string to Z-machine word format
   * @param text Text to encode
   * @param padding Padding character code (default 0x05)
   * @returns Array of encoded word values
   */
  encodeToken(text: string, padding = 0x05): Array<number> {
    this.logger.debug(`encodeToken(${text})`);
    const version = this.memory.getByte(0x00);
    const resolution = version > 3 ? 3 : 2;

    // Chop it off at resolution*3 characters (the max for that version)
    text = text.slice(0, resolution * 3);
    const zchars: Array<number> = [];

    // Basic character conversion - this is simplified and should be expanded
    for (let i = 0; i < text.length; i++) {
      let charCode: number;

      if (text[i] >= 'a' && text[i] <= 'z') {
        charCode = text.charCodeAt(i) - 'a'.charCodeAt(0) + 6;
      } else if (text[i] >= 'A' && text[i] <= 'Z') {
        // Handle uppercase - this is simplified
        charCode = text.charCodeAt(i) - 'A'.charCodeAt(0) + 6;
      } else {
        // For simplicity, just use the character code for now
        charCode = text.charCodeAt(i);
      }

      zchars.push(charCode);
    }

    // Pad to full length
    while (zchars.length < resolution * 3) {
      zchars.push(padding);
    }

    this.logger.debug(`zchars: ${JSON.stringify(zchars)}`);

    // Combine characters into Z-words
    const zwords: Array<number> = [];
    for (let i = 0; i < resolution; i++) {
      zwords.push(
        (zchars[3 * i + 0] << 10) | (zchars[3 * i + 1] << 5) | zchars[3 * i + 2]
      );
    }

    // Set termination bit in the last word
    zwords[resolution - 1] |= 0x8000;

    this.logger.debug(`returning ${zwords}`);
    return zwords;
  }

  /**
   * Tokenize a single word and add it to the parse buffer
   * @param inputBuffer Input text buffer
   * @param start Start position of the word
   * @param end End position of the word
   * @param parseBuffer Parse buffer address
   */
  tokenizeWord(
    inputBuffer: string,
    start: number,
    end: number,
    parseBuffer: number
  ): void {
    // The parse buffer contains as the first two bytes:
    // [0]: max tokens
    // [1]: count tokens
    // max tokens is supplied to us, and we fill in count tokens
    const maxTokens = this.memory.getByte(parseBuffer);
    let countTokens = this.memory.getByte(parseBuffer + 1);

    if (countTokens >= maxTokens) {
      return;
    }

    const wordText = inputBuffer.slice(start, end).toLowerCase();
    const tokenWords = this.encodeToken(wordText);
    const version = this.memory.getByte(0x00);
    const tokenAddr = this.dictionary.lookupToken(tokenWords, version);

    if (tokenAddr !== 0) {
      const tokenStorage = 4 * countTokens + 2 + parseBuffer;
      this.memory.setByte(parseBuffer + 1, ++countTokens);
      this.memory.setWord(tokenStorage, tokenAddr);
      this.memory.setByte(tokenStorage + 2, end - start);
      this.memory.setByte(tokenStorage + 3, start + 1);
    }
  }

  /**
   * Main tokenization method for string input
   * @param inputText Text to tokenize
   * @param parseBuffer Parse buffer address
   */
  tokenize(inputText: string, parseBuffer: number): void {
    // Clean parse buffer by setting count_tokens to 0
    this.memory.setByte(parseBuffer + 1, 0);

    const dictAddr = this.getDictionaryAddress();
    const numSep = this.memory.getByte(dictAddr);
    const sepZscii: Array<number> = [];

    for (let i = 0; i < numSep; i++) {
      sepZscii.push(this.memory.getByte(dictAddr + 1 + i));
    }

    this.logger.debug(`sep_zscii = ${sepZscii.map((ch) => String.fromCharCode(ch))}`);

    // Helper functions for character classification
    const isSeparator = (c: string) => sepZscii.indexOf(c.charCodeAt(0)) !== -1;

    const CHAR_CLASS_SPACE = 2;
    const CHAR_CLASS_SEP = 1;
    const CHAR_CLASS_WORD = 0;

    const charClass = (c: string) => {
      if (c === " ") {
        return CHAR_CLASS_SPACE;
      }
      if (isSeparator(c)) {
        return CHAR_CLASS_SEP;
      }
      return CHAR_CLASS_WORD;
    };

    // Split and classify input
    const splitString = inputText.split("");
    const classes = splitString.map(charClass);

    // Process tokens
    for (let start = 0; start < classes.length; start++) {
      if (classes[start] === CHAR_CLASS_SPACE) {
        continue;
      }

      if (classes[start] === CHAR_CLASS_SEP) {
        this.tokenizeWord(inputText, start, start + 1, parseBuffer);
        continue;
      }

      let end;
      for (end = start + 1; end < classes.length; end++) {
        if (classes[end] !== CHAR_CLASS_WORD) {
          this.tokenizeWord(inputText, start, end, parseBuffer);
          start = end - 1;
          break;
        }
      }

      if (end === classes.length) {
        this.tokenizeWord(inputText, start, end, parseBuffer);
        break;
      }
    }

    this.dumpParseBuffer(parseBuffer);
  }

  /**
   * Get the address of the dictionary from the Z-machine header
   */
  private getDictionaryAddress(): number {
    return this.memory.getWord(0x08); // Dictionary address is at 0x08 in the header
  }

  /**
   * Dump the contents of the parse buffer for debugging
   */
  private dumpParseBuffer(parseBuffer: number): void {
    const max = this.memory.getByte(parseBuffer);
    const count = this.memory.getByte(parseBuffer + 1);

    this.logger.debug(` max = ${max}, count = ${count} tokens = [`);

    for (let i = 0; i < count; i++) {
      const addr = this.memory.getWord(parseBuffer + 2 + i * 4);
      const length = this.memory.getByte(parseBuffer + 4 + i * 4);
      const from = this.memory.getByte(parseBuffer + 5 + i * 4);

      this.logger.debug(` (${this.hex(addr)}, ${this.hex(from)}, ${this.hex(length)})`);
    }

    this.logger.debug(" ]");
  }

  /**
   * Convert a number to hexadecimal string
   */
  private hex(v: number): string {
    return v !== undefined ? v.toString(16) : "";
  }
}
