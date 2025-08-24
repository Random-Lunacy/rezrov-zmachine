import { describe, it, expect, beforeEach } from 'vitest';
import { Font3System, Font3Character } from '../../../../src/ui/fonts/Font3System';

describe('Font3System', () => {
  let fontSystem: Font3System;

  beforeEach(() => {
    fontSystem = Font3System.getInstance();
  });

  describe('getInstance', () => {
    it('should return the same instance', () => {
      const instance1 = Font3System.getInstance();
      const instance2 = Font3System.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getDefaultFont', () => {
    it('should return a font with correct properties', () => {
      const font = fontSystem.getDefaultFont();

      expect(font.name).toBe('Font 3 Standard');
      expect(font.height).toBe(8);
      expect(font.width).toBe(8);
      expect(font.fixedPitch).toBe(true);
      expect(font.characters.size).toBe(256); // All 256 character codes
    });
  });

  describe('getCharacter', () => {
    it('should return character for valid codes', () => {
      const char = fontSystem.getCharacter(128);
      expect(char).toBeDefined();
      expect(char?.code).toBe(128);
      expect(char?.isBoxDrawing).toBe(true);
    });

    it('should return undefined for invalid codes', () => {
      const char = fontSystem.getCharacter(300);
      expect(char).toBeUndefined();
    });
  });

  describe('isFont3Character', () => {
    it('should return true for valid Font 3 characters', () => {
      expect(fontSystem.isFont3Character(128)).toBe(true);
      expect(fontSystem.isFont3Character(160)).toBe(true);
      expect(fontSystem.isFont3Character(176)).toBe(true);
    });

    it('should return false for invalid characters', () => {
      expect(fontSystem.isFont3Character(300)).toBe(false);
    });
  });

  describe('renderCharacter', () => {
    it('should render box drawing characters correctly', () => {
      const pixels = fontSystem.renderCharacter(128); // Horizontal line
      expect(pixels).toBeDefined();
      expect(pixels).toHaveLength(8);
      expect(pixels![0]).toHaveLength(8);

      // Check that middle rows have horizontal lines
      for (let row = 2; row < 6; row++) {
        for (let col = 0; col < 8; col++) {
          expect(pixels![row][col]).toBe(true);
        }
      }
    });

    it('should render vertical line character correctly', () => {
      const pixels = fontSystem.renderCharacter(129); // Vertical line
      expect(pixels).toBeDefined();

      // Check that middle columns have vertical lines
      for (let row = 0; row < 8; row++) {
        for (let col = 3; col < 5; col++) {
          expect(pixels![row][col]).toBe(true);
        }
      }
    });

    it('should return null for invalid characters', () => {
      const pixels = fontSystem.renderCharacter(300);
      expect(pixels).toBeNull();
    });
  });

  describe('character types', () => {
    it('should identify box drawing characters correctly', () => {
      for (let i = 128; i <= 138; i++) {
        const char = fontSystem.getCharacter(i);
        expect(char?.isBoxDrawing).toBe(true);
        expect(char?.isRunic).toBe(false);
      }
    });

    it('should identify arrow characters correctly', () => {
      for (let i = 160; i <= 163; i++) {
        const char = fontSystem.getCharacter(i);
        expect(char?.isBoxDrawing).toBe(false);
        expect(char?.isRunic).toBe(false);
      }
    });

    it('should identify runic characters correctly', () => {
      for (let i = 176; i <= 207; i++) {
        const char = fontSystem.getCharacter(i);
        expect(char?.isRunic).toBe(true);
        expect(char?.isBoxDrawing).toBe(false);
      }
    });
  });

  describe('bitmap data', () => {
    it('should have valid bitmap data for all characters', () => {
      for (let i = 0; i < 256; i++) {
        const char = fontSystem.getCharacter(i);
        expect(char).toBeDefined();
        expect(char?.bitmap).toBeInstanceOf(Uint8Array);
        expect(char?.bitmap).toHaveLength(8);
      }
    });

    it('should have space character with empty bitmap', () => {
      const space = fontSystem.getCharacter(32);
      expect(space).toBeDefined();
      expect(space?.bitmap.every(byte => byte === 0)).toBe(true);
    });
  });
});
