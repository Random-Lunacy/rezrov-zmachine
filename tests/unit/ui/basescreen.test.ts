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
    it('should return 0 and log debug message', () => {
      const result = screen.getWindowProperty(machine as any, 1, 2);

      expect(result).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'not implemented: TestScreen getWindowProperty window=1 property=2'
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
    it('should log debug message for splitWindow', () => {
      screen.splitWindow(machine as any, 5);

      expect(mockLogger.debug).toHaveBeenCalledWith('not implemented: TestScreen splitWindow lines=5');
    });

    it('should log debug message for setOutputWindow', () => {
      screen.setOutputWindow(machine as any, 1);

      expect(mockLogger.debug).toHaveBeenCalledWith('not implemented: TestScreen setOutputWindow windowId=1');
    });

    it('should return 0 and log debug message for getOutputWindow', () => {
      const result = screen.getOutputWindow(machine as any);

      expect(result).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith('not implemented: TestScreen getOutputWindow');
    });

    it('should log debug message for clearWindow', () => {
      screen.clearWindow(machine as any, 1);

      expect(mockLogger.debug).toHaveBeenCalledWith('not implemented: TestScreen clearWindow windowId=1');
    });

    it('should log debug message for clearLine', () => {
      screen.clearLine(machine as any, 1);

      expect(mockLogger.debug).toHaveBeenCalledWith('not implemented: TestScreen clearLine value=1');
    });
  });

  describe('cursor control methods', () => {
    it('should log debug message for setCursorPosition', () => {
      screen.setCursorPosition(machine as any, 10, 20, 1);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'not implemented: TestScreen setCursorPosition line=10 column=20 windowId=1'
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
    it('should log debug message for setBufferMode', () => {
      screen.setBufferMode(machine as any, BufferMode.Buffered);

      expect(mockLogger.debug).toHaveBeenCalledWith('not implemented: TestScreen setBufferMode mode=1');
    });

    it('should log debug message for setTextStyle', () => {
      screen.setTextStyle(machine as any, TextStyle.Bold);

      expect(mockLogger.debug).toHaveBeenCalledWith('not implemented: TestScreen setTextStyle style=2');
    });

    it('should log debug message for setTextColors', () => {
      screen.setTextColors(machine as any, 1, Color.Red, Color.Blue);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'not implemented: TestScreen setTextColors window=1 foreground=3 background=6'
      );
    });

    it('should return 0 and log debug message for getBufferMode', () => {
      const result = screen.getBufferMode(machine as any);

      expect(result).toBe(0);
      expect(mockLogger.debug).toHaveBeenCalledWith('TestScreen getBufferMode');
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
    it('should return 1 and log debug message for getCurrentFont', () => {
      const result = screen.getCurrentFont(machine as any);

      expect(result).toBe(1);
      expect(mockLogger.debug).toHaveBeenCalledWith('TestScreen getCurrentFont');
    });

    it('should return true for supported fonts and log debug message for setFont', () => {
      // Font 1 (normal font) should be supported
      expect(screen.setFont(machine as any, 1)).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('TestScreen setFont 1');

      // Font 2 (picture font) should not be supported
      expect(screen.setFont(machine as any, 2)).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith('TestScreen setFont 2');

      // Font 3 (character graphics font) should be supported
      expect(screen.setFont(machine as any, 3)).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('TestScreen setFont 3');

      // Font 4 (fixed pitch font) should be supported
      expect(screen.setFont(machine as any, 4)).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('TestScreen setFont 4');

      // Other fonts should not be supported
      expect(screen.setFont(machine as any, 5)).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith('TestScreen setFont 5');
    });

    it('should return 1 and log debug message for getFontForWindow', () => {
      const result = screen.getFontForWindow(machine as any, 1);

      expect(result).toBe(1);
      expect(mockLogger.debug).toHaveBeenCalledWith('TestScreen getFontForWindow 1');
    });

    it('should behave like setFont for setFontForWindow', () => {
      // Font 1 (normal font) should be supported
      expect(screen.setFontForWindow(machine as any, 1, 0)).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('TestScreen setFontForWindow 1 0');

      // Font 2 (picture font) should not be supported
      expect(screen.setFontForWindow(machine as any, 2, 0)).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith('TestScreen setFontForWindow 2 0');

      // Font 3 (character graphics font) should be supported
      expect(screen.setFontForWindow(machine as any, 3, 0)).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('TestScreen setFontForWindow 3 0');

      // Font 4 (fixed pitch font) should be supported
      expect(screen.setFontForWindow(machine as any, 4, 0)).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith('TestScreen setFontForWindow 4 0');

      // Other fonts should not be supported
      expect(screen.setFontForWindow(machine as any, 5, 0)).toBe(false);
      expect(mockLogger.debug).toHaveBeenCalledWith('TestScreen setFontForWindow 5 0');
    });
  });

  describe('color methods', () => {
    it('should return -1 and log debug message for getWindowTrueForeground', () => {
      const result = screen.getWindowTrueForeground(machine as any, 1);

      expect(result).toBe(-1);
      expect(mockLogger.debug).toHaveBeenCalledWith('TestScreen getWindowTrueForeground 1');
    });

    it('should return -1 and log debug message for getWindowTrueBackground', () => {
      const result = screen.getWindowTrueBackground(machine as any, 1);

      expect(result).toBe(-1);
      expect(mockLogger.debug).toHaveBeenCalledWith('TestScreen getWindowTrueBackground 1');
    });
  });

  describe('miscellaneous methods', () => {
    it('should log debug message for updateStatusBar', () => {
      screen.updateStatusBar('Left', 'Right');

      expect(mockLogger.debug).toHaveBeenCalledWith('not implemented: TestScreen updateStatusBar lhs=Left rhs=Right');
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
