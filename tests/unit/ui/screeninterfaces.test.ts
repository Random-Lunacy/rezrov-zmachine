import { afterEach, describe, expect, it, vi } from 'vitest';
import { BufferMode, Capabilities, Color, TextStyle, colorToString } from '../../../src/ui/screen/interfaces';

describe('Screen Interfaces', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Enums', () => {
    it('should define TextStyle enum with correct values', () => {
      expect(TextStyle.Roman).toBe(0);
      expect(TextStyle.ReverseVideo).toBe(1);
      expect(TextStyle.Bold).toBe(2);
      expect(TextStyle.Italic).toBe(4);
      expect(TextStyle.FixedPitch).toBe(8);
    });

    it('should define Color enum with correct values', () => {
      expect(Color.Current).toBe(0);
      expect(Color.Default).toBe(1);
      expect(Color.Black).toBe(2);
      expect(Color.Red).toBe(3);
      expect(Color.Green).toBe(4);
      expect(Color.Yellow).toBe(5);
      expect(Color.Blue).toBe(6);
      expect(Color.Magenta).toBe(7);
      expect(Color.Cyan).toBe(8);
      expect(Color.White).toBe(9);
      expect(Color.Gray).toBe(10);
    });

    it('should define BufferMode enum with correct values', () => {
      expect(BufferMode.NotBuffered).toBe(0);
      expect(BufferMode.Buffered).toBe(1);
    });
  });

  describe('colorToString', () => {
    it('should convert Color enum values to their string representations', () => {
      expect(colorToString(Color.Black)).toBe('black');
      expect(colorToString(Color.Red)).toBe('red');
      expect(colorToString(Color.Green)).toBe('green');
      expect(colorToString(Color.Yellow)).toBe('yellow');
      expect(colorToString(Color.Blue)).toBe('blue');
      expect(colorToString(Color.Magenta)).toBe('magenta');
      expect(colorToString(Color.Cyan)).toBe('cyan');
      expect(colorToString(Color.White)).toBe('white');
      expect(colorToString(Color.Gray)).toBe('gray');
    });

    it('should return empty string for special color values', () => {
      expect(colorToString(Color.Current)).toBe('');
      expect(colorToString(Color.Default)).toBe('');
    });

    it('should handle invalid color values', () => {
      // Test with a value not defined in the Color enum
      expect(colorToString(99 as Color)).toBe('');
      expect(colorToString(-1 as Color)).toBe('');
    });
  });

  describe('Interface Types', () => {
    // These tests verify that our interface types are structurally as expected
    // Since TypeScript interfaces are erased at runtime, we can only test
    // that objects conforming to these interfaces can be created with expected properties

    it('should define ScreenSize type with expected properties', () => {
      const size: { rows: number; cols: number } = { rows: 25, cols: 80 };
      // TypeScript will validate this object matches ScreenSize at compile-time
      expect(size.rows).toBe(25);
      expect(size.cols).toBe(80);
    });

    it('should define Capabilities type with expected properties', () => {
      const capabilities: Capabilities = {
        hasColors: true,
        hasBold: true,
        hasItalic: true,
        hasReverseVideo: true,
        hasFixedPitch: true,
        hasSplitWindow: true,
        hasDisplayStatusBar: true,
        hasPictures: true,
        hasSound: true,
        hasTimedKeyboardInput: true,
      };

      // Verify all capability properties are present and can be set to true
      expect(capabilities.hasColors).toBe(true);
      expect(capabilities.hasBold).toBe(true);
      expect(capabilities.hasItalic).toBe(true);
      expect(capabilities.hasReverseVideo).toBe(true);
      expect(capabilities.hasFixedPitch).toBe(true);
      expect(capabilities.hasSplitWindow).toBe(true);
      expect(capabilities.hasDisplayStatusBar).toBe(true);
      expect(capabilities.hasPictures).toBe(true);
      expect(capabilities.hasSound).toBe(true);
      expect(capabilities.hasTimedKeyboardInput).toBe(true);
    });

    it('should define Capabilities type with expected false values', () => {
      const capabilities: Capabilities = {
        hasColors: false,
        hasBold: false,
        hasItalic: false,
        hasReverseVideo: false,
        hasFixedPitch: false,
        hasSplitWindow: false,
        hasDisplayStatusBar: false,
        hasPictures: false,
        hasSound: false,
        hasTimedKeyboardInput: false,
      };

      // Verify all capability properties can be set to false
      expect(capabilities.hasColors).toBe(false);
      expect(capabilities.hasBold).toBe(false);
      expect(capabilities.hasItalic).toBe(false);
      expect(capabilities.hasReverseVideo).toBe(false);
      expect(capabilities.hasFixedPitch).toBe(false);
      expect(capabilities.hasSplitWindow).toBe(false);
      expect(capabilities.hasDisplayStatusBar).toBe(false);
      expect(capabilities.hasPictures).toBe(false);
      expect(capabilities.hasSound).toBe(false);
      expect(capabilities.hasTimedKeyboardInput).toBe(false);
    });
  });

  describe('Z-Machine Spec Compliance', () => {
    // Tests to verify the interfaces comply with Z-Machine 1.1 specification

    it('should define TextStyle values according to the Z-Machine spec', () => {
      // According to Z-Machine spec, text styles are bit flags:
      // 0 (none) = normal Roman text
      // 1 = reverse video
      // 2 = bold
      // 4 = italic
      // 8 = fixed pitch

      expect(TextStyle.Roman).toBe(0);
      expect(TextStyle.ReverseVideo).toBe(1);
      expect(TextStyle.Bold).toBe(2);
      expect(TextStyle.Italic).toBe(4);
      expect(TextStyle.FixedPitch).toBe(8);

      // Verify style combinations work as expected (using bitwise OR)
      const boldItalic = TextStyle.Bold | TextStyle.Italic;
      expect(boldItalic).toBe(6);

      const allStyles = TextStyle.ReverseVideo | TextStyle.Bold | TextStyle.Italic | TextStyle.FixedPitch;
      expect(allStyles).toBe(15);
    });

    it('should define Color values according to the Z-Machine spec', () => {
      // The Z-Machine spec defines standard colors with these values
      expect(Color.Current).toBe(0);
      expect(Color.Default).toBe(1);
      expect(Color.Black).toBe(2);
      expect(Color.Red).toBe(3);
      expect(Color.Green).toBe(4);
      expect(Color.Yellow).toBe(5);
      expect(Color.Blue).toBe(6);
      expect(Color.Magenta).toBe(7);
      expect(Color.Cyan).toBe(8);
      expect(Color.White).toBe(9);
      expect(Color.Gray).toBe(10); // Gray is a non-standard addition
    });
  });
});
