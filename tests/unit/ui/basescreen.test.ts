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
    it('should return appropriate values for spec-defined properties', () => {
      // Property 0: YCoordinate - top of window (1-based)
      expect(screen.getWindowProperty(machine as any, 1, 0)).toBe(1); // Upper window starts at row 1
      expect(screen.getWindowProperty(machine as any, 0, 0)).toBe(1); // Lower starts at upperHeight+1 (0+1)

      // Property 1: XCoordinate - left of window (1-based)
      expect(screen.getWindowProperty(machine as any, 1, 1)).toBe(1);

      // Property 2: YSize - height in units
      expect(screen.getWindowProperty(machine as any, 1, 2)).toBe(0); // Upper window height initially 0
      expect(screen.getWindowProperty(machine as any, 0, 2)).toBe(25); // Lower = 25 - 0

      // Property 3: XSize - width in units
      expect(screen.getWindowProperty(machine as any, 1, 3)).toBe(80); // Screen width

      // Property 4: YCursor - cursor line (1-based)
      expect(screen.getWindowProperty(machine as any, 1, 4)).toBe(1);

      // Property 5: XCursor - cursor column (1-based)
      expect(screen.getWindowProperty(machine as any, 1, 5)).toBe(1);

      // Property 6: LeftMargin - margin size
      expect(screen.getWindowProperty(machine as any, 1, 6)).toBe(0);

      // Property 7: RightMargin - margin size
      expect(screen.getWindowProperty(machine as any, 1, 7)).toBe(0);

      // Property 10: TextStyle
      expect(screen.getWindowProperty(machine as any, 1, 10)).toBe(0);

      // Property 11: ColorData - packed fg/bg
      expect(screen.getWindowProperty(machine as any, 1, 11)).toBe(257); // (1 << 8) | 1

      // Property 12: Font
      expect(screen.getWindowProperty(machine as any, 1, 12)).toBe(1);

      // Property 13: FontSize - (height << 8 | width)
      expect(screen.getWindowProperty(machine as any, 1, 13)).toBe(257); // (1 << 8) | 1

      // Property 15: LineCount
      expect(screen.getWindowProperty(machine as any, 1, 15)).toBe(0); // Upper height = 0
      expect(screen.getWindowProperty(machine as any, 0, 15)).toBe(25); // Lower = 25 - 0

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
    it('should log debug message for enableOutputStream', () => {
      screen.enableOutputStream(machine as any, 1, 0x1000, 80);

      expect(mockLogger.debug).toHaveBeenCalledWith('TestScreen enableOutputStream streamId=1 table=4096 width=80');
    });

    it('should log debug message for disableOutputStream', () => {
      screen.disableOutputStream(machine as any, 1, 0x1000, 80);

      expect(mockLogger.debug).toHaveBeenCalledWith('TestScreen disableOutputStream streamId=1');
    });

    it('should log error message for selectInputStream', () => {
      screen.selectInputStream(machine as any, 1);

      expect(mockLogger.error).toHaveBeenCalledWith('not implemented: TestScreen selectInputStream streamId=1');
    });

    it('should track memory stream stack when enabling stream 3', () => {
      // Mock machine memory methods
      (machine as any).memory = {
        setWord: vi.fn(),
        getWord: vi.fn().mockReturnValue(0),
        setByte: vi.fn(),
      };

      screen.enableOutputStream(machine as any, 3, 0x5000, 80);
      expect(screen.isMemoryStreamActive()).toBe(true);

      screen.disableOutputStream(machine as any, 3, 0, 0);
      expect(screen.isMemoryStreamActive()).toBe(false);
    });

    it('should convert LF (10) to ZSCII CR (13) in memory stream', () => {
      // Mock machine memory methods
      const setByteCalls: Array<{ addr: number; value: number }> = [];
      (machine as any).memory = {
        setWord: vi.fn(),
        getWord: vi.fn().mockReturnValue(0),
        setByte: vi.fn().mockImplementation((addr: number, value: number) => {
          setByteCalls.push({ addr, value });
        }),
      };

      const table = 0x5000;
      screen.enableOutputStream(machine as any, 3, table, 80);

      // Write text with a JavaScript newline (LF=10)
      const testScreen = screen as any;
      testScreen.writeToMemoryStream(machine, 'A\nB');

      // Verify bytes written: 'A' (65), CR (13), 'B' (66)
      expect(setByteCalls).toEqual([
        { addr: table + 2, value: 65 }, // 'A'
        { addr: table + 3, value: 13 }, // ZSCII CR, not LF
        { addr: table + 4, value: 66 }, // 'B'
      ]);
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

      // Verify that the logger was called for font operations
      expect(mockLogger.debug).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('setFont'));
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

      // Verify that the logger was called for font operations
      expect(mockLogger.debug).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('setFont'));
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

  describe('Version 5 specific behavior', () => {
    let v5Machine: MockZMachine;

    beforeEach(() => {
      v5Machine = createMockZMachine();
      v5Machine.state.version = 5;
    });

    it('should support clearLine in V5', () => {
      screen.setOutputWindow(v5Machine as any, 1); // Set to upper window
      screen.clearLine(v5Machine as any, 1);

      expect(mockLogger.debug).toHaveBeenCalledWith('TestScreen clearLine value=1 (version 5)');
    });

    it('should warn when clearLine is called on lower window', () => {
      screen.setOutputWindow(v5Machine as any, 0); // Set to lower window
      screen.clearLine(v5Machine as any, 1);

      expect(mockLogger.warn).toHaveBeenCalledWith('TestScreen clearLine only works in upper window');
    });

    it('should support setTextStyle in V5', () => {
      screen.setTextStyle(v5Machine as any, TextStyle.Bold);

      expect(mockLogger.debug).toHaveBeenCalledWith('TestScreen setTextStyle style=2 -> currentStyles=2 (version 5)');
    });

    it('should accumulate non-zero styles (OR behavior)', () => {
      screen.setTextStyle(v5Machine as any, TextStyle.Bold); // 2
      screen.setTextStyle(v5Machine as any, TextStyle.Italic); // 4

      // getWindowProperty for TextStyle should show combined styles
      const style = screen.getWindowProperty(v5Machine as any, 0, 10); // WindowProperty.TextStyle = 10
      expect(style).toBe(TextStyle.Bold | TextStyle.Italic); // 6
    });

    it('should reset all styles when style is 0', () => {
      screen.setTextStyle(v5Machine as any, TextStyle.Bold); // 2
      screen.setTextStyle(v5Machine as any, TextStyle.Italic); // 4
      screen.setTextStyle(v5Machine as any, 0); // Roman - clear all

      const style = screen.getWindowProperty(v5Machine as any, 0, 10);
      expect(style).toBe(0);
    });

    it('should support setTextColors in V5', () => {
      screen.setTextColors(v5Machine as any, 0, Color.Red, Color.Blue);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TestScreen setTextColors window=0 foreground=3 background=6 (version 5)'
      );
    });

    it('should handle Color.Current (0) in setTextColors', () => {
      // First set some colors
      screen.setTextColors(v5Machine as any, 0, Color.Red, Color.Blue);

      // Now use Color.Current (0) to keep existing colors
      screen.setTextColors(v5Machine as any, 0, Color.Current, Color.Current);

      // Colors should remain Red and Blue
      expect(screen.getWindowTrueForeground(v5Machine as any, 0)).toBe(Color.Red);
      expect(screen.getWindowTrueBackground(v5Machine as any, 0)).toBe(Color.Blue);
    });

    it('should validate cursor position bounds in V5', () => {
      // First split the window to give upper window some height
      screen.splitWindow(v5Machine as any, 5);

      // Valid position within bounds
      screen.setCursorPosition(v5Machine as any, 3, 10, 1);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TestScreen setCursorPosition line=3 column=10 windowId=1 (version 5)'
      );
    });

    it('should allow cursor position beyond upper window height (Beyond Zork compatibility)', () => {
      // Split window to height 5
      screen.splitWindow(v5Machine as any, 5);

      // Beyond Zork uses screen-absolute coordinates that exceed upper window height
      screen.setCursorPosition(v5Machine as any, 10, 10, 1);

      // Should succeed - no bounds check on window height
      expect(screen['cursorPosition']).toEqual({ line: 10, column: 10 });
    });

    it('should warn on zero line position', () => {
      screen.splitWindow(v5Machine as any, 5);
      screen.setCursorPosition(v5Machine as any, 0, 10, 1); // Line 0 is invalid

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'TestScreen setCursorPosition: invalid position (0, 10)'
      );
    });

    it('should allow cursor position beyond screen width (games use screen-absolute coords)', () => {
      screen.splitWindow(v5Machine as any, 5);
      screen.setCursorPosition(v5Machine as any, 3, 100, 1); // Column 100 > screen width 80

      // Should succeed - real games use these coordinates
      expect(screen['cursorPosition']).toEqual({ line: 3, column: 100 });
    });

    it('should not reset upper window cursor when clearing lower window in V5', () => {
      // Switch to upper window so cursorPosition tracks it
      screen.setOutputWindow(v5Machine as any, 1);
      screen['cursorPosition'] = { line: 5, column: 10 };

      // Clear the lower window in V5
      screen.clearWindow(v5Machine as any, 0);

      // Upper window cursor (live) should NOT be affected by lower window clear
      expect(screen['cursorPosition']).toEqual({ line: 5, column: 10 });
      // Lower window's saved cursor SHOULD be reset per spec §8.7.2.4
      expect(screen['windowCursors'].get(0)).toEqual({ line: 1, column: 1 });
    });

    it('should reset cursor when clearing upper window in V5 while upper window is active', () => {
      // Switch to upper window so cursorPosition tracks it
      screen.setOutputWindow(v5Machine as any, 1);
      screen['cursorPosition'] = { line: 5, column: 10 };

      // Clear the upper window in V5
      screen.clearWindow(v5Machine as any, 1);

      // Upper window cursor (live) should reset to top-left
      expect(screen['cursorPosition']).toEqual({ line: 1, column: 1 });
    });

    it('should reset saved upper window cursor when clearing upper window from lower window in V5', () => {
      // Stay in lower window (default), set upper window's saved cursor
      screen['windowCursors'].set(1, { line: 5, column: 10 });
      screen['cursorPosition'] = { line: 3, column: 7 }; // lower window cursor

      // Clear the upper window while lower window is active
      screen.clearWindow(v5Machine as any, 1);

      // Lower window cursor (live) should NOT be affected
      expect(screen['cursorPosition']).toEqual({ line: 3, column: 7 });
      // Upper window's saved cursor SHOULD be reset per spec §8.7.2.4
      expect(screen['windowCursors'].get(1)).toEqual({ line: 1, column: 1 });
    });

    it('should not clear upper window on split in V5', () => {
      // In V5, splitting window should NOT clear the upper window
      const clearSpy = vi.spyOn(screen, 'clearWindow');

      screen.splitWindow(v5Machine as any, 5);

      // clearWindow should not have been called for upper window
      expect(clearSpy).not.toHaveBeenCalledWith(v5Machine, 1);
    });
  });

  describe('Version 3 specific behavior', () => {
    it('should reset cursor to top-left when selecting upper window in V3', () => {
      // Set cursor to non-default position
      screen['cursorPosition'] = { line: 5, column: 10 };

      // Select upper window in V3
      screen.setOutputWindow(machine as any, 1);

      // Cursor should reset to top-left
      expect(screen['cursorPosition']).toEqual({ line: 1, column: 1 });
    });

    it('should clear upper window when first split occurs in V3', () => {
      const clearSpy = vi.spyOn(screen, 'clearWindow');

      // Initial split from 0 to 5 lines
      screen.splitWindow(machine as any, 5);

      // clearWindow should have been called for upper window
      expect(clearSpy).toHaveBeenCalledWith(machine, 1);
    });

    it('should not clear upper window when split expands in V3', () => {
      // First split
      screen.splitWindow(machine as any, 3);

      const clearSpy = vi.spyOn(screen, 'clearWindow');

      // Expand split - should not clear since already > 0
      screen.splitWindow(machine as any, 5);

      expect(clearSpy).not.toHaveBeenCalled();
    });
  });

  describe('clearWindow special cases', () => {
    it('should handle clearWindow with -1 (clear entire screen)', () => {
      // Set up some state
      screen['upperWindowHeight'] = 5;
      screen['outputWindowId'] = 1;
      screen['cursorPosition'] = { line: 10, column: 20 };

      // Clear entire screen
      screen.clearWindow(machine as any, -1);

      // State should be reset
      expect(screen['upperWindowHeight']).toBe(0);
      expect(screen['outputWindowId']).toBe(0);
      expect(screen['cursorPosition']).toEqual({ line: 1, column: 1 });
    });
  });

  describe('splitWindow bounds checking', () => {
    it('should clamp split lines to valid range', () => {
      // Try to split more lines than screen has
      screen.splitWindow(machine as any, 100);

      // Should be clamped to screen height (V5+ allows full-screen upper window)
      expect(screen['upperWindowHeight']).toBe(25);

      // Try negative lines
      screen.splitWindow(machine as any, -5);
      expect(screen['upperWindowHeight']).toBe(0);
    });
  });

  describe('setCursorPosition edge cases', () => {
    it('should warn when setCursorPosition is called for non-upper window', () => {
      screen.setCursorPosition(machine as any, 5, 10, 0); // Lower window

      expect(mockLogger.debug).toHaveBeenCalledWith('TestScreen setCursorPosition only works in upper window');
    });
  });

  describe('WindowManager integration', () => {
    it('should use WindowManager for getWindowProperty when available', () => {
      // The WindowManager should be initialized
      expect(screen['windowManager']).toBeDefined();

      // WindowManager integration is used but falls back for basic properties
      const result = screen.getWindowProperty(machine as any, 0, 15); // LineCount for lower window
      expect(result).toBe(25); // Full screen height minus upper window height (0)
    });

    it('should use WindowManager for splitWindow', () => {
      const wmSplitSpy = vi.spyOn(screen['windowManager'], 'splitWindow');

      screen.splitWindow(machine as any, 5);

      expect(wmSplitSpy).toHaveBeenCalledWith(5);
    });

    it('should use WindowManager for setOutputWindow', () => {
      const wmSetOutputSpy = vi.spyOn(screen['windowManager'], 'setOutputWindow');

      screen.setOutputWindow(machine as any, 1);

      expect(wmSetOutputSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Font3 methods', () => {
    it('should return false for isCurrentFontFont3 when font is not Font 3', () => {
      // Reset to Font 1 to ensure clean state
      screen.setFont(machine as any, 1);
      expect(screen.isCurrentFontFont3()).toBe(false);
    });

    it('should return true for isCurrentFontFont3 when Font 3 is set', () => {
      // Set Font 3
      screen.setFont(machine as any, 3);
      expect(screen.isCurrentFontFont3()).toBe(true);
      // Reset back to font 1
      screen.setFont(machine as any, 1);
    });

    it('should return undefined for getFont3Character when not using Font 3', () => {
      // Reset to Font 1 first
      screen.setFont(machine as any, 1);
      const result = screen.getFont3Character(65);
      expect(result).toBeUndefined();
    });

    it('should return false for isFont3Character when not using Font 3', () => {
      // Reset to Font 1 first
      screen.setFont(machine as any, 1);
      expect(screen.isFont3Character(65)).toBe(false);
    });

    it('should return font dimensions', () => {
      const dims = screen.getCurrentFontDimensions();
      expect(dims).toHaveProperty('width');
      expect(dims).toHaveProperty('height');
    });
  });

  describe('getWindowProperty lower window line count', () => {
    it('should calculate lower window line count correctly', () => {
      // With upper window height of 5
      screen.splitWindow(machine as any, 5);

      // Lower window should have remaining rows
      const result = screen.getWindowProperty(machine as any, 0, 15); // LineCount (property 15) for lower window
      expect(result).toBe(20); // 25 - 5
    });
  });

  describe('getWindowProperty with no colors set', () => {
    it('should return 0 for ColorData when no colors are set for unknown window', () => {
      const result = screen.getWindowProperty(machine as any, 99, 11); // ColorData (property 11) for non-existent window
      expect(result).toBe(0);
    });
  });

  describe('color methods for unknown windows', () => {
    it('should return -1 for getWindowTrueForeground on unknown window', () => {
      const result = screen.getWindowTrueForeground(machine as any, 99);
      expect(result).toBe(-1);
    });

    it('should return -1 for getWindowTrueBackground on unknown window', () => {
      const result = screen.getWindowTrueBackground(machine as any, 99);
      expect(result).toBe(-1);
    });
  });

  describe('setFontForWindow with current output window', () => {
    it('should update FontManager when setting font for current output window', () => {
      // Reset to font 1 first for clean state
      screen.setFont(machine as any, 1);

      // Current output window is 0 (lower)
      screen.setFontForWindow(machine as any, 3, 0);

      // Font manager should have been updated
      expect(screen.isCurrentFontFont3()).toBe(true);

      // Reset for other tests
      screen.setFont(machine as any, 1);
    });

    it('should not update FontManager when setting font for non-current window', () => {
      // Reset to font 1 first for clean state
      screen.setFont(machine as any, 1);

      // Current output window is 0 (lower)
      // Set font for window 1 (upper) - should not update current font
      screen.setFontForWindow(machine as any, 3, 1);

      // Font manager should still have font 1 since window 1 is not current output window
      // We need to check that the window-specific font was set, not the global font manager
      expect(screen.getFontForWindow(machine as any, 1)).toBe(3);
      expect(screen.getFontForWindow(machine as any, 0)).toBe(1);
    });
  });

  describe('upper window buffer management', () => {
    it('should write text to buffer at cursor position', () => {
      // Access protected method via type assertion
      const testScreen = screen as any;

      // Set cursor to line 1, column 1 (default)
      testScreen.cursorPosition = { line: 1, column: 1 };

      const result = testScreen.writeToUpperWindowBuffer('Hello', 80);

      // Should contain the text padded to screen width
      expect(result).toContain('Hello');
      expect(result.length).toBe(80); // Single line, 80 chars
    });

    it('should advance cursor after writing', () => {
      const testScreen = screen as any;
      testScreen.cursorPosition = { line: 1, column: 1 };

      testScreen.writeToUpperWindowBuffer('Hello', 80);

      // Cursor should have moved right by 5 characters
      expect(testScreen.cursorPosition.column).toBe(6);
    });

    it('should handle multiple lines', () => {
      const testScreen = screen as any;

      // Write to line 1
      testScreen.cursorPosition = { line: 1, column: 1 };
      testScreen.writeToUpperWindowBuffer('Line 1', 80);

      // Write to line 2
      testScreen.cursorPosition = { line: 2, column: 1 };
      const result = testScreen.writeToUpperWindowBuffer('Line 2', 80);

      // Result should have two lines
      const lines = result.split('\n');
      expect(lines.length).toBe(2);
      expect(lines[0]).toContain('Line 1');
      expect(lines[1]).toContain('Line 2');
    });

    it('should overwrite existing text at cursor position', () => {
      const testScreen = screen as any;

      // Write initial text
      testScreen.cursorPosition = { line: 1, column: 1 };
      testScreen.writeToUpperWindowBuffer('AAAAA', 80);

      // Overwrite at position 3
      testScreen.cursorPosition = { line: 1, column: 3 };
      const result = testScreen.writeToUpperWindowBuffer('BBB', 80);

      // Should be "AABBBAA..." (first 2 A's, then BBB, then rest)
      expect(result.substring(0, 8)).toBe('AABBB   ');
    });

    it('should expand buffer for lines beyond current size', () => {
      const testScreen = screen as any;

      // Write directly to line 5 (0-indexed: line 4)
      testScreen.cursorPosition = { line: 5, column: 1 };
      const result = testScreen.writeToUpperWindowBuffer('Line 5', 80);

      // Should have 5 lines (indices 0-4)
      const lines = result.split('\n');
      expect(lines.length).toBe(5);
    });

    it('should trim lines to screen width', () => {
      const testScreen = screen as any;
      testScreen.cursorPosition = { line: 1, column: 1 };

      // Write text that would extend beyond 20 char width
      const result = testScreen.writeToUpperWindowBuffer('This is a very long line', 20);

      expect(result.length).toBe(20);
    });

    it('should handle newlines by moving cursor to start of next line', () => {
      const testScreen = screen as any;
      testScreen.cursorPosition = { line: 1, column: 1 };

      // Write text with embedded newline (per spec 8.7.2.1)
      const result = testScreen.writeToUpperWindowBuffer('Hello\nWorld', 80);

      const lines = result.split('\n');
      expect(lines.length).toBe(2);
      expect(lines[0]).toContain('Hello');
      expect(lines[1]).toContain('World');
      // After newline, cursor should be on line 2 after writing "World"
      expect(testScreen.cursorPosition.line).toBe(2);
      expect(testScreen.cursorPosition.column).toBe(6); // "World" = 5 chars, cursor at 6
    });

    it('should clamp cursor at right edge of screen', () => {
      const testScreen = screen as any;
      testScreen.cursorPosition = { line: 1, column: 1 };

      // Write text that fills the screen width exactly
      testScreen.writeToUpperWindowBuffer('A'.repeat(10), 10);

      // Cursor should not go past screen width + 1
      expect(testScreen.cursorPosition.column).toBe(11);

      // Writing more text should be lost (per spec: "it does not go any further")
      const result = testScreen.writeToUpperWindowBuffer('B', 10);
      const line = result.split('\n')[0];
      expect(line).toBe('A'.repeat(10)); // No B written
    });
  });

  describe('resizeUpperWindowBuffer', () => {
    it('should return null for empty buffer', () => {
      const testScreen = screen as any;
      const result = testScreen.resizeUpperWindowBuffer(100);
      expect(result).toBeNull();
    });

    it('should pad lines when width increases', () => {
      const testScreen = screen as any;

      // Write some text at narrow width
      testScreen.cursorPosition = { line: 1, column: 1 };
      testScreen.writeToUpperWindowBuffer('Test', 40);

      // Resize to wider
      const result = testScreen.resizeUpperWindowBuffer(80);

      expect(result).not.toBeNull();
      expect(result!.length).toBe(80);
    });

    it('should truncate lines when width decreases', () => {
      const testScreen = screen as any;

      // Write some text at wide width
      testScreen.cursorPosition = { line: 1, column: 1 };
      testScreen.writeToUpperWindowBuffer('This is a longer line of text', 80);

      // Resize to narrower
      const result = testScreen.resizeUpperWindowBuffer(20);

      expect(result).not.toBeNull();
      expect(result!.length).toBe(20);
    });
  });

  describe('getUpperWindowBufferContent', () => {
    it('should return empty string for empty buffer', () => {
      const testScreen = screen as any;
      const result = testScreen.getUpperWindowBufferContent();
      expect(result).toBe('');
    });

    it('should return buffer content', () => {
      const testScreen = screen as any;

      testScreen.cursorPosition = { line: 1, column: 1 };
      testScreen.writeToUpperWindowBuffer('Test', 80);

      const result = testScreen.getUpperWindowBufferContent();
      expect(result).toContain('Test');
    });
  });

  describe('clearWindow clears upper window buffer', () => {
    it('should clear upper window buffer when clearing upper window', () => {
      const testScreen = screen as any;

      // Write some text
      testScreen.cursorPosition = { line: 1, column: 1 };
      testScreen.writeToUpperWindowBuffer('Test', 80);

      // Clear upper window (window 1)
      screen.clearWindow(machine as any, 1);

      // Buffer should be empty
      expect(testScreen.upperWindowBuffer.length).toBe(0);
    });

    it('should clear upper window buffer when clearing entire screen (-1)', () => {
      const testScreen = screen as any;

      // Write some text
      testScreen.cursorPosition = { line: 1, column: 1 };
      testScreen.writeToUpperWindowBuffer('Test', 80);

      // Clear entire screen
      screen.clearWindow(machine as any, -1);

      // Buffer should be empty
      expect(testScreen.upperWindowBuffer.length).toBe(0);
    });

    it('should not clear upper window buffer when clearing lower window', () => {
      const testScreen = screen as any;

      // Write some text
      testScreen.cursorPosition = { line: 1, column: 1 };
      testScreen.writeToUpperWindowBuffer('Test', 80);

      // Clear lower window (window 0)
      screen.clearWindow(machine as any, 0);

      // Buffer should still have content
      expect(testScreen.upperWindowBuffer.length).toBe(1);
    });
  });

  describe('formatStatusBarLine', () => {
    it('should format score/moves mode correctly', () => {
      const result = screen.formatStatusBarLine('West of House', 100, 42, false, 80);

      expect(result).toContain('West of House');
      expect(result).toContain('Score: 100');
      expect(result).toContain('Moves: 42');
      expect(result.length).toBe(80);
    });

    it('should format time mode correctly', () => {
      const result = screen.formatStatusBarLine('Kitchen', 14, 30, true, 80);

      expect(result).toContain('Kitchen');
      expect(result).toContain('2:30 PM');
      expect(result.length).toBe(80);
    });

    it('should handle midnight correctly', () => {
      const result = screen.formatStatusBarLine('Location', 0, 0, true, 80);

      expect(result).toContain('12:00 AM');
    });

    it('should handle noon correctly', () => {
      const result = screen.formatStatusBarLine('Location', 12, 0, true, 80);

      expect(result).toContain('12:00 PM');
    });

    it('should handle invalid time values', () => {
      const result = screen.formatStatusBarLine('Location', 25, 61, true, 80);

      expect(result).toContain('??:??');
    });

    it('should handle null location name', () => {
      const result = screen.formatStatusBarLine(null, 50, 10, false, 80);

      expect(result).toContain('Score: 50');
      expect(result.length).toBe(80);
    });

    it('should handle negative scores', () => {
      const result = screen.formatStatusBarLine('Location', -10, 5, false, 80);

      expect(result).toContain('Score: -10');
    });

    it('should pad between left and right sides', () => {
      const result = screen.formatStatusBarLine('A', 1, 1, false, 40);

      // Left side: "A" (1 char)
      // Right side: "Score: 1 Moves: 1" (17 chars)
      // Total padding needed: 40 - 1 - 17 = 22
      expect(result.startsWith('A')).toBe(true);
      expect(result.endsWith('Score: 1 Moves: 1')).toBe(true);
      expect(result.length).toBe(40);
    });
  });

  describe('trueColorToRgb', () => {
    it('should convert black (0) correctly', () => {
      const result = screen.trueColorToRgb(0);

      expect(result).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('should convert pure red correctly', () => {
      // Pure red in 15-bit: 0b00000_00000_11111 = 31
      const result = screen.trueColorToRgb(31);

      expect(result.r).toBe(31 * 8); // 248
      expect(result.g).toBe(0);
      expect(result.b).toBe(0);
    });

    it('should convert pure green correctly', () => {
      // Pure green in 15-bit: 0b00000_11111_00000 = 31 << 5 = 992
      const result = screen.trueColorToRgb(992);

      expect(result.r).toBe(0);
      expect(result.g).toBe(31 * 8); // 248
      expect(result.b).toBe(0);
    });

    it('should convert pure blue correctly', () => {
      // Pure blue in 15-bit: 0b11111_00000_00000 = 31 << 10 = 31744
      const result = screen.trueColorToRgb(31744);

      expect(result.r).toBe(0);
      expect(result.g).toBe(0);
      expect(result.b).toBe(31 * 8); // 248
    });

    it('should convert white correctly', () => {
      // White in 15-bit: 0b11111_11111_11111 = 32767
      const result = screen.trueColorToRgb(32767);

      expect(result.r).toBe(248);
      expect(result.g).toBe(248);
      expect(result.b).toBe(248);
    });
  });

  describe('trueColorToHex', () => {
    it('should convert black to #000000', () => {
      const result = screen.trueColorToHex(0);

      expect(result).toBe('#000000');
    });

    it('should convert pure red to hex', () => {
      // Pure red: 31 -> r=248
      const result = screen.trueColorToHex(31);

      expect(result).toBe('#f80000');
    });

    it('should convert pure green to hex', () => {
      // Pure green: 992 -> g=248
      const result = screen.trueColorToHex(992);

      expect(result).toBe('#00f800');
    });

    it('should convert pure blue to hex', () => {
      // Pure blue: 31744 -> b=248
      const result = screen.trueColorToHex(31744);

      expect(result).toBe('#0000f8');
    });

    it('should convert white to hex', () => {
      // White: 32767 -> all=248
      const result = screen.trueColorToHex(32767);

      expect(result).toBe('#f8f8f8');
    });

    it('should convert mixed colors correctly', () => {
      // Mix: r=16, g=8, b=4 in 5-bit each
      // Value: (4 << 10) | (8 << 5) | 16 = 4096 + 256 + 16 = 4368
      const result = screen.trueColorToHex(4368);

      expect(result).toBe('#804020'); // r=128, g=64, b=32
    });
  });

  describe('bottom-aligned output configuration', () => {
    it('should default startFromBottom to true', () => {
      const defaultScreen = new BaseScreen('DefaultScreen');
      expect(defaultScreen['startFromBottom']).toBe(true);
    });

    it('should allow disabling startFromBottom via constructor option', () => {
      const topScreen = new BaseScreen('TopScreen', { startFromBottom: false });
      expect(topScreen['startFromBottom']).toBe(false);
    });

    it('should initialize hasReceivedFirstOutput to false', () => {
      expect(screen['hasReceivedFirstOutput']).toBe(false);
    });

    it('should have an initializeOutputPosition method', () => {
      const testScreen = screen as any;
      expect(typeof testScreen.initializeOutputPosition).toBe('function');
    });

    it('should reset hasReceivedFirstOutput when clearing entire screen (-1)', () => {
      const testScreen = screen as any;
      testScreen.hasReceivedFirstOutput = true;

      screen.clearWindow(machine as any, -1);

      expect(testScreen.hasReceivedFirstOutput).toBe(false);
    });

    it('should reset hasReceivedFirstOutput when clearing lower window (0)', () => {
      const testScreen = screen as any;
      testScreen.hasReceivedFirstOutput = true;

      screen.clearWindow(machine as any, 0);

      expect(testScreen.hasReceivedFirstOutput).toBe(false);
    });

    it('should NOT reset hasReceivedFirstOutput when clearing upper window (1)', () => {
      const testScreen = screen as any;
      testScreen.hasReceivedFirstOutput = true;

      screen.clearWindow(machine as any, 1);

      expect(testScreen.hasReceivedFirstOutput).toBe(true);
    });

    it('should accept both logger and startFromBottom options together', () => {
      const customScreen = new BaseScreen('CustomScreen', {
        logger: mockLogger,
        startFromBottom: false,
      });

      expect(customScreen['logger']).toBe(mockLogger);
      expect(customScreen['startFromBottom']).toBe(false);
    });
  });

  describe('initializeOutputPosition', () => {
    it('should be callable without error', () => {
      const testScreen = screen as any;
      expect(() => testScreen.initializeOutputPosition()).not.toThrow();
    });

    it('should be a no-op in base implementation', () => {
      const testScreen = screen as any;
      const beforeState = {
        startFromBottom: testScreen.startFromBottom,
        hasReceivedFirstOutput: testScreen.hasReceivedFirstOutput,
      };

      testScreen.initializeOutputPosition();

      expect(testScreen.startFromBottom).toBe(beforeState.startFromBottom);
      expect(testScreen.hasReceivedFirstOutput).toBe(beforeState.hasReceivedFirstOutput);
    });
  });

  describe('upper window color buffer', () => {
    it('should populate color buffer when writing to upper window with active colors', () => {
      const testScreen = screen as any;

      // Set colors on the upper window
      testScreen.outputWindowId = 1;
      testScreen.windowColors.set(1, { foreground: Color.Blue, background: Color.Black });
      testScreen.cursorPosition = { line: 1, column: 1 };

      testScreen.writeToUpperWindowBuffer('AB', 80);

      // Color buffer should have been populated
      expect(testScreen.upperWindowColorBuffer.length).toBe(1);
      expect(testScreen.upperWindowColorBuffer[0][0]).toEqual({ foreground: Color.Blue, background: Color.Black });
      expect(testScreen.upperWindowColorBuffer[0][1]).toEqual({ foreground: Color.Blue, background: Color.Black });
    });

    it('should track color changes mid-text', () => {
      const testScreen = screen as any;
      testScreen.outputWindowId = 1;

      // Write "AB" with red foreground
      testScreen.windowColors.set(1, { foreground: Color.Red, background: Color.Black });
      testScreen.cursorPosition = { line: 1, column: 1 };
      testScreen.writeToUpperWindowBuffer('AB', 80);

      // Change to blue and write "CD"
      testScreen.windowColors.set(1, { foreground: Color.Blue, background: Color.Black });
      testScreen.writeToUpperWindowBuffer('CD', 80);

      expect(testScreen.upperWindowColorBuffer[0][0]).toEqual({ foreground: Color.Red, background: Color.Black });
      expect(testScreen.upperWindowColorBuffer[0][1]).toEqual({ foreground: Color.Red, background: Color.Black });
      expect(testScreen.upperWindowColorBuffer[0][2]).toEqual({ foreground: Color.Blue, background: Color.Black });
      expect(testScreen.upperWindowColorBuffer[0][3]).toEqual({ foreground: Color.Blue, background: Color.Black });
    });

    it('should clear color buffer on clearWindow(-1)', () => {
      const testScreen = screen as any;
      testScreen.outputWindowId = 1;
      testScreen.windowColors.set(1, { foreground: Color.Red, background: Color.Black });
      testScreen.cursorPosition = { line: 1, column: 1 };
      testScreen.writeToUpperWindowBuffer('Test', 80);

      expect(testScreen.upperWindowColorBuffer.length).toBe(1);

      screen.clearWindow(machine as any, -1);

      expect(testScreen.upperWindowColorBuffer.length).toBe(0);
    });

    it('should clear color buffer on clearWindow(Upper)', () => {
      const testScreen = screen as any;
      testScreen.outputWindowId = 1;
      testScreen.windowColors.set(1, { foreground: Color.Green, background: Color.Black });
      testScreen.cursorPosition = { line: 1, column: 1 };
      testScreen.writeToUpperWindowBuffer('Test', 80);

      screen.clearWindow(machine as any, 1);

      expect(testScreen.upperWindowColorBuffer.length).toBe(0);
    });

    it('should clear color buffer on clearWindow(-2)', () => {
      const testScreen = screen as any;
      testScreen.outputWindowId = 1;
      testScreen.windowColors.set(1, { foreground: Color.Yellow, background: Color.Black });
      testScreen.cursorPosition = { line: 1, column: 1 };
      testScreen.writeToUpperWindowBuffer('Test', 80);

      screen.clearWindow(machine as any, -2);

      expect(testScreen.upperWindowColorBuffer.length).toBe(0);
    });

    it('should not clear color buffer when clearing lower window', () => {
      const testScreen = screen as any;
      testScreen.outputWindowId = 1;
      testScreen.windowColors.set(1, { foreground: Color.Red, background: Color.Black });
      testScreen.cursorPosition = { line: 1, column: 1 };
      testScreen.writeToUpperWindowBuffer('Test', 80);

      screen.clearWindow(machine as any, 0);

      expect(testScreen.upperWindowColorBuffer.length).toBe(1);
    });

    it('should clear colors in clearLine from cursor to right edge', () => {
      const testScreen = screen as any;
      // clearLine requires V5+
      const v5 = createMockZMachine();
      v5.state.version = 5;

      testScreen.outputWindowId = 1;
      testScreen.windowColors.set(1, { foreground: Color.Red, background: Color.Blue });
      testScreen.cursorPosition = { line: 1, column: 1 };
      testScreen.writeToUpperWindowBuffer('ABCDE', 10);

      // Position cursor at column 3 and clear
      testScreen.cursorPosition = { line: 1, column: 3 };
      screen.clearLine(v5 as any, 1);

      // First two chars should retain their color
      expect(testScreen.upperWindowColorBuffer[0][0]).toEqual({ foreground: Color.Red, background: Color.Blue });
      expect(testScreen.upperWindowColorBuffer[0][1]).toEqual({ foreground: Color.Red, background: Color.Blue });
      // Remaining should be reset to default
      expect(testScreen.upperWindowColorBuffer[0][2]).toEqual({
        foreground: Color.Default,
        background: Color.Default,
      });
      expect(testScreen.upperWindowColorBuffer[0][4]).toEqual({
        foreground: Color.Default,
        background: Color.Default,
      });
    });

    it('should initialize default colors for new buffer lines', () => {
      const testScreen = screen as any;
      testScreen.outputWindowId = 1;
      // Don't set any explicit colors
      testScreen.cursorPosition = { line: 1, column: 1 };
      testScreen.writeToUpperWindowBuffer('A', 10);

      // Should have default colors for all positions
      expect(testScreen.upperWindowColorBuffer[0][0]).toEqual({
        foreground: Color.Default,
        background: Color.Default,
      });
      // Padding positions should also have defaults
      expect(testScreen.upperWindowColorBuffer[0][5]).toEqual({
        foreground: Color.Default,
        background: Color.Default,
      });
    });

    it('should resize color buffer when resizing upper window buffer', () => {
      const testScreen = screen as any;
      testScreen.outputWindowId = 1;
      testScreen.windowColors.set(1, { foreground: Color.Red, background: Color.Black });
      testScreen.cursorPosition = { line: 1, column: 1 };
      testScreen.writeToUpperWindowBuffer('Test', 40);

      // Resize wider
      testScreen.resizeUpperWindowBuffer(80);
      expect(testScreen.upperWindowColorBuffer[0].length).toBe(80);
      // Original color preserved
      expect(testScreen.upperWindowColorBuffer[0][0]).toEqual({ foreground: Color.Red, background: Color.Black });
      // New positions have defaults
      expect(testScreen.upperWindowColorBuffer[0][50]).toEqual({
        foreground: Color.Default,
        background: Color.Default,
      });

      // Resize narrower
      testScreen.resizeUpperWindowBuffer(20);
      expect(testScreen.upperWindowColorBuffer[0].length).toBe(20);
    });
  });
});
