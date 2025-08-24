import { describe, it, expect, beforeEach } from 'vitest';
import { FontManager, FontType } from '../../../../src/ui/fonts/FontManager';

describe('FontManager', () => {
  let fontManager: FontManager;

  beforeEach(() => {
    fontManager = FontManager.getInstance();
  });

  describe('getInstance', () => {
    it('should return the same instance', () => {
      const instance1 = FontManager.getInstance();
      const instance2 = FontManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('font support', () => {
    it('should support Font 1 (Normal)', () => {
      expect(fontManager.isFontSupported(FontType.Normal)).toBe(true);
    });

    it('should not support Font 2 (Picture)', () => {
      expect(fontManager.isFontSupported(FontType.Picture)).toBe(false);
    });

    it('should support Font 3 (Character Graphics)', () => {
      expect(fontManager.isFontSupported(FontType.CharacterGraphics)).toBe(true);
    });

    it('should support Font 4 (Fixed Pitch)', () => {
      expect(fontManager.isFontSupported(FontType.FixedPitch)).toBe(true);
    });
  });

  describe('font information', () => {
    it('should return font info for supported fonts', () => {
      const font1Info = fontManager.getFontInfo(FontType.Normal);
      expect(font1Info).toBeDefined();
      expect(font1Info?.type).toBe(FontType.Normal);
      expect(font1Info?.supported).toBe(true);

      const font3Info = fontManager.getFontInfo(FontType.CharacterGraphics);
      expect(font3Info).toBeDefined();
      expect(font3Info?.type).toBe(FontType.CharacterGraphics);
      expect(font3Info?.width).toBe(8);
      expect(font3Info?.height).toBe(8);
      expect(font3Info?.fixedPitch).toBe(true);
    });

    it('should return undefined for unsupported fonts', () => {
      const font2Info = fontManager.getFontInfo(FontType.Picture);
      expect(font2Info).toBeUndefined();
    });
  });

  describe('current font management', () => {
    it('should start with Font 1 as default', () => {
      expect(fontManager.getCurrentFont()).toBe(FontType.Normal);
    });

    it('should allow setting supported fonts', () => {
      expect(fontManager.setCurrentFont(FontType.CharacterGraphics)).toBe(true);
      expect(fontManager.getCurrentFont()).toBe(FontType.CharacterGraphics);
    });

    it('should reject unsupported fonts', () => {
      // First set to a supported font
      fontManager.setCurrentFont(FontType.Normal);
      expect(fontManager.getCurrentFont()).toBe(FontType.Normal);

      // Try to set to unsupported font
      expect(fontManager.setCurrentFont(FontType.Picture)).toBe(false);
      expect(fontManager.getCurrentFont()).toBe(FontType.Normal); // Should remain unchanged
    });
  });

  describe('Font 3 functionality', () => {
    beforeEach(() => {
      fontManager.setCurrentFont(FontType.CharacterGraphics);
    });

    it('should provide Font 3 characters when Font 3 is active', () => {
      const char = fontManager.getFont3Character(128);
      expect(char).toBeDefined();
      expect(char?.code).toBe(128);
    });

    it('should identify Font 3 characters correctly', () => {
      expect(fontManager.isFont3Character(128)).toBe(true);
      expect(fontManager.isFont3Character(160)).toBe(true);
      expect(fontManager.isFont3Character(176)).toBe(true);
    });

    it('should render Font 3 characters', () => {
      const pixels = fontManager.renderFont3Character(128);
      expect(pixels).toBeDefined();
      expect(pixels).toHaveLength(8);
    });
  });

  describe('font dimensions', () => {
    it('should return correct dimensions for Font 1', () => {
      fontManager.setCurrentFont(FontType.Normal);
      const dimensions = fontManager.getCurrentFontDimensions();
      expect(dimensions.width).toBe(1);
      expect(dimensions.height).toBe(1);
    });

    it('should return correct dimensions for Font 3', () => {
      fontManager.setCurrentFont(FontType.CharacterGraphics);
      const dimensions = fontManager.getCurrentFontDimensions();
      expect(dimensions.width).toBe(8);
      expect(dimensions.height).toBe(8);
    });
  });

  describe('fixed pitch detection', () => {
    it('should identify Font 1 as not fixed pitch', () => {
      fontManager.setCurrentFont(FontType.Normal);
      expect(fontManager.isCurrentFontFixedPitch()).toBe(false);
    });

    it('should identify Font 3 as fixed pitch', () => {
      fontManager.setCurrentFont(FontType.CharacterGraphics);
      expect(fontManager.isCurrentFontFixedPitch()).toBe(true);
    });

    it('should identify Font 4 as fixed pitch', () => {
      fontManager.setCurrentFont(FontType.FixedPitch);
      expect(fontManager.isCurrentFontFixedPitch()).toBe(true);
    });
  });

  describe('platform font fallback', () => {
    it('should return Font 3 for Macintosh', () => {
      const fallback = fontManager.getPlatformFontFallback('macintosh');
      expect(fallback).toBe(FontType.CharacterGraphics);
    });

    it('should return Font 3 for Amiga', () => {
      const fallback = fontManager.getPlatformFontFallback('amiga');
      expect(fallback).toBe(FontType.CharacterGraphics);
    });

    it('should return Font 3 for Atari ST', () => {
      const fallback = fontManager.getPlatformFontFallback('atarist');
      expect(fallback).toBe(FontType.CharacterGraphics);
    });

    it('should return Font 3 for MS-DOS', () => {
      const fallback = fontManager.getPlatformFontFallback('msdos');
      expect(fallback).toBe(FontType.CharacterGraphics);
    });

    it('should return Font 1 for digital terminals', () => {
      const fallback = fontManager.getPlatformFontFallback('digital');
      expect(fallback).toBe(FontType.Normal);
    });

    it('should return Font 1 for unknown platforms', () => {
      const fallback = fontManager.getPlatformFontFallback('unknown');
      expect(fallback).toBe(FontType.Normal);
    });
  });

  describe('IBM PC graphics code conversion', () => {
    it('should convert specific IBM PC codes correctly', () => {
      expect(fontManager.convertIBMPCGraphicsCode(179)).toBe('|');
      expect(fontManager.convertIBMPCGraphicsCode(186)).toBe('#');
      expect(fontManager.convertIBMPCGraphicsCode(196)).toBe('-');
      expect(fontManager.convertIBMPCGraphicsCode(205)).toBe('=');
    });

    it('should convert other codes in range 179-218 to plus', () => {
      expect(fontManager.convertIBMPCGraphicsCode(200)).toBe('+');
      expect(fontManager.convertIBMPCGraphicsCode(210)).toBe('+');
    });

    it('should return original character for codes outside range', () => {
      expect(fontManager.convertIBMPCGraphicsCode(65)).toBe('A');
      expect(fontManager.convertIBMPCGraphicsCode(97)).toBe('a');
    });
  });

  describe('supported fonts list', () => {
    it('should return only supported fonts', () => {
      const supported = fontManager.getSupportedFonts();
      expect(supported).toHaveLength(3); // Font 1, 3, and 4

      const types = supported.map(f => f.type);
      expect(types).toContain(FontType.Normal);
      expect(types).toContain(FontType.CharacterGraphics);
      expect(types).toContain(FontType.FixedPitch);
      expect(types).not.toContain(FontType.Picture);
    });
  });

  describe('font capabilities', () => {
    it('should return correct capability flags', () => {
      const capabilities = fontManager.getFontCapabilities();

      expect(capabilities.hasFont1).toBe(true);
      expect(capabilities.hasFont2).toBe(false);
      expect(capabilities.hasFont3).toBe(true);
      expect(capabilities.hasFont4).toBe(true);
      expect(capabilities.hasCharacterGraphics).toBe(true);
      expect(capabilities.hasFixedPitch).toBe(true);
    });
  });
});
