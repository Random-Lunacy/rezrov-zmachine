import { describe, it, expect } from 'vitest';
import { FONT3_BITMAPS, getFont3Bitmap, hasFont3Bitmap, getAvailableFont3Codes } from '../../../../src/ui/fonts/Font3Bitmaps';

describe('Font3Bitmaps', () => {
  describe('FONT3_BITMAPS', () => {
    it('should contain bitmap data for all 256 character codes', () => {
      expect(Object.keys(FONT3_BITMAPS)).toHaveLength(256);
      
      // Check that all codes 0-255 are present
      for (let i = 0; i < 256; i++) {
        expect(FONT3_BITMAPS[i]).toBeDefined();
        expect(FONT3_BITMAPS[i]).toBeInstanceOf(Uint8Array);
        expect(FONT3_BITMAPS[i]).toHaveLength(8);
      }
    });

    it('should have proper bitmap data for control characters', () => {
      // Control characters (0-31) should be empty
      for (let i = 0; i < 32; i++) {
        expect(FONT3_BITMAPS[i]).toEqual(new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));
      }
    });

    it('should have proper bitmap data for space character', () => {
      // Space character (32) should be empty
      expect(FONT3_BITMAPS[32]).toEqual(new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));
    });

    it('should have proper bitmap data for printable ASCII', () => {
      // Check a few printable ASCII characters
      expect(FONT3_BITMAPS[33]).toBeDefined(); // !
      expect(FONT3_BITMAPS[65]).toBeDefined(); // A
      expect(FONT3_BITMAPS[97]).toBeDefined(); // a
      expect(FONT3_BITMAPS[126]).toBeDefined(); // ~
    });

    it('should have proper bitmap data for box drawing characters', () => {
      // Box drawing characters (128-159) should have meaningful patterns
      expect(FONT3_BITMAPS[128]).toBeDefined(); // ─ (horizontal line)
      expect(FONT3_BITMAPS[129]).toBeDefined(); // │ (vertical line)
      expect(FONT3_BITMAPS[130]).toBeDefined(); // ┌ (top-left corner)
      expect(FONT3_BITMAPS[131]).toBeDefined(); // ┐ (top-right corner)
      expect(FONT3_BITMAPS[132]).toBeDefined(); // └ (bottom-left corner)
      expect(FONT3_BITMAPS[133]).toBeDefined(); // ┘ (bottom-right corner)
      expect(FONT3_BITMAPS[134]).toBeDefined(); // ├ (left T-junction)
      expect(FONT3_BITMAPS[135]).toBeDefined(); // ┤ (right T-junction)
      expect(FONT3_BITMAPS[136]).toBeDefined(); // ┬ (top T-junction)
      expect(FONT3_BITMAPS[137]).toBeDefined(); // ┴ (bottom T-junction)
      expect(FONT3_BITMAPS[138]).toBeDefined(); // ┼ (cross junction)
    });

    it('should have proper bitmap data for arrow characters', () => {
      // Arrow characters (160-175) should have directional patterns
      expect(FONT3_BITMAPS[160]).toBeDefined(); // ↑ (up arrow)
      expect(FONT3_BITMAPS[161]).toBeDefined(); // ↓ (down arrow)
      expect(FONT3_BITMAPS[162]).toBeDefined(); // ← (left arrow)
      expect(FONT3_BITMAPS[163]).toBeDefined(); // → (right arrow)
      expect(FONT3_BITMAPS[164]).toBeDefined(); // ↗ (diagonal up-right)
      expect(FONT3_BITMAPS[165]).toBeDefined(); // ↙ (diagonal down-left)
      expect(FONT3_BITMAPS[166]).toBeDefined(); // ↖ (diagonal up-left)
      expect(FONT3_BITMAPS[167]).toBeDefined(); // ↘ (diagonal down-right)
    });

    it('should have proper bitmap data for runic characters', () => {
      // Runic characters (176-207) should have runic patterns
      expect(FONT3_BITMAPS[176]).toBeDefined(); // ᚠ (feoh)
      expect(FONT3_BITMAPS[177]).toBeDefined(); // ᚢ (ur)
      expect(FONT3_BITMAPS[178]).toBeDefined(); // ᚦ (thorn)
      expect(FONT3_BITMAPS[179]).toBeDefined(); // ᚩ (os)
      expect(FONT3_BITMAPS[180]).toBeDefined(); // ᚱ (rad)
    });

    it('should have proper bitmap data for special symbols', () => {
      // Special symbols (208-255) should have graphic patterns
      expect(FONT3_BITMAPS[208]).toBeDefined(); // ● (filled circle)
      expect(FONT3_BITMAPS[209]).toBeDefined(); // ○ (empty circle)
      expect(FONT3_BITMAPS[210]).toBeDefined(); // ■ (filled square)
      expect(FONT3_BITMAPS[211]).toBeDefined(); // □ (empty square)
    });
  });

  describe('getFont3Bitmap', () => {
    it('should return bitmap data for valid codes', () => {
      const bitmap = getFont3Bitmap(128);
      expect(bitmap).toBeDefined();
      expect(bitmap).toBeInstanceOf(Uint8Array);
      expect(bitmap).toHaveLength(8);
    });

    it('should return undefined for invalid codes', () => {
      const bitmap = getFont3Bitmap(300);
      expect(bitmap).toBeUndefined();
    });

    it('should return correct bitmap for specific characters', () => {
      // Test horizontal line character
      const horizontalLine = getFont3Bitmap(128);
      expect(horizontalLine).toEqual(new Uint8Array([0x00, 0x00, 0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0x00]));

      // Test vertical line character
      const verticalLine = getFont3Bitmap(129);
      expect(verticalLine).toEqual(new Uint8Array([0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18]));

      // Test up arrow character
      const upArrow = getFont3Bitmap(160);
      expect(upArrow).toEqual(new Uint8Array([0x18, 0x3C, 0x7E, 0xFF, 0x18, 0x18, 0x18, 0x18]));
    });
  });

  describe('hasFont3Bitmap', () => {
    it('should return true for valid codes', () => {
      expect(hasFont3Bitmap(0)).toBe(true);
      expect(hasFont3Bitmap(32)).toBe(true);
      expect(hasFont3Bitmap(128)).toBe(true);
      expect(hasFont3Bitmap(160)).toBe(true);
      expect(hasFont3Bitmap(176)).toBe(true);
      expect(hasFont3Bitmap(208)).toBe(true);
      expect(hasFont3Bitmap(255)).toBe(true);
    });

    it('should return false for invalid codes', () => {
      expect(hasFont3Bitmap(-1)).toBe(false);
      expect(hasFont3Bitmap(256)).toBe(false);
      expect(hasFont3Bitmap(300)).toBe(false);
    });
  });

  describe('getAvailableFont3Codes', () => {
    it('should return all available codes', () => {
      const codes = getAvailableFont3Codes();
      expect(codes).toHaveLength(256);
      expect(codes[0]).toBe(0);
      expect(codes[255]).toBe(255);
      
      // Check that all codes are present
      for (let i = 0; i < 256; i++) {
        expect(codes).toContain(i);
      }
    });

    it('should return codes in ascending order', () => {
      const codes = getAvailableFont3Codes();
      for (let i = 1; i < codes.length; i++) {
        expect(codes[i]).toBeGreaterThan(codes[i - 1]);
      }
    });
  });

  describe('bitmap data integrity', () => {
    it('should have valid bitmap data for all characters', () => {
      for (let i = 0; i < 256; i++) {
        const bitmap = FONT3_BITMAPS[i];
        expect(bitmap).toBeDefined();
        expect(bitmap).toBeInstanceOf(Uint8Array);
        expect(bitmap).toHaveLength(8);
        
        // Each byte should be a valid 8-bit value
        for (let j = 0; j < 8; j++) {
          expect(bitmap[j]).toBeGreaterThanOrEqual(0);
          expect(bitmap[j]).toBeLessThanOrEqual(255);
        }
      }
    });

    it('should have meaningful patterns for key characters', () => {
      // Horizontal line should have horizontal pattern
      const horizontalLine = FONT3_BITMAPS[128];
      expect(horizontalLine[2]).toBe(0xFF); // Middle rows should be solid
      expect(horizontalLine[3]).toBe(0xFF);
      expect(horizontalLine[4]).toBe(0xFF);
      expect(horizontalLine[5]).toBe(0xFF);

      // Vertical line should have vertical pattern
      const verticalLine = FONT3_BITMAPS[129];
      expect(verticalLine[0]).toBe(0x18); // All rows should have vertical pattern
      expect(verticalLine[1]).toBe(0x18);
      expect(verticalLine[2]).toBe(0x18);
      expect(verticalLine[3]).toBe(0x18);
      expect(verticalLine[4]).toBe(0x18);
      expect(verticalLine[5]).toBe(0x18);
      expect(verticalLine[6]).toBe(0x18);
      expect(verticalLine[7]).toBe(0x18);

      // Up arrow should have arrow pattern
      const upArrow = FONT3_BITMAPS[160];
      expect(upArrow[3]).toBe(0xFF); // Tip of arrow
      expect(upArrow[7]).toBe(0x18); // Base of arrow
    });
  });
});
