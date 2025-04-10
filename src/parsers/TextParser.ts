// src/parsers/TextParser.ts
import { Memory } from "../core/memory/Memory";
import { Logger } from "../utils/log";
import { Address } from "../types";
import { HeaderLocation } from "../utils/constants";

/**
 * Handles parsing and tokenizing text input for the Z-machine
 */
export class TextParser {
  private memory: Memory;
  private logger: Logger;

  constructor(memory: Memory, logger: Logger) {
    this.memory = memory;
    this.logger = logger;
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
    // Use default dictionary if none specified
    if (dict === 0) {
      dict = this.memory.getWord(HeaderLocation.Dictionary);
    }

    // Reset token count to 0
    this.memory.setByte(parseBuffer + 1, 0);

    const version = this.memory.getByte(HeaderLocation.Version);
    let addr1 = textBuffer;
    let addr2 = 0;
    let length = 0;

    if (version >= 5) {
      addr1++; // Skip the max length byte
      length = this.memory.getByte(addr1);
      this.logger.debug(`Text length: ${length}`);
    }

    // Get separators from dictionary
    const numSep = this.memory.getByte(dict);
    let sepAddr = dict + 1;
    const separators: number[] = [];
    for (let i = 0; i < numSep; i++) {
      separators.push(this.memory.getByte(sepAddr++));
    }

    this.logger.debug(
      `Separators: ${separators.map((s) => String.fromCharCode(s)).join(" ")}`
    );

    let c: number;
    do {
      addr1++;

      // Fetch next character
      if (version >= 5 && addr1 === textBuffer + 2 + length) {
        c = 0;
      } else {
        c = this.memory.getByte(addr1);
      }

      // Check if this character is a separator
      let isSeparator = false;
      for (let i = 0; i < numSep; i++) {
        if (c === separators[i]) {
          isSeparator = true;
          break;
        }
      }

      // Handle word boundaries
      if (!isSeparator && c !== 32 && c !== 0) {
        // Start of a word
        if (addr2 === 0) {
          addr2 = addr1;
        }
      } else if (addr2 !== 0) {
        // End of a word
        this.tokeniseText(
          textBuffer,
          addr1 - addr2,
          addr2 - textBuffer,
          parseBuffer,
          dict,
          flag
        );
        addr2 = 0;
      }

      // Handle separator as a single-character word
      if (isSeparator) {
        this.tokeniseText(
          textBuffer,
          1,
          addr1 - textBuffer,
          parseBuffer,
          dict,
          flag
        );
      }
    } while (c !== 0);

    this.dumpParseBuffer(parseBuffer);
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
    textBuffer: Address,
    length: number,
    from: Address,
    parseBuffer: Address,
    dict: Address,
    flag: boolean
  ): void {
    const tokenMax = this.memory.getByte(parseBuffer);
    const tokenCount = this.memory.getByte(parseBuffer + 1);

    if (tokenCount >= tokenMax) {
      // No space for more tokens
      return;
    }

    // Extract the word characters
    const wordChars: string[] = [];
    for (let i = 0; i < length; i++) {
      const charCode = this.memory.getByte(textBuffer + from + i);
      wordChars.push(String.fromCharCode(charCode));
    }
    const word = wordChars.join("").toLowerCase();

    this.logger.debug(`Tokenizing word: "${word}"`);

    // Encode the word into Z-machine format
    const tokenWords = this.encodeToken(word);

    // Look up the token in the dictionary
    const tokenAddr = this.lookupToken(dict, tokenWords);

    // Store the token if found or if flag is false
    if (tokenAddr !== 0 || !flag) {
      const tokenStorage = 4 * tokenCount + parseBuffer + 2;
      this.memory.setByte(parseBuffer + 1, tokenCount + 1);
      this.memory.setWord(tokenStorage, tokenAddr);
      this.memory.setByte(tokenStorage + 2, length);
      this.memory.setByte(tokenStorage + 3, from);

      this.logger.debug(
        `Token stored: addr=0x${tokenAddr.toString(16)}, length=${length}, position=${from}`
      );
    }
  }

  /**
   * Look up a token in the dictionary
   * @param dict Dictionary address
   * @param encodedToken Encoded token words
   * @returns Address of dictionary entry or 0 if not found
   */
  private lookupToken(dict: Address, encodedToken: number[]): Address {
    const version = this.memory.getByte(HeaderLocation.Version);

    // Skip separators
    const numSep = this.memory.getByte(dict);
    const dictStart = dict + numSep + 1;

    // Get entry length and count
    const entryLen = this.memory.getByte(dictStart);
    const entryCount = this.memory.getWord(dictStart + 1);
    const entriesStart = dictStart + 3;

    this.logger.debug(
      `Dictionary: ${entryCount} entries, each ${entryLen} bytes`
    );

    // Check if entries are sorted (negative count means unsorted)
    if (entryCount < 0) {
      // Linear search
      this.logger.debug("Using linear search");
      const count = -entryCount;

      for (let i = 0; i < count; i++) {
        const entryAddr = entriesStart + i * entryLen;
        if (this.compareTokenWords(entryAddr, encodedToken, version) === 0) {
          return entryAddr;
        }
      }
    } else {
      // Binary search
      this.logger.debug("Using binary search");
      let low = 0;
      let high = entryCount - 1;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const entryAddr = entriesStart + mid * entryLen;
        const comparison = this.compareTokenWords(
          entryAddr,
          encodedToken,
          version
        );

        if (comparison < 0) {
          low = mid + 1;
        } else if (comparison > 0) {
          high = mid - 1;
        } else {
          return entryAddr;
        }
      }
    }

    // Not found
    return 0;
  }

  /**
   * Compare encoded token words with a dictionary entry
   * @param entryAddr Address of dictionary entry
   * @param encodedTokenWords Array of encoded token words
   * @param version Z-machine version
   * @returns Comparison result (-1, 0, 1)
   */
  private compareTokenWords(
    entryAddr: Address,
    encodedTokenWords: number[],
    version: number
  ): number {
    let c = this.memory.getWord(entryAddr) - encodedTokenWords[0];

    if (c === 0 && encodedTokenWords.length > 1) {
      c = this.memory.getWord(entryAddr + 2) - encodedTokenWords[1];
    }

    if (version > 3 && c === 0 && encodedTokenWords.length > 2) {
      c = this.memory.getWord(entryAddr + 4) - encodedTokenWords[2];
    }

    return c;
  }

  /**
   * Encode a token string to Z-machine format
   * @param text Token text
   * @param padding Padding character (default 5)
   * @returns Array of encoded words
   */
  private encodeToken(text: string, padding: number = 5): number[] {
    this.logger.debug(`Encoding token: "${text}"`);

    const version = this.memory.getByte(HeaderLocation.Version);
    const resolution = version > 3 ? 3 : 2;

    // Truncate to max length
    text = text.slice(0, resolution * 3);

    // Convert to Z-characters
    const zchars: number[] = [];

    for (let i = 0; i < text.length; i++) {
      const char = text.charAt(i);
      let zchar: number;

      if (char >= "a" && char <= "z") {
        // A0: a-z -> 6-31
        zchar = char.charCodeAt(0) - "a".charCodeAt(0) + 6;
      } else if (char >= "A" && char <= "Z") {
        // Shift to A1 + a-z -> 6-31
        zchars.push(4); // Shift to A1
        zchar = char.charCodeAt(0) - "A".charCodeAt(0) + 6;
      } else {
        // Try to find in A2
        const a2Chars = " \n0123456789.,!?_#'\"/\\-:()";
        const a2Index = a2Chars.indexOf(char);

        if (a2Index >= 0) {
          zchars.push(5); // Shift to A2
          zchar = a2Index + 6;
        } else {
          // Unknown character, use padding
          zchar = padding;
        }
      }

      zchars.push(zchar);
    }

    // Pad to full length
    while (zchars.length < resolution * 3) {
      zchars.push(padding);
    }

    this.logger.debug(`Z-characters: ${zchars.join(",")}`);

    // Pack into words
    const words: number[] = [];
    for (let i = 0; i < resolution; i++) {
      const word =
        (zchars[i * 3] << 10) | (zchars[i * 3 + 1] << 5) | zchars[i * 3 + 2];
      words.push(word);
    }

    // Set terminator bit in the last word
    words[resolution - 1] |= 0x8000;

    this.logger.debug(
      `Encoded words: ${words.map((w) => "0x" + w.toString(16)).join(",")}`
    );

    return words;
  }

  /**
   * Debug method to dump parse buffer contents
   * @param parseBuffer Parse buffer address
   */
  private dumpParseBuffer(parseBuffer: Address): void {
    const max = this.memory.getByte(parseBuffer);
    const count = this.memory.getByte(parseBuffer + 1);

    this.logger.debug(`Parse buffer: max=${max}, count=${count}, tokens=[`);

    for (let i = 0; i < count; i++) {
      const addr = this.memory.getWord(parseBuffer + 2 + i * 4);
      const length = this.memory.getByte(parseBuffer + 4 + i * 4);
      const from = this.memory.getByte(parseBuffer + 5 + i * 4);

      this.logger.debug(
        `  (0x${addr.toString(16)}, ${length}, ${from})`
      );
    }

    this.logger.debug("]");
  }

  /**
  * For direct string tokenization (used in test input)
  * @param input Input string
  * @param parseBuffer Address of parse buffer
  */
  tokenizeString(input: string, parseBuffer: Address): void {
   // Reset parse buffer
   this.memory.setByte(parseBuffer + 1, 0);

   const dictAddr = this.memory.getWord(HeaderLocation.Dictionary);

   // Read separators
   const numSep = this.memory.getByte(dictAddr);
   const separators: number[] = [];

   for (let i = 0; i < numSep; i++) {
     separators.push(this.memory.getByte(dictAddr + 1 + i));
   }

   // Helper functions for character classification
   const isSeparator = (c: string): boolean => {
     return separators.includes(c.charCodeAt(0));
   };

   const CHAR_CLASS_SPACE = 2;
   const CHAR_CLASS_SEP = 1;
   const CHAR_CLASS_WORD = 0;

   const charClass = (c: string): number => {
     if (c === " ") return CHAR_CLASS_SPACE;
     if (isSeparator(c)) return CHAR_CLASS_SEP;
     return CHAR_CLASS_WORD;
   };

   // Process input characters
   const chars = input.split("");
   const classes = chars.map(charClass);

   for (let start = 0; start < chars.length; start++) {
     if (classes[start] === CHAR_CLASS_SPACE) {
       continue;
     }

     if (classes[start] === CHAR_CLASS_SEP) {
       this.tokenizeWord(input, start, start + 1, parseBuffer);
       continue;
     }

     // Process word characters
     let end;
     for (end = start + 1; end < chars.length; end++) {
       if (classes[end] !== CHAR_CLASS_WORD) {
         this.tokenizeWord(input, start, end, parseBuffer);
         start = end - 1;
         break;
       }
     }

     if (end === chars.length) {
       this.tokenizeWord(input, start, end, parseBuffer);
       break;
     }
   }

   this.dumpParseBuffer(parseBuffer);
 }

 /**
  * Tokenize a single word and add it to the parse buffer
  * @param input Complete input string
  * @param start Start position of word
  * @param end End position of word
  * @param parseBuffer Parse buffer address
  */
 private tokenizeWord(
   input: string,
   start: number,
   end: number,
   parseBuffer: Address
 ): void {
   const maxTokens = this.memory.getByte(parseBuffer);
   let countTokens = this.memory.getByte(parseBuffer + 1);

   if (countTokens >= maxTokens) {
     return;
   }

   const word = input.slice(start, end).toLowerCase();
   this.logger.debug(`Tokenizing word: "${word}"`);

   const dictAddr = this.memory.getWord(HeaderLocation.Dictionary);
   const encodedWords = this.encodeToken(word);
   const tokenAddr = this.lookupToken(dictAddr, encodedWords);

   if (tokenAddr !== 0) {
     const tokenStorage = 4 * countTokens + parseBuffer + 2;
     this.memory.setByte(parseBuffer + 1, ++countTokens);
     this.memory.setWord(tokenStorage, tokenAddr);
     this.memory.setByte(tokenStorage + 2, end - start);
     this.memory.setByte(tokenStorage + 3, start + 1);

     this.logger.debug(
       `Word stored: addr=${this.hexString(tokenAddr)}, len=${
         end - start
       }, pos=${start + 1}`
     );
   } else {
     this.logger.debug(`Word not found in dictionary`);
   }
 }
}
