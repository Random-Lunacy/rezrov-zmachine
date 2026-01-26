/**
 * Font3Unicode Unit Tests
 *
 * Tests the Font 3 to Unicode character mapping for terminal display
 */

import { describe, expect, it } from 'vitest';
import {
  font3StringToUnicode,
  font3ToUnicode,
  getArrowCharacters,
  getBoxDrawingCharacters,
  getFont3Category,
  getRunicCharacters,
  getSpecialCharacters,
  hasFont3Mapping,
  translateFont3Text,
} from '../../../../src/ui/fonts/Font3Unicode';

describe('Font3Unicode', () => {
  describe('font3ToUnicode', () => {
    it('should map box drawing characters correctly', () => {
      // Horizontal line
      expect(font3ToUnicode(128)).toBe('\u2500'); // ─
      // Vertical line
      expect(font3ToUnicode(129)).toBe('\u2502'); // │
      // Corners
      expect(font3ToUnicode(130)).toBe('\u250C'); // ┌
      expect(font3ToUnicode(131)).toBe('\u2510'); // ┐
      expect(font3ToUnicode(132)).toBe('\u2514'); // └
      expect(font3ToUnicode(133)).toBe('\u2518'); // ┘
      // T-junctions
      expect(font3ToUnicode(134)).toBe('\u251C'); // ├
      expect(font3ToUnicode(135)).toBe('\u2524'); // ┤
      expect(font3ToUnicode(136)).toBe('\u252C'); // ┬
      expect(font3ToUnicode(137)).toBe('\u2534'); // ┴
      // Cross
      expect(font3ToUnicode(138)).toBe('\u253C'); // ┼
    });

    it('should map double-line box drawing characters', () => {
      expect(font3ToUnicode(139)).toBe('\u2550'); // ═
      expect(font3ToUnicode(140)).toBe('\u2551'); // ║
      expect(font3ToUnicode(141)).toBe('\u2554'); // ╔
      expect(font3ToUnicode(142)).toBe('\u2557'); // ╗
      expect(font3ToUnicode(143)).toBe('\u255A'); // ╚
      expect(font3ToUnicode(144)).toBe('\u255D'); // ╝
    });

    it('should map arrow characters correctly', () => {
      expect(font3ToUnicode(160)).toBe('\u2191'); // ↑
      expect(font3ToUnicode(161)).toBe('\u2193'); // ↓
      expect(font3ToUnicode(162)).toBe('\u2190'); // ←
      expect(font3ToUnicode(163)).toBe('\u2192'); // →
      expect(font3ToUnicode(164)).toBe('\u2197'); // ↗
      expect(font3ToUnicode(165)).toBe('\u2199'); // ↙
      expect(font3ToUnicode(166)).toBe('\u2196'); // ↖
      expect(font3ToUnicode(167)).toBe('\u2198'); // ↘
    });

    it('should map runic characters correctly', () => {
      expect(font3ToUnicode(176)).toBe('\u16A0'); // ᚠ Fehu
      expect(font3ToUnicode(177)).toBe('\u16A2'); // ᚢ Uruz
      expect(font3ToUnicode(178)).toBe('\u16A6'); // ᚦ Thurisaz
    });

    it('should map special symbols correctly', () => {
      expect(font3ToUnicode(208)).toBe('\u25CF'); // ● Black Circle
      expect(font3ToUnicode(209)).toBe('\u25CB'); // ○ White Circle
      expect(font3ToUnicode(210)).toBe('\u25A0'); // ■ Black Square
      expect(font3ToUnicode(211)).toBe('\u25A1'); // □ White Square
      expect(font3ToUnicode(212)).toBe('\u2588'); // █ Full Block
    });

    it('should pass through standard ASCII characters (32-126)', () => {
      expect(font3ToUnicode(32)).toBe(' ');
      expect(font3ToUnicode(65)).toBe('A');
      expect(font3ToUnicode(97)).toBe('a');
      expect(font3ToUnicode(48)).toBe('0');
      expect(font3ToUnicode(126)).toBe('~');
    });

    it('should return space for control characters (0-31)', () => {
      expect(font3ToUnicode(0)).toBe(' ');
      expect(font3ToUnicode(10)).toBe(' ');
      expect(font3ToUnicode(31)).toBe(' ');
    });

    it('should return replacement character for unmapped codes', () => {
      // Code 127 (DEL) is in ASCII range but not a printable character
      // It should be returned as-is since it's in the 32-126 range check
      // Actually 127 is outside 32-126, so it will be the replacement char
      expect(font3ToUnicode(127)).toBe('\uFFFD');
    });
  });

  describe('font3StringToUnicode', () => {
    it('should convert an array of codes to Unicode string', () => {
      const codes = [128, 129, 130, 131]; // ─│┌┐
      const result = font3StringToUnicode(codes);
      expect(result).toBe('\u2500\u2502\u250C\u2510');
    });

    it('should handle mixed ASCII and Font 3 codes', () => {
      const codes = [65, 128, 66, 129]; // A─B│
      const result = font3StringToUnicode(codes);
      expect(result).toBe('A\u2500B\u2502');
    });

    it('should handle empty array', () => {
      expect(font3StringToUnicode([])).toBe('');
    });
  });

  describe('translateFont3Text', () => {
    it('should translate a text string with Font 3 encoded characters', () => {
      // Create a string with character codes 128, 129
      const text = String.fromCharCode(128, 129);
      const result = translateFont3Text(text);
      expect(result).toBe('\u2500\u2502');
    });

    it('should preserve standard ASCII text', () => {
      const text = 'Hello';
      const result = translateFont3Text(text);
      expect(result).toBe('Hello');
    });

    it('should handle mixed content', () => {
      const text = 'Room' + String.fromCharCode(128) + 'Exit';
      const result = translateFont3Text(text);
      expect(result).toBe('Room\u2500Exit');
    });

    it('should handle empty string', () => {
      expect(translateFont3Text('')).toBe('');
    });
  });

  describe('hasFont3Mapping', () => {
    it('should return true for mapped box drawing codes', () => {
      expect(hasFont3Mapping(128)).toBe(true);
      expect(hasFont3Mapping(138)).toBe(true);
    });

    it('should return true for mapped arrow codes', () => {
      expect(hasFont3Mapping(160)).toBe(true);
      expect(hasFont3Mapping(163)).toBe(true);
    });

    it('should return true for mapped runic codes', () => {
      expect(hasFont3Mapping(176)).toBe(true);
      expect(hasFont3Mapping(207)).toBe(true);
    });

    it('should return true for mapped special codes', () => {
      expect(hasFont3Mapping(208)).toBe(true);
      expect(hasFont3Mapping(255)).toBe(true);
    });

    it('should return false for ASCII codes (no specific mapping)', () => {
      expect(hasFont3Mapping(65)).toBe(false);
      expect(hasFont3Mapping(32)).toBe(false);
    });

    it('should return false for control characters', () => {
      expect(hasFont3Mapping(0)).toBe(false);
      expect(hasFont3Mapping(31)).toBe(false);
    });
  });

  describe('getFont3Category', () => {
    it('should categorize control characters', () => {
      expect(getFont3Category(0)).toBe('control');
      expect(getFont3Category(31)).toBe('control');
    });

    it('should categorize ASCII characters', () => {
      expect(getFont3Category(32)).toBe('ascii');
      expect(getFont3Category(65)).toBe('ascii');
      expect(getFont3Category(127)).toBe('ascii');
    });

    it('should categorize box drawing characters', () => {
      expect(getFont3Category(128)).toBe('box');
      expect(getFont3Category(159)).toBe('box');
    });

    it('should categorize arrow characters', () => {
      expect(getFont3Category(160)).toBe('arrow');
      expect(getFont3Category(175)).toBe('arrow');
    });

    it('should categorize runic characters', () => {
      expect(getFont3Category(176)).toBe('runic');
      expect(getFont3Category(207)).toBe('runic');
    });

    it('should categorize special characters', () => {
      expect(getFont3Category(208)).toBe('special');
      expect(getFont3Category(255)).toBe('special');
    });
  });

  describe('getBoxDrawingCharacters', () => {
    it('should return all box drawing character mappings', () => {
      const boxChars = getBoxDrawingCharacters();
      expect(Object.keys(boxChars).length).toBeGreaterThan(0);
      expect(boxChars[128]).toBe('\u2500');
      expect(boxChars[129]).toBe('\u2502');
    });
  });

  describe('getArrowCharacters', () => {
    it('should return all arrow character mappings', () => {
      const arrowChars = getArrowCharacters();
      expect(Object.keys(arrowChars).length).toBeGreaterThan(0);
      expect(arrowChars[160]).toBe('\u2191');
      expect(arrowChars[161]).toBe('\u2193');
    });
  });

  describe('getRunicCharacters', () => {
    it('should return all runic character mappings', () => {
      const runicChars = getRunicCharacters();
      expect(Object.keys(runicChars).length).toBeGreaterThan(0);
      expect(runicChars[176]).toBe('\u16A0');
    });
  });

  describe('getSpecialCharacters', () => {
    it('should return all special character mappings', () => {
      const specialChars = getSpecialCharacters();
      expect(Object.keys(specialChars).length).toBeGreaterThan(0);
      expect(specialChars[208]).toBe('\u25CF');
    });
  });

  describe('Beyond Zork map rendering', () => {
    it('should correctly render a simple box', () => {
      // A simple 3x3 box: ┌─┐
      //                   │ │
      //                   └─┘
      const topRow = [130, 128, 131]; // ┌─┐
      const midRow = [129, 32, 129]; // │ │
      const botRow = [132, 128, 133]; // └─┘

      expect(font3StringToUnicode(topRow)).toBe('\u250C\u2500\u2510');
      expect(font3StringToUnicode(midRow)).toBe('\u2502 \u2502');
      expect(font3StringToUnicode(botRow)).toBe('\u2514\u2500\u2518');
    });

    it('should correctly render directional arrows for exits', () => {
      // North: ↑, South: ↓, East: →, West: ←
      const exits = [160, 161, 163, 162];
      expect(font3StringToUnicode(exits)).toBe('\u2191\u2193\u2192\u2190');
    });
  });
});
