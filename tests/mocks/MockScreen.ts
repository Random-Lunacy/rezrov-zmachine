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

  // Window property with Z-machine spec property numbers
  getWindowProperty = vi.fn().mockImplementation((_machine: any, window: number, property: number) => {
    switch (property) {
      case 0: return window === 1 ? 1 : 1; // YCoordinate (1-based)
      case 1: return 1; // XCoordinate (1-based)
      case 2: return window === 1 ? 0 : 25; // YSize (height)
      case 3: return 80; // XSize (width)
      case 4: return 1; // YCursor
      case 5: return 1; // XCursor
      case 6: return 0; // LeftMargin (size)
      case 7: return 0; // RightMargin (size)
      case 10: return 0; // TextStyle
      case 11: return 257; // ColorData: (1 << 8) | 1
      case 12: return 1; // Font
      case 13: return 257; // FontSize: (1 << 8) | 1
      case 15: return window === 1 ? 0 : 25; // LineCount
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

  // V6 window management methods (optional)
  moveWindow = vi.fn();
  resizeWindow = vi.fn();
  setWindowStyle = vi.fn();
  scrollWindow = vi.fn();
  setWindowMargins = vi.fn();
  setWindowProperty = vi.fn();
  readMouse = vi.fn();
  setMouseWindow = vi.fn();

  quit = vi.fn();
}
