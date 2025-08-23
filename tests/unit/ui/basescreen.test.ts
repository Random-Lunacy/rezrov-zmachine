import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BufferMode, Color, TextStyle } from '../../../src/types';
import { InputMode, InputState } from '../../../src/ui/input/InputInterface';
import { BaseScreen } from '../../../src/ui/screen/BaseScreen';
import { Logger } from '../../../src/utils/log';
import { MockZMachine, createMockZMachine } from '../../mocks';

describe('BaseScreen', () => {
  let screen: BaseScreen;
  let machine: MockZMachine;
  let mockLogger: Logger;

  beforeEach(() => {
    // Create a mock logger to verify logging behavior
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as Logger;

    // Create a mock Z-Machine
    machine = createMockZMachine();

    // Create an instance of BaseScreen with the mock logger
    screen = new BaseScreen('TestScreen', { logger: mockLogger });

    // Override the screen property to use our BaseScreen instance
    machine.screen = screen;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with provided ID and logger', () => {
      const customScreen = new BaseScreen('CustomID', { logger: mockLogger });
      expect(customScreen['id']).toBe('CustomID');
      expect(customScreen['logger']).toBe(mockLogger);
    });

    it('should create a default logger if none provided', () => {
      const defaultScreen = new BaseScreen('DefaultLogger');
      expect(defaultScreen['logger']).toBeDefined();
      expect(defaultScreen['logger']).not.toBe(mockLogger);
    });

    it('should initialize currentStyles to 0', () => {
      expect(screen['currentStyles']).toBe(0);
    });
  });

  describe('getCapabilities', () => {
    it('should return default capabilities', () => {
      const capabilities = screen.getCapabilities();

      expect(capabilities).toEqual({
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
      });

      expect(mockLogger.debug).toHaveBeenCalledWith('not implemented: TestScreen getCapabilities');
    });
  });

  describe('getSize', () => {
    it('should return default screen size', () => {
      const size = screen.getSize();

      expect(size).toEqual({ rows: 25, cols: 80 });
      expect(mockLogger.debug).toHaveBeenCalledWith('not implemented: TestScreen getSize');
    });
  });

  describe('getWindowProperty', () => {
    it('should return appropriate values for implemented properties', () => {
      // Test LineCount property for upper window
      const lineCountResult = screen.getWindowProperty(machine as any, 1, 0);
      expect(lineCountResult).toBe(0); // upperWindowHeight is 0 initially

      // Test CursorLine property
      const cursorLineResult = screen.getWindowProperty(machine as any, 1, 1);
      expect(cursorLineResult).toBe(1); // cursorPosition.line is 1 initially

      // Test CursorColumn property
      const cursorColumnResult = screen.getWindowProperty(machine as any, 1, 2);
      expect(cursorColumnResult).toBe(1); // cursorPosition.column is 1 initially

      // Test LeftMargin property
      const leftMarginResult = screen.getWindowProperty(machine as any, 1, 3);
      expect(leftMarginResult).toBe(1); // Default left margin

      // Test RightMargin property
      const rightMarginResult = screen.getWindowProperty(machine as any, 1, 4);
      expect(rightMarginResult).toBe(80); // getSize().cols

      // Test Font property
      const fontResult = screen.getWindowProperty(machine as any, 1, 5);
      expect(fontResult).toBe(1); // Default font

      // Test TextStyle property
      const textStyleResult = screen.getWindowProperty(machine as any, 1, 6);
      expect(textStyleResult).toBe(0); // currentStyles is 0 initially

      // Test ColorData property
      const colorDataResult = screen.getWindowProperty(machine as any, 1, 7);
      expect(colorDataResult).toBe(257); // Default colors packed: (1 << 8) | 1 = 257

      // Test Width property
      const widthResult = screen.getWindowProperty(machine as any, 1, 8);
      expect(widthResult).toBe(80); // getSize().cols

      // Test Height property for upper window (window 1)
      const heightResult = screen.getWindowProperty(machine as any, 1, 9);
      expect(heightResult).toBe(0); // upperWindowHeight is 0 initially

      // Test Height property for lower window (window 0)
      const lowerHeightResult = screen.getWindowProperty(machine as any, 0, 9);
      expect(lowerHeightResult).toBe(25); // getSize().rows - upperWindowHeight = 25 - 0

      // Test unknown property
      const unknownResult = screen.getWindowProperty(machine as any, 1, 99);
      expect(unknownResult).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'not implemented: TestScreen getWindowProperty window=1 property=99'
      );
    });
  });

  describe('input methods', () => {
    it('should log debug message for getInputFromUser', () => {
      const inputState: InputState = { mode: InputMode.TEXT, resultVar: 0 };
      screen.getInputFromUser(machine as any, inputState);

      expect(mockLogger.debug).toHaveBeenCalledWith('not implemented: TestScreen getInputFromUser');
    });

    it('should log debug message for getKeyFromUser', () => {
      const inputState: InputState = { mode: InputMode.CHAR, resultVar: 0 };
      screen.getKeyFromUser(machine as any, inputState);

      expect(mockLogger.debug).toHaveBeenCalledWith('not implemented: TestScreen getKeyFromUser');
    });
  });

  describe('print', () => {
    it('should log debug message', () => {
      screen.print(machine as any, 'Test string');

      expect(mockLogger.debug).toHaveBeenCalledWith('not implemented: TestScreen print');
    });
  });

  describe('window control methods', () => {
    it('should implement splitWindow with version-aware behavior', () => {
      screen.splitWindow(machine as any, 5);

      expect(mockLogger.debug).toHaveBeenCalledWith('TestScreen splitWindow lines=5 (version 3)');
    });

    it('should implement setOutputWindow with version-aware behavior', () => {
      screen.setOutputWindow(machine as any, 1);

      expect(mockLogger.debug).toHaveBeenCalledWith('TestScreen setOutputWindow windowId=1 (version 3)');
    });

    it('should return current output window', () => {
      const result = screen.getOutputWindow(machine as any);

      expect(result).toBe(0); // Default is WindowType.Lower (0)
    });

    it('should implement clearWindow with version-aware behavior', () => {
      screen.clearWindow(machine as any, 1);

      expect(mockLogger.debug).toHaveBeenCalledWith('TestScreen clearWindow windowId=1 (version 3)');
    });

    it('should warn when clearLine is not supported in version 3', () => {
      screen.clearLine(machine as any, 1);

      expect(mockLogger.warn).toHaveBeenCalledWith('TestScreen clearLine not supported in version 3');
    });
  });

  describe('cursor control methods', () => {
    it('should implement setCursorPosition with version-aware behavior', () => {
      screen.setCursorPosition(machine as any, 10, 20, 1);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TestScreen setCursorPosition line=10 column=20 windowId=1 (version 3)'
      );
    });

    it('should log debug message for hideCursor', () => {
      screen.hideCursor(machine as any, 1);

      expect(mockLogger.debug).toHaveBeenCalledWith('not implemented: TestScreen hideCursor windowId=1');
    });

    it('should log debug message for showCursor', () => {
      screen.showCursor(machine as any, 1);

      expect(mockLogger.debug).toHaveBeenCalledWith('not implemented: TestScreen showCursor windowId=1');
    });
  });

  describe('text formatting methods', () => {
    it('should implement setBufferMode', () => {
      screen.setBufferMode(machine as any, BufferMode.Buffered);

      expect(mockLogger.debug).toHaveBeenCalledWith('TestScreen setBufferMode mode=1');
    });

    it('should warn when setTextStyle is not supported in version 3', () => {
      screen.setTextStyle(machine as any, TextStyle.Bold);

      expect(mockLogger.warn).toHaveBeenCalledWith('TestScreen setTextStyle not supported in version 3');
    });

    it('should warn when setTextColors is not supported in version 3', () => {
      screen.setTextColors(machine as any, 1, Color.Red, Color.Blue);

      expect(mockLogger.warn).toHaveBeenCalledWith('TestScreen setTextColors not supported in version 3');
    });

    it('should return current buffer mode', () => {
      const result = screen.getBufferMode(machine as any);

      expect(result).toBe(1); // Default is BufferMode.Buffered (1)
    });
  });

  describe('stream methods', () => {
    it('should log error message for enableOutputStream', () => {
      screen.enableOutputStream(machine as any, 1, 0x1000, 80);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'not implemented: TestScreen enableOutputStream streamId=1 table=4096 width=80'
      );
    });

    it('should log error message for disableOutputStream', () => {
      screen.disableOutputStream(machine as any, 1, 0x1000, 80);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'not implemented: TestScreen disableOutputStream streamId=1 table=4096 width=80'
      );
    });

    it('should log error message for selectInputStream', () => {
      screen.selectInputStream(machine as any, 1);

      expect(mockLogger.error).toHaveBeenCalledWith('not implemented: TestScreen selectInputStream streamId=1');
    });
  });

  describe('font methods', () => {
    it('should return current font for output window', () => {
      const result = screen.getCurrentFont(machine as any);

      expect(result).toBe(1); // Default font for output window
    });

    it('should implement setFont with version-aware behavior', () => {
      // Font 1 (normal font) should be supported
      expect(screen.setFont(machine as any, 1)).toBe(true);

      // Font 2 (picture font) should not be supported
      expect(screen.setFont(machine as any, 2)).toBe(false);

      // Font 3 (character graphics font) should be supported
      expect(screen.setFont(machine as any, 3)).toBe(true);

      // Font 4 (fixed pitch font) should be supported
      expect(screen.setFont(machine as any, 4)).toBe(true);

      // Other fonts should not be supported
      expect(screen.setFont(machine as any, 5)).toBe(false);

      // Verify that the logger was called for each operation
      expect(mockLogger.debug).toHaveBeenCalledTimes(4);
    });

    it('should return font for specific window', () => {
      const result = screen.getFontForWindow(machine as any, 1);

      expect(result).toBe(1); // Default font for window
    });

    it('should implement setFontForWindow with version-aware behavior', () => {
      // Font 1 (normal font) should be supported
      expect(screen.setFontForWindow(machine as any, 1, 0)).toBe(true);

      // Font 2 (picture font) should not be supported
      expect(screen.setFontForWindow(machine as any, 2, 0)).toBe(false);

      // Font 3 (character graphics font) should be supported
      expect(screen.setFontForWindow(machine as any, 3, 0)).toBe(true);

      // Font 4 (fixed pitch font) should be supported
      expect(screen.setFontForWindow(machine as any, 4, 0)).toBe(true);

      // Other fonts should not be supported
      expect(screen.setFontForWindow(machine as any, 5, 0)).toBe(false);

      // Verify that the logger was called for each operation
      expect(mockLogger.debug).toHaveBeenCalledTimes(4);
    });
  });

  describe('color methods', () => {
    it('should return actual foreground color for window', () => {
      const result = screen.getWindowTrueForeground(machine as any, 1);

      expect(result).toBe(1); // Default foreground color (Color.Default = 1)
    });

    it('should return actual background color for window', () => {
      const result = screen.getWindowTrueBackground(machine as any, 1);

      expect(result).toBe(1); // Default background color (Color.Default = 1)
    });
  });

  describe('miscellaneous methods', () => {
    it('should log debug message for updateStatusBar', () => {
      screen.updateStatusBar('Location', 10, 20, false);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'not implemented: TestScreen updateStatusBar locationName=Location value1=10 value2=20 isTimeMode=false'
      );
    });

    it('should log debug message for updateDisplay', () => {
      screen.updateDisplay(machine as any);

      expect(mockLogger.debug).toHaveBeenCalledWith('TestScreen updateDisplay');
    });

    it('should log debug message for quit', () => {
      screen.quit();

      expect(mockLogger.debug).toHaveBeenCalledWith('not implemented: TestScreen quit');
    });
  });
});
