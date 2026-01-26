/**
 * Font Manager for Z-Machine
 *
 * Manages different font types and provides fallback handling for different platforms.
 * Supports Font 1 (normal), Font 2 (picture), Font 3 (character graphics), and Font 4 (fixed pitch).
 */

import { Font3Character, Font3System } from './Font3System';

export enum FontType {
  Normal = 1,
  Picture = 2,
  CharacterGraphics = 3,
  FixedPitch = 4,
}

export interface FontInfo {
  type: FontType;
  name: string;
  width: number;
  height: number;
  fixedPitch: boolean;
  supported: boolean;
}

export class FontManager {
  private static instance: FontManager;
  public static getInstance(): FontManager {
    if (!FontManager.instance) {
      FontManager.instance = new FontManager();
    }
    return FontManager.instance;
  }
  private font3System: Font3System;
  private currentFont: FontType = FontType.Normal;
  private fontCache: Map<FontType, FontInfo> = new Map();

  private constructor() {
    this.font3System = Font3System.getInstance();
    this.initializeFonts();
  }

  /**
   * Initialize available fonts
   */
  private initializeFonts(): void {
    // Font 1: Normal font (always supported)
    this.fontCache.set(FontType.Normal, {
      type: FontType.Normal,
      name: 'Normal Font',
      width: 1,
      height: 1,
      fixedPitch: false,
      supported: true,
    });

    // Font 2: Picture font (not supported in current implementation)
    this.fontCache.set(FontType.Picture, {
      type: FontType.Picture,
      name: 'Picture Font',
      width: 0,
      height: 0,
      fixedPitch: false,
      supported: false,
    });

    // Font 3: Character graphics font (Font 3)
    this.fontCache.set(FontType.CharacterGraphics, {
      type: FontType.CharacterGraphics,
      name: 'Character Graphics Font',
      width: 8,
      height: 8,
      fixedPitch: true,
      supported: true,
    });

    // Font 4: Fixed pitch font
    this.fontCache.set(FontType.FixedPitch, {
      type: FontType.FixedPitch,
      name: 'Fixed Pitch Font',
      width: 1,
      height: 1,
      fixedPitch: true,
      supported: true,
    });
  }

  /**
   * Check if a font is supported
   */
  public isFontSupported(font: FontType): boolean {
    const fontInfo = this.fontCache.get(font);
    return fontInfo ? fontInfo.supported : false;
  }

  /**
   * Get information about a font
   */
  public getFontInfo(font: FontType): FontInfo | undefined {
    const fontInfo = this.fontCache.get(font);
    return fontInfo && fontInfo.supported ? fontInfo : undefined;
  }

  /**
   * Set the current font
   */
  public setCurrentFont(font: FontType): boolean {
    if (!this.isFontSupported(font)) {
      return false;
    }
    this.currentFont = font;
    return true;
  }

  /**
   * Get the current font
   */
  public getCurrentFont(): FontType {
    return this.currentFont;
  }

  /**
   * Get Font 3 character information
   */
  public getFont3Character(code: number): Font3Character | undefined {
    if (this.currentFont !== FontType.CharacterGraphics) {
      return undefined;
    }
    return this.font3System.getCharacter(code);
  }

  /**
   * Check if a character code is a Font 3 character
   */
  public isFont3Character(code: number): boolean {
    if (this.currentFont !== FontType.CharacterGraphics) {
      return false;
    }
    return this.font3System.isFont3Character(code);
  }

  /**
   * Render a Font 3 character to pixels
   */
  public renderFont3Character(code: number): boolean[][] | null {
    if (this.currentFont !== FontType.CharacterGraphics) {
      return null;
    }
    return this.font3System.renderCharacter(code);
  }

  /**
   * Get the current font dimensions
   */
  public getCurrentFontDimensions(): { width: number; height: number } {
    const fontInfo = this.fontCache.get(this.currentFont);
    if (!fontInfo) {
      return { width: 1, height: 1 };
    }
    return { width: fontInfo.width, height: fontInfo.height };
  }

  /**
   * Check if the current font is fixed pitch
   */
  public isCurrentFontFixedPitch(): boolean {
    const fontInfo = this.fontCache.get(this.currentFont);
    return fontInfo ? fontInfo.fixedPitch : false;
  }

  /**
   * Check if the current font is Font 3 (Character Graphics)
   */
  public isCurrentFontFont3(): boolean {
    return this.currentFont === FontType.CharacterGraphics;
  }

  /**
   * Get platform-specific font fallback
   * This implements the sophisticated fallback system used by Beyond Zork
   */
  public getPlatformFontFallback(platform: string): FontType {
    switch (platform.toLowerCase()) {
      case 'macintosh':
      case 'amiga':
      case 'atarist':
        // These platforms always use Font 3
        return FontType.CharacterGraphics;

      case 'msdos':
        // MS-DOS uses Font 3 if graphics bit is set, otherwise falls back
        // For now, we'll default to Font 3
        return FontType.CharacterGraphics;

      case 'apple2c':
        // Apple IIc uses Apple character graphics
        // For now, fall back to Font 3
        return FontType.CharacterGraphics;

      case 'digital':
      case 'vt220':
        // Digital terminals ask about VT220 capability
        // For now, fall back to normal font
        return FontType.Normal;

      default:
        // Default to normal font for unknown platforms
        return FontType.Normal;
    }
  }

  /**
   * Convert IBM PC graphics codes to ASCII equivalents
   * This implements the fallback system used by MS-DOS interpreters
   */
  public convertIBMPCGraphicsCode(code: number): string {
    const conversions: { [key: number]: string } = {
      179: '|', // vertical stroke → ASCII 124
      186: '#', // hash → ASCII 35
      196: '-', // minus sign → ASCII 45
      205: '=', // equals sign → ASCII 61
    };

    // Default conversion for codes 179-218
    if (code >= 179 && code <= 218) {
      return conversions[code] || '+'; // Others → plus sign (ASCII 43)
    }

    // Return original character if no conversion needed
    return String.fromCharCode(code);
  }

  /**
   * Get all supported fonts
   */
  public getSupportedFonts(): FontInfo[] {
    return Array.from(this.fontCache.values()).filter((font) => font.supported);
  }

  /**
   * Get font capabilities for the current platform
   */
  public getFontCapabilities(): {
    hasFont1: boolean;
    hasFont2: boolean;
    hasFont3: boolean;
    hasFont4: boolean;
    hasCharacterGraphics: boolean;
    hasFixedPitch: boolean;
  } {
    return {
      hasFont1: this.isFontSupported(FontType.Normal),
      hasFont2: this.isFontSupported(FontType.Picture),
      hasFont3: this.isFontSupported(FontType.CharacterGraphics),
      hasFont4: this.isFontSupported(FontType.FixedPitch),
      hasCharacterGraphics: this.isFontSupported(FontType.CharacterGraphics),
      hasFixedPitch: this.isFontSupported(FontType.FixedPitch),
    };
  }
}
