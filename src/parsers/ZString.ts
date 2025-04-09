import { Memory } from "../core/memory/Memory";
import { ZSCII } from "../types";

export type ZString = Array<ZSCII>;

const alphabet_table = [
  /* A0 */ "abcdefghijklmnopqrstuvwxyz",
  /* A1 */ "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  /* A2 */ " \n0123456789.,!?_#'\"/\\-:()",
];

export function decodeZString(
  memory: Memory,
  zstr: ZString,
  expand: boolean = false
): string {
  // Various state things, like alphabet
  let alphabet = 0;
  const result: Array<string> = [];

  for (let i = 0; i < zstr.length; i++) {
    const z = zstr[i];

    if (z < 6) {
      switch (z) {
        case 0:
          result.push(" ");
          break;
        case 1:
        case 2:
        case 3: {
          if (!expand) {
            // Skip abbreviations if not expanding
            continue;
          }

          const x = zstr[++i];
          const entry = 32 * (z - 1) + x;
          const abbrevTableAddr = memory.getWord(0x18); // Abbreviations table address is at 0x18 in header
          const abbrevAddr = memory.getWord(abbrevTableAddr + entry * 2) * 2;

          // Decode the abbreviation (recursive call)
          const abbrevText = decodeZString(
            memory,
            memory.getZString(abbrevAddr),
            false
          );
          result.push(abbrevText);
          break;
        }
        case 4:
          // Shift to A1 (upper case)
          alphabet = 1;
          break;
        case 5:
          // Shift to A2 (symbols)
          alphabet = 2;
          break;
      }
    } else if (z == 6 && alphabet === 2) {
      // Z-character 6 from A2 means the next two Z-characters specify a ten-bit ZSCII character code
      const z1 = zstr[++i];
      const z2 = zstr[++i];

      const combinedChar = (z1 << 5) + z2;
      result.push(String.fromCharCode(combinedChar));
      alphabet = 0;
    } else {
      // Regular character from current alphabet
      result.push(alphabet_table[alphabet][z - 6]);
      alphabet = 0;
    }
  }

  return result.join("");
}

export function encodeZString(text: string, padding: number = 0x05): ZString {
  const version = 3; // Assume version 3 for encoding
  const resolution = version > 3 ? 3 : 2;

  // Chop it off at resolution*3 characters (the max for that version)
  text = text.slice(0, resolution * 3).toLowerCase();
  const zchars: Array<number> = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    // Very simplified encoding - just handle lowercase letters for now
    if (char >= "a" && char <= "z") {
      zchars.push(alphabet_table[0].indexOf(char) + 6);
    } else {
      // Try to find character in alphabet 2
      const indexInA2 = alphabet_table[2].indexOf(char);
      if (indexInA2 !== -1) {
        zchars.push(5); // Shift to A2
        zchars.push(indexInA2 + 6);
      } else {
        // Default padding if character not found
        zchars.push(padding);
      }
    }
  }

  // Pad to full length
  while (zchars.length < resolution * 3) {
    zchars.push(padding);
  }

  return zchars;
}

/**
 * Convert a Z-string address to a packed address based on version
 * @param memory Memory object
 * @param addr Address to pack
 * @returns Packed address
 */
export function packStringAddress(memory: Memory, addr: number): number {
  const version = memory.getByte(0x00);

  if (version <= 3) {
    return addr / 2;
  } else if (version <= 5) {
    return addr / 4;
  } else if (version <= 7) {
    const stringsOffset = memory.getWord(0x2a);
    return (addr - stringsOffset) / 4;
  } else if (version == 8) {
    return addr / 8;
  } else {
    throw new Error(`Unknown Z-machine version: ${version}`);
  }
}

/**
 * Convert a packed address to a real memory address
 * @param memory Memory object
 * @param packedAddr Packed address
 * @returns Real memory address
 */
export function unpackStringAddress(
  memory: Memory,
  packedAddr: number
): number {
  const version = memory.getByte(0x00);

  if (version <= 3) {
    return packedAddr * 2;
  } else if (version <= 5) {
    return packedAddr * 4;
  } else if (version <= 7) {
    const stringsOffset = memory.getWord(0x2a);
    return packedAddr * 4 + stringsOffset;
  } else if (version == 8) {
    return packedAddr * 8;
  } else {
    throw new Error(`Unknown Z-machine version: ${version}`);
  }
}
