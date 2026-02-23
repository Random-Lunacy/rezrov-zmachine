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

    it('should map printable range (32-126) to Font 3 graphics', () => {
      expect(font3ToUnicode(32)).toBe(' '); // Space stays space
      expect(font3ToUnicode(33)).toBe('\u2190'); // ← Left arrow
      expect(font3ToUnicode(34)).toBe('\u2192'); // → Right arrow
      expect(font3ToUnicode(38)).toBe('\u2500'); // ─ Horizontal line
      expect(font3ToUnicode(40)).toBe('\u2502'); // │ Vertical line
      expect(font3ToUnicode(47)).toBe('\u250C'); // ┌ Top-left corner
      expect(font3ToUnicode(48)).toBe('\u2510'); // ┐ Top-right corner
      expect(font3ToUnicode(49)).toBe('\u2518'); // ┘ Bottom-right corner
      expect(font3ToUnicode(54)).toBe('\u2588'); // █ Full block
      expect(font3ToUnicode(65)).toBe('\u2596'); // ▖ Quarter block (not 'A')
      expect(font3ToUnicode(97)).toBe('\u16AA'); // ᚪ Runic letter ac (not 'a')
      expect(font3ToUnicode(91)).toBe('\u253C'); // ┼ Box cross
      expect(font3ToUnicode(92)).toBe('\u2191'); // ↑ Up arrow
    });

    it('should return space for control characters (0-31)', () => {
      expect(font3ToUnicode(0)).toBe(' ');
      expect(font3ToUnicode(10)).toBe(' ');
      expect(font3ToUnicode(31)).toBe(' ');
    });

    it('should return space for unmapped codes', () => {
      // Code 127 (DEL) has no Font 3 mapping
      expect(font3ToUnicode(127)).toBe(' ');
    });

    it('should map edge indicator characters (71-74) to visible glyphs', () => {
      // Codes 71-74: Edge/corner indicators used by Beyond Zork for map stubs
      // (Bocfel leaves these as UNICODE_REPLACEMENT; we map to block elements)
      expect(font3ToUnicode(71)).toBe('\u2595'); // ▕ Right edge
      expect(font3ToUnicode(72)).toBe('\u2597'); // ▗ Lower right
      expect(font3ToUnicode(73)).toBe('\u258F'); // ▏ Left edge
      expect(font3ToUnicode(74)).toBe('\u2598'); // ▘ Upper left
    });
  });

  describe('font3StringToUnicode', () => {
    it('should convert an array of codes to Unicode string', () => {
      const codes = [128, 129, 130, 131]; // ─│┌┐
      const result = font3StringToUnicode(codes);
      expect(result).toBe('\u2500\u2502\u250C\u2510');
    });

    it('should handle mixed printable and extended Font 3 codes', () => {
      // Code 65 = ▖, 128 = ─, 66 = ▘, 129 = │
      const codes = [65, 128, 66, 129];
      const result = font3StringToUnicode(codes);
      expect(result).toBe('\u2596\u2500\u2598\u2502');
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

    it('should map ASCII text to Font 3 graphics', () => {
      // 'elf' chars map to Font 3 runes, not ASCII passthrough
      // e=101(ᛖ) l=108(ᛚ) f=102(ᚠ)
      const text = 'elf';
      const result = translateFont3Text(text);
      expect(result).toBe('\u16D6\u16DA\u16A0');
    });

    it('should handle mixed content', () => {
      const text = String.fromCharCode(47, 38, 48); // ┌─┐
      const result = translateFont3Text(text);
      expect(result).toBe('\u250C\u2500\u2510');
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

    it('should return true for printable range codes (32-126)', () => {
      expect(hasFont3Mapping(65)).toBe(true);
      expect(hasFont3Mapping(32)).toBe(true);
      expect(hasFont3Mapping(97)).toBe(true);
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
    it('should correctly render a simple box using printable range codes', () => {
      // Beyond Zork uses printable range codes for map borders:
      // Code 47=┌, 38=─, 48=┐, 40=│, 46=└, 49=┘
      const topRow = [47, 38, 48]; // ┌─┐
      const midRow = [40, 32, 40]; // │ │
      const botRow = [46, 38, 49]; // └─┘

      expect(font3StringToUnicode(topRow)).toBe('\u250C\u2500\u2510');
      expect(font3StringToUnicode(midRow)).toBe('\u2502 \u2502');
      expect(font3StringToUnicode(botRow)).toBe('\u2514\u2500\u2518');
    });

    it('should correctly render directional arrows', () => {
      // Printable range arrows: 33=←, 34=→, 92=↑, 93=↓
      expect(font3ToUnicode(33)).toBe('\u2190'); // ←
      expect(font3ToUnicode(34)).toBe('\u2192'); // →
      expect(font3ToUnicode(92)).toBe('\u2191'); // ↑
      expect(font3ToUnicode(93)).toBe('\u2193'); // ↓
    });

    it('should correctly render block graphics', () => {
      // Block elements used for room/connection fills
      expect(font3ToUnicode(54)).toBe('\u2588'); // █ Full block
      expect(font3ToUnicode(55)).toBe('\u2580'); // ▀ Upper half
      expect(font3ToUnicode(56)).toBe('\u2584'); // ▄ Lower half
      expect(font3ToUnicode(57)).toBe('\u258C'); // ▌ Left half
      expect(font3ToUnicode(58)).toBe('\u2590'); // ▐ Right half
    });

    it('should correctly render runic characters', () => {
      // Runes mapped to lowercase a-z
      expect(font3ToUnicode(97)).toBe('\u16AA'); // ᚪ (a)
      expect(font3ToUnicode(102)).toBe('\u16A0'); // ᚠ (f)
      expect(font3ToUnicode(122)).toBe('\u16DF'); // ᛟ (z)
    });
  });
});
