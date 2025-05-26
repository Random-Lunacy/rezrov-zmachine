import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { decodeZString, GameObjectFactory, HeaderLocation, Logger, LogLevel, Memory } from '../dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runStringDumpExample(storyFilePath: string): Promise<void> {
  const logger = new Logger('StringDumpExample');
  Logger.setLevel(LogLevel.INFO);
  logger.info(`Loading Z-machine story file: ${storyFilePath}`);

  try {
    const storyData = fs.readFileSync(storyFilePath);
    logger.info(`Loaded ${storyData.length} bytes from story file`);

    const memory = new Memory(storyData);
    const version = memory.getByte(HeaderLocation.Version);

    // Get memory boundaries from the header
    const highMemBase = memory.getWord(HeaderLocation.HighMemBase);
    const staticMemBase = memory.getWord(HeaderLocation.StaticMemBase);
    const objectTableAddr = memory.getWord(HeaderLocation.ObjectTable);
    const dictionaryAddr = memory.getWord(HeaderLocation.Dictionary);

    logger.info(`Z-machine version: ${version}`);
    logger.info(`High memory base: 0x${highMemBase.toString(16)}`);
    logger.info(`Static memory base: 0x${staticMemBase.toString(16)}`);
    logger.info(`Object table at: 0x${objectTableAddr.toString(16)}`);
    logger.info(`Dictionary at: 0x${dictionaryAddr.toString(16)}`);

    // --- First Pass: Extract strings from known locations ---

    // 1. Extract strings from object short names (guaranteed accuracy)
    logger.info('\n----- Object Names -----');
    const factory = new GameObjectFactory(memory, version, objectTableAddr, { logger });
    const allObjects = factory.getAllObjects();

    let objectStrings = 0;
    allObjects.forEach((obj) => {
      const objName = obj.name;
      if (objName && objName.trim().length > 0) {
        logger.info(`Object ${obj.objNum}: "${objName}"`);
        objectStrings++;
      }
    });
    logger.info(`Found ${objectStrings} strings in object names\n`);

    // 2. Dictionary words (if available)
    logger.info('----- Dictionary Words -----');
    let dictionaryStrings = 0;

    try {
      // Read dictionary header
      const separatorCount = memory.getByte(dictionaryAddr);
      // Skip separators
      const entryLength = memory.getByte(dictionaryAddr + separatorCount + 1);
      const entryCount = memory.getWord(dictionaryAddr + separatorCount + 2);

      logger.info(`Dictionary contains ${entryCount} entries of ${entryLength} bytes each`);

      // Dictionary entry table starts after the header
      const entryTableAddr = dictionaryAddr + separatorCount + 4;

      // Sample the first 50 dictionary entries (or fewer if dictionary is smaller)
      const maxEntriesToShow = Math.min(50, entryCount);
      for (let i = 0; i < maxEntriesToShow; i++) {
        const entryAddr = entryTableAddr + i * entryLength;

        // In most Z-Machine versions, the first 4 or 6 bytes of a dictionary
        // entry are the encoded text of the word
        const wordBytes = version <= 3 ? 4 : 6;

        // We'll use a specialized method to decode dictionary entries
        try {
          // Extract the encoded bytes
          const encodedWord: number[] = [];
          for (let j = 0; j < wordBytes; j += 2) {
            encodedWord.push(memory.getWord(entryAddr + j));
          }

          // Convert the encoded word to an array of Z-characters
          const zchars: number[] = [];
          for (const word of encodedWord) {
            zchars.push((word >> 10) & 0x1f); // First 5 bits
            zchars.push((word >> 5) & 0x1f); // Second 5 bits
            zchars.push(word & 0x1f); // Third 5 bits
          }

          // Decode the Z-characters
          const zString = zchars;
          const decodedWord = decodeZString(memory, zString);

          if (decodedWord && decodedWord.trim().length > 0) {
            logger.info(`Dictionary[${i}]: "${decodedWord}"`);
            dictionaryStrings++;
          }
        } catch (e) {
          // Skip failed dictionary entries
        }
      }

      if (entryCount > maxEntriesToShow) {
        logger.info(`... and ${entryCount - maxEntriesToShow} more entries`);
      }
    } catch (e) {
      logger.warn(`Error reading dictionary: ${e instanceof Error ? e.message : String(e)}`);
    }

    logger.info(`Found ${dictionaryStrings} strings in dictionary\n`);

    // --- Second Pass: Scan high memory for strings ---
    logger.info('----- High Memory Strings -----');

    // Define confidence levels for string detection
    const enum Confidence {
      HIGH = 'HIGH',
      MEDIUM = 'MED',
      LOW = 'LOW',
    }

    interface StringCandidate {
      address: number;
      content: string;
      confidence: Confidence;
    }

    const stringCandidates: StringCandidate[] = [];

    // Start at high memory and scan forward
    const scanStart = highMemBase;
    const scanEnd = memory.size - 2; // Need at least 2 bytes for a string

    // Track seen addresses to avoid duplicates
    const seenAddresses = new Set<number>();

    for (let addr = scanStart; addr < scanEnd; addr += 2) {
      if (seenAddresses.has(addr)) {
        continue;
      }

      try {
        // Look for potential strings (words with top bit set that eventually end)
        const firstWord = memory.getWord(addr);

        // Check if this could be a string (Z-strings have the high bit set in the final word)
        if ((firstWord & 0x8000) !== 0) {
          const zString = memory.getZString(addr);
          const decodedString = decodeZString(memory, zString);

          // Skip the word sequence we just read
          const zCharsCount = zString.length;
          const wordsUsed = Math.ceil((zCharsCount * 5) / 16);
          for (let i = 0; i < wordsUsed; i++) {
            seenAddresses.add(addr + i * 2);
          }

          // Apply validation heuristics
          if (decodedString && decodedString.length > 0) {
            let confidence = Confidence.LOW;

            // Evaluate the string quality
            // 1. Strings with printable characters and reasonable length are more likely
            if (decodedString.length > 2 && /[a-zA-Z]/.test(decodedString)) {
              confidence = Confidence.MEDIUM;

              // 2. Strings with proper sentence structure are even more likely
              if (/^[A-Z].*[.!?"]$/.test(decodedString) || /^".*"$/.test(decodedString)) {
                confidence = Confidence.HIGH;
              }
            }

            // Only add strings that seem reasonable
            if (confidence !== Confidence.LOW || decodedString.length > 4) {
              stringCandidates.push({
                address: addr,
                content: decodedString,
                confidence,
              });
            }
          }
        }
      } catch (error) {
        // Skip addresses that cause errors when trying to decode
        continue;
      }
    }

    // Sort string candidates by confidence and address
    stringCandidates.sort((a, b) => {
      // First sort by confidence (HIGH > MEDIUM > LOW)
      const confidenceOrder = {
        [Confidence.HIGH]: 0,
        [Confidence.MEDIUM]: 1,
        [Confidence.LOW]: 2,
      };

      const confidenceDiff = confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
      if (confidenceDiff !== 0) return confidenceDiff;

      // Then by address (ascending)
      return a.address - b.address;
    });

    // Output the discovered strings
    const maxHighMemStrings = 100; // Limit output
    const stringsToShow = Math.min(maxHighMemStrings, stringCandidates.length);

    for (let i = 0; i < stringsToShow; i++) {
      const candidate = stringCandidates[i];
      logger.info(`[${candidate.confidence}] 0x${candidate.address.toString(16)}: "${candidate.content}"`);
    }

    if (stringCandidates.length > maxHighMemStrings) {
      logger.info(`... and ${stringCandidates.length - maxHighMemStrings} more strings`);
    }

    logger.info(`Found ${stringCandidates.length} potential strings in high memory`);

    // Output summary
    logger.info('\n----- String Extraction Summary -----');
    logger.info(`Object strings: ${objectStrings}`);
    logger.info(`Dictionary strings: ${dictionaryStrings}`);
    logger.info(`High memory strings: ${stringCandidates.length}`);
    logger.info(`Total strings found: ${objectStrings + dictionaryStrings + stringCandidates.length}`);
  } catch (error) {
    logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logger.debug(error.stack);
    }
  }
}

// Main execution
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const storyPath = process.argv[2] || path.join(__dirname, '../tests/fixtures/minimal.z3');
  const logger = new Logger('StringDumpExample');
  logger.info(`Running StringDumpExample with story file: ${storyPath}`);

  runStringDumpExample(storyPath)
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error(`Unhandled error: ${err}`);
      process.exit(1);
    });
}

export { runStringDumpExample };
