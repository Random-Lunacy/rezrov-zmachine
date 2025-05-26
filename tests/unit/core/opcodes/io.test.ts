import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SuspendState } from '../../../../src/core/execution/SuspendState';
import { ioOpcodes } from '../../../../src/core/opcodes/io';
import { ZMachine } from '../../../../src/interpreter/ZMachine';
import { HeaderLocation } from '../../../../src/utils/constants';
import { createMockZMachine } from '../../../mocks';

describe('I/O Opcodes', () => {
  // Using a type cast to ZMachine to satisfy the TypeScript compiler
  let machine: ZMachine;
  let mockMachine: ReturnType<typeof createMockZMachine>;

  beforeEach(() => {
    // Create a mock ZMachine
    mockMachine = createMockZMachine();

    // Create a properly mock state object with version
    mockMachine.state = {
      ...mockMachine.state,
      version: 5, // Default version
      readByte: vi.fn(),
      storeVariable: vi.fn(),
      updateStatusBar: vi.fn(),
      memory: {
        getWord: vi.fn(),
        getByte: vi.fn(),
        setByte: vi.fn(),
      },
    };

    // Add missing properties and methods
    mockMachine.executor = {
      op_pc: 0x1234,
    } as any;

    // Cast to ZMachine type to satisfy TypeScript
    machine = mockMachine as unknown as ZMachine;
  });

  describe('split_window', () => {
    it('should call screen.splitWindow with the correct parameters', () => {
      // Arrange
      const lines = 5;

      // Act
      ioOpcodes.split_window.impl(machine, [], lines);

      // Assert
      expect(machine.screen.splitWindow).toHaveBeenCalledWith(machine, lines);
      expect(machine.logger.debug).toHaveBeenCalledWith('1234 split_window 5');
    });
  });

  describe('set_window', () => {
    it('should call screen.setOutputWindow with the correct window ID', () => {
      // Arrange
      const windowId = 1;

      // Act
      ioOpcodes.set_window.impl(machine, [], windowId);

      // Assert
      expect(machine.screen.setOutputWindow).toHaveBeenCalledWith(machine, windowId);
      expect(machine.logger.debug).toHaveBeenCalledWith('1234 set_window 1');
    });
  });

  describe('erase_window', () => {
    it('should call screen.clearWindow with the correct window ID', () => {
      // Arrange
      const windowId = 1;

      // Act
      ioOpcodes.erase_window.impl(machine, [], windowId);

      // Assert
      expect(machine.screen.clearWindow).toHaveBeenCalledWith(machine, windowId);
      expect(machine.logger.debug).toHaveBeenCalledWith('1234 erase_window 1');
    });
  });

  describe('erase_line', () => {
    it('should call screen.clearLine with the correct value', () => {
      // Arrange
      const value = 1;

      // Act
      ioOpcodes.erase_line.impl(machine, [], value);

      // Assert
      expect(machine.screen.clearLine).toHaveBeenCalledWith(machine, value);
      expect(machine.logger.debug).toHaveBeenCalledWith('1234 erase_line 1');
    });
  });

  describe('set_cursor', () => {
    it('should call screen.setCursorPosition for normal position', () => {
      // Arrange
      const line = 3;
      const column = 5;

      // Act
      ioOpcodes.set_cursor.impl(machine, [], line, column);

      // Assert
      expect(machine.screen.setCursorPosition).toHaveBeenCalledWith(machine, line, column, 0);
      expect(machine.logger.debug).toHaveBeenCalledWith('1234 set_cursor 3 5');
    });

    it('should hide cursor when line is -1 in V6', () => {
      // Arrange
      mockMachine.state.version = 6;

      // Act
      ioOpcodes.set_cursor.impl(machine, [], -1, 0);

      // Assert
      expect(machine.screen.hideCursor).toHaveBeenCalledWith(machine, 0);
      expect(machine.screen.setCursorPosition).not.toHaveBeenCalled();
    });

    it('should show cursor when line is -2 in V6', () => {
      // Arrange
      mockMachine.state.version = 6;

      // Act
      ioOpcodes.set_cursor.impl(machine, [], -2, 0);

      // Assert
      expect(machine.screen.showCursor).toHaveBeenCalledWith(machine, 0);
      expect(machine.screen.setCursorPosition).not.toHaveBeenCalled();
    });

    it('should use current window for versions < 6', () => {
      // Arrange
      mockMachine.state.version = 5;
      const line = 3;
      const column = 5;
      const customWindow = 2;
      machine.screen.getOutputWindow = vi.fn().mockReturnValue(1);

      // Act
      ioOpcodes.set_cursor.impl(machine, [], line, column, customWindow);

      // Assert
      expect(machine.screen.getOutputWindow).toHaveBeenCalledWith(machine);
      expect(machine.screen.setCursorPosition).toHaveBeenCalledWith(machine, line, column, 1);
    });
  });

  describe('get_cursor', () => {
    it('should log a warning that it is not implemented', () => {
      // Arrange
      const array = 0x1000;

      // Act
      ioOpcodes.get_cursor.impl(machine, [], array);

      // Assert
      expect(machine.logger.warn).toHaveBeenCalledWith(`get_cursor ${array} -- not implemented`);
    });
  });

  describe('set_text_style', () => {
    it('should call screen.setTextStyle with the correct style', () => {
      // Arrange
      const style = 2; // Bold

      // Act
      ioOpcodes.set_text_style.impl(machine, [], style);

      // Assert
      expect(machine.screen.setTextStyle).toHaveBeenCalledWith(machine, style);
      expect(machine.logger.debug).toHaveBeenCalledWith('1234 set_text_style 2');
    });

    it('should pass combined style values to screen.setTextStyle', () => {
      // Arrange
      const style = 6; // Bold + Italic

      // Act
      ioOpcodes.set_text_style.impl(machine, [], style);

      // Assert
      expect(machine.screen.setTextStyle).toHaveBeenCalledWith(machine, style);
    });

    it('should handle style 0 to clear all styles', () => {
      // Arrange
      const style = 0;

      // Act
      ioOpcodes.set_text_style.impl(machine, [], style);

      // Assert
      expect(machine.screen.setTextStyle).toHaveBeenCalledWith(machine, style);
    });
  });

  describe('buffer_mode', () => {
    it('should call screen.setBufferMode with the correct mode', () => {
      // Arrange
      const mode = 1;

      // Act
      ioOpcodes.buffer_mode.impl(machine, [], mode);

      // Assert
      expect(machine.screen.setBufferMode).toHaveBeenCalledWith(machine, mode);
      expect(machine.logger.debug).toHaveBeenCalledWith('1234 buffer_mode 1');
    });
  });

  describe('output_stream', () => {
    it('should enable output stream when stream number is positive', () => {
      // Arrange
      const streamNum = 3;
      const table = 0x1000;
      const width = 80;

      // Act
      ioOpcodes.output_stream.impl(machine, [], streamNum, table, width);

      // Assert
      expect(machine.screen.enableOutputStream).toHaveBeenCalledWith(machine, streamNum, table, width);
      expect(machine.logger.debug).toHaveBeenCalledWith('1234 output_stream 3 4096 80');
    });

    it('should disable output stream when stream number is negative', () => {
      // Arrange
      const streamNum = -3;
      const table = 0x1000;
      const width = 80;

      // Act
      ioOpcodes.output_stream.impl(machine, [], streamNum, table, width);

      // Assert
      expect(machine.screen.disableOutputStream).toHaveBeenCalledWith(machine, 3, table, width);
      expect(machine.logger.debug).toHaveBeenCalledWith('1234 output_stream -3 4096 80');
    });

    it('should do nothing when stream number is 0', () => {
      // Arrange
      const streamNum = 0;

      // Act
      ioOpcodes.output_stream.impl(machine, [], streamNum);

      // Assert
      expect(machine.screen.enableOutputStream).not.toHaveBeenCalled();
      expect(machine.screen.disableOutputStream).not.toHaveBeenCalled();
      expect(machine.logger.debug).toHaveBeenCalledWith('1234 output_stream 0 0 0');
    });
  });

  describe('input_stream', () => {
    it('should call screen.selectInputStream with the correct stream ID', () => {
      // Arrange
      const streamNum = 1;

      // Act
      ioOpcodes.input_stream.impl(machine, [], streamNum);

      // Assert
      expect(machine.screen.selectInputStream).toHaveBeenCalledWith(machine, streamNum);
      expect(machine.logger.debug).toHaveBeenCalledWith('1234 input_stream 1');
    });
  });

  describe('sread', () => {
    it('should read result variable for V5+', () => {
      // Arrange
      mockMachine.state.version = 5;
      mockMachine.state.readByte.mockReturnValue(42);
      const textBuffer = 0x1000;
      const parseBuffer = 0x1100;

      // Act & Assert
      expect(() => ioOpcodes.sread.impl(machine, [], textBuffer, parseBuffer)).toThrow(SuspendState);

      try {
        ioOpcodes.sread.impl(machine, [], textBuffer, parseBuffer);
      } catch (e) {
        if (e instanceof SuspendState) {
          expect(e.state).toEqual({
            keyPress: false,
            resultVar: 42,
            textBuffer,
            parseBuffer,
            time: 0,
            routine: 0,
          });
        }
      }

      expect(mockMachine.state.readByte).toHaveBeenCalled();
    });

    it('should not read result variable for V4 and earlier', () => {
      // Arrange
      mockMachine.state.version = 4;
      mockMachine.state.readByte = vi.fn();
      const textBuffer = 0x1000;
      const parseBuffer = 0x1100;

      // Act & Assert
      expect(() => ioOpcodes.sread.impl(machine, [], textBuffer, parseBuffer)).toThrow(SuspendState);

      expect(mockMachine.state.readByte).not.toHaveBeenCalled();
    });

    it('should include time and routine in suspend state when provided', () => {
      // Arrange
      mockMachine.state.version = 5;
      mockMachine.state.readByte.mockReturnValue(42);
      const textBuffer = 0x1000;
      const parseBuffer = 0x1100;
      const time = 5;
      const routine = 0x2000;

      // Act & Assert
      try {
        ioOpcodes.sread.impl(machine, [], textBuffer, parseBuffer, time, routine);
      } catch (e) {
        if (e instanceof SuspendState) {
          expect(e.state).toEqual({
            keyPress: false,
            resultVar: 42,
            textBuffer,
            parseBuffer,
            time,
            routine,
          });
        }
      }
    });
  });

  describe('sound_effect', () => {
    it('should log a warning that it is not implemented', () => {
      // Arrange
      const number = 1;

      // Act
      ioOpcodes.sound_effect.impl(machine, [], number);

      // Assert
      expect(machine.logger.warn).toHaveBeenCalledWith(`sound_effect ${number} -- not implemented`);
    });
  });

  describe('read_char', () => {
    it('should read result variable and suspend for key input', () => {
      // Arrange
      mockMachine.state.readByte.mockReturnValue(42);
      const device = 1;

      // Act & Assert
      expect(() => ioOpcodes.read_char.impl(machine, [], device)).toThrow(SuspendState);

      try {
        ioOpcodes.read_char.impl(machine, [], device);
      } catch (e) {
        if (e instanceof SuspendState) {
          expect(e.state).toEqual({
            keyPress: true,
            resultVar: 42,
            time: 0,
            routine: 0,
          });
        }
      }

      expect(mockMachine.state.readByte).toHaveBeenCalled();
    });

    it('should include time and routine in suspend state when provided', () => {
      // Arrange
      mockMachine.state.readByte.mockReturnValue(42);
      const device = 1;
      const time = 5;
      const routine = 0x2000;

      // Act & Assert
      try {
        ioOpcodes.read_char.impl(machine, [], device, time, routine);
      } catch (e) {
        if (e instanceof SuspendState) {
          expect(e.state).toEqual({
            keyPress: true,
            resultVar: 42,
            time,
            routine,
          });
        }
      }
    });
  });

  describe('get_wind_prop', () => {
    it('should get window property and store result', () => {
      // Arrange
      const window = 1;
      const property = 10;
      const resultVar = 42;
      const propertyValue = 123;

      mockMachine.state.readByte.mockReturnValue(resultVar);
      machine.screen.getWindowProperty = vi.fn().mockReturnValue(propertyValue);

      // Act
      ioOpcodes.get_wind_prop.impl(machine, [], window, property);

      // Assert
      expect(mockMachine.state.readByte).toHaveBeenCalled();
      expect(machine.screen.getWindowProperty).toHaveBeenCalledWith(machine, window, property);
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(resultVar, propertyValue);
    });

    it('should handle true foreground color property in V6', () => {
      // Arrange
      mockMachine.state.version = 6;
      const window = 1;
      const property = 16; // true foreground color
      const resultVar = 42;
      const colorValue = 0x001f; // true color value

      mockMachine.state.readByte.mockReturnValue(resultVar);
      machine.screen.getWindowTrueForeground = vi.fn().mockReturnValue(colorValue);

      // Act
      ioOpcodes.get_wind_prop.impl(machine, [], window, property);

      // Assert
      expect(machine.screen.getWindowTrueForeground).toHaveBeenCalledWith(machine, window);
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(resultVar, colorValue);
    });

    it('should handle true background color property in V6', () => {
      // Arrange
      mockMachine.state.version = 6;
      const window = 1;
      const property = 17; // true background color
      const resultVar = 42;
      const colorValue = 0x003e; // true color value

      mockMachine.state.readByte.mockReturnValue(resultVar);
      machine.screen.getWindowTrueBackground = vi.fn().mockReturnValue(colorValue);

      // Act
      ioOpcodes.get_wind_prop.impl(machine, [], window, property);

      // Assert
      expect(machine.screen.getWindowTrueBackground).toHaveBeenCalledWith(machine, window);
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(resultVar, colorValue);
    });

    it('should log warning when true color properties are accessed in versions < 6', () => {
      // Arrange
      mockMachine.state.version = 5;
      const window = 1;
      const property = 16; // true foreground color
      const resultVar = 42;

      mockMachine.state.readByte.mockReturnValue(resultVar);

      // Act
      ioOpcodes.get_wind_prop.impl(machine, [], window, property);

      // Assert
      expect(machine.logger.warn).toHaveBeenCalledWith('True color properties only available in Version 6');
      expect(machine.screen.getWindowTrueForeground).not.toHaveBeenCalled();
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(resultVar, 0);
    });
  });

  describe('set_font', () => {
    it('should set font and return previous font', () => {
      // Arrange
      const font = 4;
      const resultVar = 42;
      const prevFont = 1;

      mockMachine.state.readByte.mockReturnValue(resultVar);
      machine.screen.getCurrentFont = vi.fn().mockReturnValue(prevFont);
      machine.screen.setFont = vi.fn().mockReturnValue(true);

      // Act
      ioOpcodes.set_font.impl(machine, [], font);

      // Assert
      expect(mockMachine.state.readByte).toHaveBeenCalled();
      expect(machine.screen.getCurrentFont).toHaveBeenCalledWith(machine);
      expect(machine.screen.setFont).toHaveBeenCalledWith(machine, font);
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(resultVar, prevFont);
    });

    it('should return 0 if font change fails', () => {
      // Arrange
      const font = 4;
      const resultVar = 42;

      mockMachine.state.readByte.mockReturnValue(resultVar);
      machine.screen.setFont = vi.fn().mockReturnValue(false);

      // Act
      ioOpcodes.set_font.impl(machine, [], font);

      // Assert
      expect(machine.screen.setFont).toHaveBeenCalledWith(machine, font);
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(resultVar, 0);
    });

    it('should handle window parameter in V6', () => {
      // Arrange
      mockMachine.state.version = 6;
      const font = 4;
      const window = 2;
      const resultVar = 42;
      const prevFont = 1;

      mockMachine.state.readByte.mockReturnValue(resultVar);
      machine.screen.getFontForWindow = vi.fn().mockReturnValue(prevFont);
      machine.screen.setFontForWindow = vi.fn().mockReturnValue(true);

      // Act
      ioOpcodes.set_font.impl(machine, [], font, window);

      // Assert
      expect(machine.screen.getFontForWindow).toHaveBeenCalledWith(machine, window);
      expect(machine.screen.setFontForWindow).toHaveBeenCalledWith(machine, font, window);
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(resultVar, prevFont);
    });

    it('should ignore window parameter in V5 and earlier', () => {
      // Arrange
      mockMachine.state.version = 5;
      const font = 4;
      const window = 2;
      const resultVar = 42;
      const prevFont = 1;

      mockMachine.state.readByte.mockReturnValue(resultVar);
      machine.screen.getCurrentFont = vi.fn().mockReturnValue(prevFont);
      machine.screen.setFont = vi.fn().mockReturnValue(true);

      // Act
      ioOpcodes.set_font.impl(machine, [], font, window);

      // Assert
      expect(machine.logger.warn).toHaveBeenCalledWith('Window parameter to set_font only valid in V6');
      expect(machine.screen.getCurrentFont).toHaveBeenCalledWith(machine);
      expect(machine.screen.setFont).toHaveBeenCalledWith(machine, font);
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(resultVar, prevFont);
    });
  });

  describe('buffer_screen', () => {
    it('should set buffer mode and return previous mode', () => {
      // Arrange
      const mode = 1;
      const resultVar = 42;
      const prevMode = 0;

      mockMachine.state.readByte.mockReturnValue(resultVar);
      machine.screen.getBufferMode = vi.fn().mockReturnValue(prevMode);

      // Act
      ioOpcodes.buffer_screen.impl(machine, [], mode);

      // Assert
      expect(mockMachine.state.readByte).toHaveBeenCalled();
      expect(machine.screen.getBufferMode).toHaveBeenCalledWith(machine);
      expect(machine.screen.setBufferMode).toHaveBeenCalledWith(machine, mode);
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(resultVar, prevMode);
    });

    it('should force screen update without changing buffer mode when mode is -1', () => {
      // Arrange
      const mode = -1;
      const resultVar = 42;
      const prevMode = 1;

      mockMachine.state.readByte.mockReturnValue(resultVar);
      machine.screen.getBufferMode = vi.fn().mockReturnValue(prevMode);

      // Act
      ioOpcodes.buffer_screen.impl(machine, [], mode);

      // Assert
      expect(machine.screen.updateDisplay).toHaveBeenCalledWith(machine);
      expect(machine.screen.setBufferMode).not.toHaveBeenCalled();
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(resultVar, prevMode);
    });

    it('should log warning for invalid mode values', () => {
      // Arrange
      const mode = 2; // Invalid mode
      const resultVar = 42;
      const prevMode = 1;

      mockMachine.state.readByte.mockReturnValue(resultVar);
      machine.screen.getBufferMode = vi.fn().mockReturnValue(prevMode);

      // Act
      ioOpcodes.buffer_screen.impl(machine, [], mode);

      // Assert
      expect(machine.logger.warn).toHaveBeenCalledWith('Invalid buffer_screen mode: 2. Expected -1, 0, or 1.');
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(resultVar, prevMode);
    });
  });

  describe('set_colour', () => {
    it('should call screen.setTextColors with the correct colors', () => {
      // Arrange
      const foreground = 3; // Red
      const background = 2; // Black

      // Act
      ioOpcodes.set_colour.impl(machine, [], foreground, background);

      // Assert
      expect(machine.screen.setTextColors).toHaveBeenCalledWith(machine, 0, foreground, background);
      expect(machine.logger.debug).toHaveBeenCalledWith('1234 set_colour 3 2 0');
    });

    it('should ignore window parameter in versions < 5', () => {
      // Arrange
      mockMachine.state.version = 4;
      const foreground = 3;
      const background = 2;
      const window = 1;

      // Act
      ioOpcodes.set_colour.impl(machine, [], foreground, background, window);

      // Assert
      expect(machine.logger.debug).toHaveBeenCalledWith(`set_colour: ignoring in version < 5`);
      expect(machine.screen.setTextColors).toHaveBeenCalledWith(machine, 0, foreground, background);
    });

    it('should respect window parameter in Version 5+', () => {
      // Arrange
      mockMachine.state.version = 5;
      const foreground = 3;
      const background = 2;
      const window = 1;

      // Act
      ioOpcodes.set_colour.impl(machine, [], foreground, background, window);

      // Assert
      expect(machine.screen.setTextColors).toHaveBeenCalledWith(machine, window, foreground, background);
    });

    it('should handle transparency in Version 6', () => {
      // Arrange
      mockMachine.state.version = 6;
      const foreground = 3;
      const background = 15; // Transparent
      const window = 1;

      // Setup transparency support
      mockMachine.state.memory.getWord = vi.fn().mockImplementation((addr) => {
        if (addr === HeaderLocation.HeaderExtTable) return 0x5000;
        if (addr === 0x5000 + 4) return 0x0001; // Transparency supported
        return 0;
      });

      // Current style is not reverse video
      machine.screen.getOutputWindow = vi.fn().mockReturnValue(window);
      machine.screen.getWindowProperty = vi.fn().mockReturnValue(0); // No reverse video

      // Act
      ioOpcodes.set_colour.impl(machine, [], foreground, background, window);

      // Assert
      expect(machine.screen.setTextColors).toHaveBeenCalledWith(machine, window, foreground, background);
    });

    it('should not allow transparent foreground in Version 6', () => {
      // Arrange
      mockMachine.state.version = 6;
      const foreground = 15; // Transparent (not allowed)
      const background = 2;
      const window = 1;

      // Act
      ioOpcodes.set_colour.impl(machine, [], foreground, background, window);

      // Assert
      expect(machine.logger.warn).toHaveBeenCalledWith('Transparent foreground not allowed, using default instead');
      expect(machine.screen.setTextColors).toHaveBeenCalledWith(machine, window, 1, background); // Using default color (1)
    });
  });

  describe('set_true_colour', () => {
    it('should map true colors to standard colors and call setTextColors', () => {
      // Arrange
      const foreground = 0x001f; // Blue in true color format
      const background = 0; // Black in true color format

      // Act
      ioOpcodes.set_true_colour.impl(machine, [], foreground, background);

      // Assert
      // Check that colors were mapped to standard colors, exact value depends on mapping algorithm
      expect(machine.screen.setTextColors).toHaveBeenCalled();
      expect(machine.logger.debug).toHaveBeenCalledWith('1234 set_true_colour 31 0 -3');
    });

    it('should ignore window parameter in versions < 6', () => {
      // Arrange
      mockMachine.state.version = 5;
      const foreground = 0x001f;
      const background = 0;
      const window = 1;

      // Act
      ioOpcodes.set_true_colour.impl(machine, [], foreground, background, window);

      // Assert
      expect(machine.logger.warn).toHaveBeenCalledWith('Window parameter to set_true_colour only valid in V6');
      expect(machine.screen.setTextColors).toHaveBeenCalledWith(machine, 0, expect.any(Number), expect.any(Number));
    });

    it('should respect window parameter in Version 6', () => {
      // Arrange
      mockMachine.state.version = 6;
      const foreground = 0x001f;
      const background = 0;
      const window = 1;

      // Act
      ioOpcodes.set_true_colour.impl(machine, [], foreground, background, window);

      // Assert
      expect(machine.screen.setTextColors).toHaveBeenCalledWith(
        machine,
        window,
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should not allow transparent foreground in Version 6', () => {
      // Arrange
      mockMachine.state.version = 6;
      const foreground = -4; // Transparent (not allowed)
      const background = 0;

      // Act
      ioOpcodes.set_true_colour.impl(machine, [], foreground, background);

      // Assert
      expect(machine.logger.warn).toHaveBeenCalledWith('Transparency requested for foreground - this is not permitted');
      expect(machine.screen.setTextColors).toHaveBeenCalled();
    });
  });

  // Unimplemented opcodes should throw appropriate errors
  describe('unimplemented opcodes', () => {
    it.each([
      'set_margins',
      'move_window',
      'window_size',
      'window_style',
      'read_mouse',
      'mouse_window',
      'make_menu',
      'scroll_window',
      'put_wind_prop',
    ])('should throw an error for %s', (opcode) => {
      expect(() => {
        ioOpcodes[opcode].impl(machine);
      }).toThrow(`Unimplemented opcode: ${opcode}`);
    });
  });
});
