import { vi } from 'vitest';
import { Capabilities, Screen, ScreenSize } from '../../src/ui/screen/interfaces';

export class MockScreen implements Screen {
  getKeyFromUser = vi.fn();
  getInputFromUser = vi.fn();
  print = vi.fn();
  splitWindow = vi.fn();
  setOutputWindow = vi.fn();
  getOutputWindow = vi.fn().mockReturnValue(0);
  clearWindow = vi.fn();
  clearLine = vi.fn();
  setCursorPosition = vi.fn();
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
  getBufferMode = vi.fn().mockReturnValue(0);
  updateDisplay = vi.fn();
  getCurrentFont = vi.fn().mockReturnValue(1);
  setFont = vi.fn().mockReturnValue(true);
  getFontForWindow = vi.fn().mockReturnValue(1);
  setFontForWindow = vi.fn().mockReturnValue(true);
  getWindowTrueForeground = vi.fn().mockReturnValue(-1);
  getWindowTrueBackground = vi.fn().mockReturnValue(-1);
  getWindowProperty = vi.fn().mockReturnValue(0);
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
