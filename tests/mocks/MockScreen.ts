import { vi } from 'vitest';
import { Capabilities, Screen, ScreenSize } from '../../src/ui/screen/interfaces';

export class MockScreen implements Screen {
  getKeyFromUser = vi.fn();
  getInputFromUser = vi.fn();
  print = vi.fn();
  splitWindow = vi.fn();
  setOutputWindow = vi.fn();
  getOutputWindow = vi.fn().mockReturnValue(0); // WindowType.Lower
  clearWindow = vi.fn();
  clearLine = vi.fn();
  setCursorPosition = vi.fn();
  getCursorPosition = vi.fn().mockReturnValue({ line: 1, column: 1 });
  hideCursor = vi.fn();
  showCursor = vi.fn();
  setBufferMode = vi.fn();
  setTextStyle = vi.fn();
  setTextColors = vi.fn();
  enableOutputStream = vi.fn();
  disableOutputStream = vi.fn();
  selectInputStream = vi.fn();
  getSize = vi.fn().mockReturnValue({ rows: 25, cols: 80 } as ScreenSize);
  updateStatusBar = vi.fn();
  getBufferMode = vi.fn().mockReturnValue(1); // BufferMode.Buffered
  updateDisplay = vi.fn();
  getCurrentFont = vi.fn().mockReturnValue(1);

  // Font methods with proper behavior matching BaseScreen
  setFont = vi.fn().mockImplementation((machine: any, font: number) => {
    // Return false if font 2 is requested (picture font is undefined)
    if (font === 2) return false;
    // Return true for fonts 1, 3, 4; false for others
    return font === 1 || font === 3 || font === 4;
  });

  getFontForWindow = vi.fn().mockReturnValue(1);

  setFontForWindow = vi.fn().mockImplementation((machine: any, font: number, window: number) => {
    // Return false if font 2 is requested (picture font is undefined)
    if (font === 2) return false;
    // Return true for fonts 1, 3, 4; false for others
    return font === 1 || font === 3 || font === 4;
  });

  // Font 3 specific methods
  isCurrentFontFont3 = vi.fn().mockReturnValue(false);
  getFont3Character = vi.fn().mockReturnValue(undefined);
  isFont3Character = vi.fn().mockReturnValue(false);
  getCurrentFontDimensions = vi.fn().mockReturnValue({ width: 1, height: 1 });

  // Color methods with proper default color values
  getWindowTrueForeground = vi.fn().mockReturnValue(1); // Color.Default
  getWindowTrueBackground = vi.fn().mockReturnValue(1); // Color.Default

  // Window property with proper implementation
  getWindowProperty = vi.fn().mockImplementation((machine: any, window: number, property: number) => {
    switch (property) {
      case 0: return 0; // LineCount: upperWindowHeight
      case 1: return 1; // CursorLine
      case 2: return 1; // CursorColumn
      case 3: return 1; // LeftMargin
      case 4: return 80; // RightMargin
      case 5: return 1; // Font
      case 6: return 0; // TextStyle
      case 7: return 257; // ColorData: (1 << 8) | 1 = 257
      case 8: return 80; // Width
      case 9: return window === 1 ? 0 : 25; // Height: upper window vs lower window
      default: return 0;
    }
  });

  getCapabilities = vi.fn().mockReturnValue({
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
  } as Capabilities);

  quit = vi.fn();
}
