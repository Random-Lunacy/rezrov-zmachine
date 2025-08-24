/**
 * Font 3 Character Graphics System
 *
 * Implements the Z-Machine Font 3 specification for 8x8 bitmap character graphics.
 * This font is used by games like Beyond Zork for drawing maps, arrows, and special symbols.
 *
 * Based on Section 16 of the Z-Machine specification:
 * https://zspec.jaredreisinger.com/16-font3
 */

import { getFont3Bitmap } from './Font3Bitmaps';

export interface Font3Character {
  /** 8x8 bitmap data as 8 bytes, each byte representing one row */
  bitmap: Uint8Array;
  /** Character code (0-255) */
  code: number;
  /** Whether this character is a box drawing character */
  isBoxDrawing: boolean;
  /** Whether this character is a runic character */
  isRunic: boolean;
}

export interface Font3Font {
  /** Font name/identifier */
  name: string;
  /** Character height in pixels */
  height: number;
  /** Character width in pixels */
  width: number;
  /** All characters in the font */
  characters: Map<number, Font3Character>;
  /** Whether this is a fixed-pitch font */
  fixedPitch: boolean;
}

/**
 * Standard Font 3 character set based on Z-Machine specification
 * Includes box drawing characters, arrows, runic symbols, and special graphics
 */
export class Font3System {
  private static instance: Font3System;
  private defaultFont: Font3Font;

  private constructor() {
    this.defaultFont = this.createDefaultFont();
  }

  public static getInstance(): Font3System {
    if (!Font3System.instance) {
      Font3System.instance = new Font3System();
    }
    return Font3System.instance;
  }

  /**
   * Get the default Font 3 font
   */
  public getDefaultFont(): Font3Font {
    return this.defaultFont;
  }

  /**
   * Get a specific character from the font
   */
  public getCharacter(code: number): Font3Character | undefined {
    return this.defaultFont.characters.get(code);
  }

  /**
   * Check if a character code is supported in Font 3
   */
  public isFont3Character(code: number): boolean {
    return this.defaultFont.characters.has(code);
  }

  /**
   * Render a character to a 2D array of pixels
   */
  public renderCharacter(code: number): boolean[][] | null {
    const character = this.getCharacter(code);
    if (!character) return null;

    const pixels: boolean[][] = [];
    for (let row = 0; row < 8; row++) {
      pixels[row] = [];
      for (let col = 0; col < 8; col++) {
        // Check if the bit is set in the bitmap row
        pixels[row][col] = (character.bitmap[row] & (0x80 >> col)) !== 0;
      }
    }
    return pixels;
  }

  /**
   * Create the default Font 3 font with all standard characters
   */
  private createDefaultFont(): Font3Font {
    const characters = new Map<number, Font3Character>();

    // Add standard ASCII characters (0-127) - basic block graphics
    for (let i = 0; i < 128; i++) {
      characters.set(i, this.createBasicCharacter(i));
    }

    // Add box drawing characters (128-159)
    this.addBoxDrawingCharacters(characters);

    // Add arrows and directional symbols (160-175)
    this.addArrowCharacters(characters);

    // Add runic alphabet characters (176-207)
    this.addRunicCharacters(characters);

    // Add special symbols and graphics (208-255)
    this.addSpecialCharacters(characters);

    return {
      name: 'Font 3 Standard',
      height: 8,
      width: 8,
      characters,
      fixedPitch: true
    };
  }

    /**
   * Create a basic character (ASCII 0-127)
   */
  private createBasicCharacter(code: number): Font3Character {
    // Use authentic bitmap data if available, otherwise create basic patterns
    const bitmap = getFont3Bitmap(code) || new Uint8Array(8);
    
    if (code < 32) {
      // Control characters - empty
      return { bitmap, code, isBoxDrawing: false, isRunic: false };
    }
    
    if (code === 32) {
      // Space character - completely empty
      return { bitmap, code, isBoxDrawing: false, isRunic: false };
    }
    
    // For printable ASCII, use authentic bitmap data
    return { bitmap, code, isBoxDrawing: false, isRunic: false };
  }

    /**
   * Add box drawing characters (128-159)
   */
  private addBoxDrawingCharacters(characters: Map<number, Font3Character>): void {
    // Use authentic bitmap data for box drawing characters
    for (let i = 128; i <= 159; i++) {
      const bitmap = getFont3Bitmap(i) || new Uint8Array(8);
      
      characters.set(i, {
        bitmap,
        code: i,
        isBoxDrawing: true,
        isRunic: false
      });
    }
  }

    /**
   * Add arrow and directional characters (160-175)
   */
  private addArrowCharacters(characters: Map<number, Font3Character>): void {
    // Use authentic bitmap data for arrow characters
    for (let i = 160; i <= 175; i++) {
      const bitmap = getFont3Bitmap(i) || new Uint8Array(8);
      
      characters.set(i, {
        bitmap,
        code: i,
        isBoxDrawing: false,
        isRunic: false
      });
    }
  }

    /**
   * Add runic alphabet characters (176-207)
   * Based on late Anglian "futhorc" runic alphabet
   */
  private addRunicCharacters(characters: Map<number, Font3Character>): void {
    // Use authentic bitmap data for runic characters
    for (let i = 176; i <= 207; i++) {
      const bitmap = getFont3Bitmap(i) || new Uint8Array(8);
      
      characters.set(i, {
        bitmap,
        code: i,
        isBoxDrawing: false,
        isRunic: true
      });
    }
  }

    /**
   * Add special symbols and graphics (208-255)
   */
  private addSpecialCharacters(characters: Map<number, Font3Character>): void {
    // Use authentic bitmap data for special characters
    for (let i = 208; i <= 255; i++) {
      const bitmap = getFont3Bitmap(i) || new Uint8Array(8);
      
      characters.set(i, {
        bitmap,
        code: i,
        isBoxDrawing: false,
        isRunic: false
      });
    }
  }
}
