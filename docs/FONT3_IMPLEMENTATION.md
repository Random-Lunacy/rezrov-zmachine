# Font 3 Character Graphics Implementation

## Overview

This document describes the implementation of the Font 3 Character Graphics system in rezrov, which is a critical requirement for running games like Beyond Zork that use advanced screen graphics and character sets.

## What is Font 3?

Font 3 is the Z-Machine's character graphics font that provides 8×8 bitmap patterns for drawing maps, arrows, runic characters, and special symbols. It's essential for games that need graphical elements while maintaining the Z-Machine's text-based architecture.

## Implementation Components

### 1. Font3System (`src/ui/fonts/Font3System.ts`)

The core Font 3 implementation that provides:

- **Complete Character Set**: All 256 character codes (0-255)
- **8×8 Bitmap Rendering**: Each character is defined as 8 bytes of bitmap data
- **Character Classification**: Identifies box drawing, arrow, runic, and special characters
- **Pixel Rendering**: Converts bitmap data to 2D pixel arrays

#### Character Categories

- **Box Drawing (128-159)**: Lines, corners, junctions for map drawing
- **Arrows (160-175)**: Directional symbols for navigation
- **Runic (176-207)**: Late Anglian "futhorc" runic alphabet
- **Special Symbols (208-255)**: Geometric shapes and custom graphics

### 2. FontManager (`src/ui/fonts/FontManager.ts`)

High-level font management that provides:

- **Font Type Support**: Font 1 (Normal), Font 2 (Picture), Font 3 (Character Graphics), Font 4 (Fixed Pitch)
- **Platform Fallbacks**: Sophisticated handling for different platforms
- **IBM PC Graphics Conversion**: Fallback system for MS-DOS compatibility
- **Font Switching**: Dynamic font selection and management

#### Platform-Specific Behavior

- **Macintosh/Amiga/Atari ST**: Always use Font 3
- **MS-DOS**: Use Font 3 if graphics bit set, fallback to IBM PC codes
- **Apple IIc**: Use Apple character graphics
- **Digital Terminals**: Fallback to normal font

### 3. BaseScreen Integration

The BaseScreen class has been enhanced with:

- **Font 3 Detection**: `isCurrentFontFont3()` method
- **Character Access**: `getFont3Character()` method
- **Font Dimensions**: `getCurrentFontDimensions()` method
- **Font Manager Integration**: Seamless font switching

## Key Features for Beyond Zork

### 1. **Map Drawing Capabilities**

Beyond Zork uses Font 3 extensively for its interactive map:

```typescript
// Box drawing characters for map connections
const horizontalLine = font3System.renderCharacter(128);  // ─
const verticalLine = font3System.renderCharacter(129);    // │
const corner = font3System.renderCharacter(130);          // ┌
```

### 2. **Fixed-Pitch Rendering**

Font 3 characters are designed to align perfectly:

```typescript
// Characters are 8x8 pixels and align perfectly
const dimensions = fontManager.getCurrentFontDimensions();
// Returns: { width: 8, height: 8 }
```

### 3. **Platform Compatibility**

The system handles different platforms gracefully:

```typescript
// Automatic platform detection and fallback
const fallback = fontManager.getPlatformFontFallback('msdos');
// Returns FontType.CharacterGraphics for MS-DOS
```

### 4. **IBM PC Graphics Fallback**

For systems without Font 3 support:

```typescript
// Convert IBM PC graphics codes to ASCII
const ascii = fontManager.convertIBMPCGraphicsCode(179);
// Returns '|' (vertical line)
```

## Usage Examples

### Basic Font 3 Usage

```typescript
import { Font3System, FontManager, FontType } from './ui/fonts';

// Get Font 3 system
const font3System = Font3System.getInstance();
const fontManager = FontManager.getInstance();

// Switch to Font 3
fontManager.setCurrentFont(FontType.CharacterGraphics);

// Get character information
const char = font3System.getCharacter(128);
if (char && char.isBoxDrawing) {
  console.log('This is a box drawing character');
}

// Render character to pixels
const pixels = font3System.renderCharacter(128);
// Returns 8x8 boolean array
```

### Integration with Screen System

```typescript
// In BaseScreen or custom screen implementation
if (this.isCurrentFontFont3()) {
  const char = this.getFont3Character(code);
  if (char) {
    // Render Font 3 character
    const pixels = this.fontManager.renderFont3Character(code);
    // Draw pixels to screen
  }
}
```

## Testing

The implementation includes comprehensive tests:

- **Font3System.test.ts**: Tests character creation, rendering, and classification
- **FontManager.test.ts**: Tests font management, fallbacks, and platform handling
- **BaseScreen.test.ts**: Tests integration with the screen system

Run tests with:

```bash
npm test -- tests/unit/ui/fonts/
npm test -- tests/unit/ui/basescreen.test.ts
```

## Demo

A demonstration script is available at `examples/font3Demo.ts` that shows:

- Character rendering examples
- Font switching capabilities
- Platform fallback behavior
- IBM PC graphics conversion

## Current Status

✅ **Completed**:
- Complete Font 3 character set (256 characters)
- 8×8 bitmap rendering system
- Font manager with platform fallbacks
- BaseScreen integration
- Comprehensive test coverage

🔄 **Next Steps** (Phase 2):
- Mouse input system (`read_mouse`, `mouse_window`)
- Advanced window management (`put_wind_prop`, `move_window`, etc.)

## Beyond Zork Compatibility

With this Font 3 implementation, rezrov now supports:

- **Character Graphics**: All 256 Font 3 characters
- **Map Rendering**: Box drawing characters for game maps
- **Platform Fallbacks**: Sophisticated handling for different systems
- **Font Switching**: Dynamic font selection during gameplay

This represents a significant step toward full Beyond Zork compatibility, addressing the critical Font 3 requirement that was previously missing.

## Technical Notes

- **Memory Usage**: Font 3 characters use 8 bytes each (2KB total for full set)
- **Performance**: Character rendering is optimized with bitmap lookups
- **Extensibility**: System designed for easy addition of custom characters
- **Standards Compliance**: Follows Z-Machine specification Section 16

## References

- [Z-Machine Standards Document](https://inform-fiction.org/zmachine/standards/z1point1/sect08.html)
- [Font 3 Specification](https://zspec.jaredreisinger.com/16-font3)
- [Beyond Zork Technical Analysis](beyond_zork_screen_docs.md)
