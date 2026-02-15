import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toI16 } from '../../../../src/core/memory/cast16';
import { stringOpcodes } from '../../../../src/core/opcodes/string';
import { ZMachine } from '../../../../src/interpreter/ZMachine';
import * as ZString from '../../../../src/parsers/ZString';
import { createMockZMachine } from '../../../mocks';

describe('String Opcodes', () => {
  // Using a type cast to ZMachine to satisfy the TypeScript compiler
  let machine: ZMachine;
  let mockMachine: ReturnType<typeof createMockZMachine>;

  beforeEach(() => {
    // Create a mock ZMachine
    mockMachine = createMockZMachine();

    // Create a properly mock state object with required methods
    mockMachine.state = {
      ...mockMachine.state,
      readByte: vi.fn().mockReturnValue(42), // Result variable
      storeVariable: vi.fn(),
      readZString: vi.fn().mockReturnValue([65, 66, 67]), // ABC
      tokenizeLine: vi.fn(),
      returnFromRoutine: vi.fn(),
      pc: 0x5000,
    };

    // Mock ZString functions
    vi.spyOn(ZString, 'decodeZString').mockReturnValue('Test String');

    // Add executor with op_pc property
    mockMachine.executor = {
      op_pc: 0x1234,
    } as any;

    // Cast to ZMachine type to satisfy TypeScript
    machine = mockMachine as unknown as ZMachine;
  });

  describe('print_addr', () => {
    it('should print the string at the given address', () => {
      // Arrange
      const stringAddr = 0x3000;
      const decodedString = 'Test String';
      mockMachine.memory.getZString = vi.fn().mockReturnValue([65, 66, 67]); // ABC

      // Act
      stringOpcodes.print_addr.impl(machine, [], stringAddr);

      // Assert
      expect(mockMachine.memory.getZString).toHaveBeenCalledWith(stringAddr);
      expect(ZString.decodeZString).toHaveBeenCalledWith(mockMachine.memory, [65, 66, 67], true);
      expect(machine.screen.print).toHaveBeenCalledWith(machine, decodedString);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`print_addr ${stringAddr.toString(16)}`);
    });
  });

  describe('print_paddr', () => {
    it('should print the string at the packed address', () => {
      // Arrange
      const packedAddr = 0x1234;
      const unpackedAddr = 0x3000;
      const decodedString = 'Test String';
      mockMachine.state.memory.unpackStringAddress = vi.fn().mockReturnValue(unpackedAddr);
      mockMachine.memory.getZString = vi.fn().mockReturnValue([65, 66, 67]); // ABC

      // Act
      stringOpcodes.print_paddr.impl(machine, [], packedAddr);

      // Assert
      expect(mockMachine.state.memory.unpackStringAddress).toHaveBeenCalledWith(packedAddr);
      expect(mockMachine.memory.getZString).toHaveBeenCalledWith(unpackedAddr);
      expect(ZString.decodeZString).toHaveBeenCalledWith(mockMachine.memory, [65, 66, 67], true);
      expect(machine.screen.print).toHaveBeenCalledWith(machine, decodedString);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`print_paddr ${packedAddr} -> ${unpackedAddr}`);
    });
  });

  describe('new_line', () => {
    it('should print a newline character', () => {
      // Act
      stringOpcodes.new_line.impl(machine, []);

      // Assert
      expect(machine.screen.print).toHaveBeenCalledWith(machine, '\n');
      expect(mockMachine.logger.debug).toHaveBeenCalledWith('new_line');
    });
  });

  describe('print', () => {
    it('should print the embedded string', () => {
      // Arrange
      const zstring = [65, 66, 67]; // ABC
      const decodedString = 'Test String';
      mockMachine.state.readZString.mockReturnValue(zstring);

      // Act
      stringOpcodes.print.impl(machine, []);

      // Assert
      expect(mockMachine.state.readZString).toHaveBeenCalled();
      expect(ZString.decodeZString).toHaveBeenCalledWith(mockMachine.memory, zstring, true);
      expect(machine.screen.print).toHaveBeenCalledWith(machine, decodedString);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`print: "${decodedString}"`);
    });
  });

  describe('print_ret', () => {
    it('should print the embedded string with a new_line character and return 1', () => {
      // Arrange
      const zstring = [65, 66, 67]; // ABC
      const decodedString = 'Test String';
      mockMachine.state.readZString.mockReturnValue(zstring);

      // Act
      stringOpcodes.print_ret.impl(machine, []);

      // Assert
      expect(mockMachine.state.readZString).toHaveBeenCalled();
      expect(ZString.decodeZString).toHaveBeenCalledWith(mockMachine.memory, zstring, true);
      expect(machine.screen.print).toHaveBeenCalledWith(machine, decodedString);
      expect(machine.screen.print).toHaveBeenCalledWith(machine, '\n');
      expect(mockMachine.state.returnFromRoutine).toHaveBeenCalledWith(1);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`5000 print_ret`);
    });
  });

  describe('print_char', () => {
    it('should print a single character', () => {
      // Arrange
      const charCode = 65; // 'A'

      // Act
      stringOpcodes.print_char.impl(machine, [], charCode);

      // Assert
      expect(machine.screen.print).toHaveBeenCalledWith(machine, 'A');
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`print_char(${charCode})`);
    });

    it('should handle multiple character codes', () => {
      // Arrange
      const charCodes = [65, 66, 67]; // 'ABC'

      // Act
      stringOpcodes.print_char.impl(machine, [], ...charCodes);

      // Assert
      expect(machine.screen.print).toHaveBeenCalledWith(machine, 'ABC');
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`print_char(${charCodes})`);
    });
  });

  describe('print_num', () => {
    it('should print a positive number', () => {
      // Arrange
      const value = 42;

      // Act
      stringOpcodes.print_num.impl(machine, [], value);

      // Assert
      expect(machine.screen.print).toHaveBeenCalledWith(machine, '42');
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`print_num ${value} -> 42`);
    });

    it('should print a negative number', () => {
      // Arrange
      const value = toI16(-42);

      // Act
      stringOpcodes.print_num.impl(machine, [], value);

      // Assert
      expect(machine.screen.print).toHaveBeenCalledWith(machine, '-42');
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`print_num ${value} -> -42`);
    });

    it('should handle zero', () => {
      // Arrange
      const value = 0;

      // Act
      stringOpcodes.print_num.impl(machine, [], value);

      // Assert
      expect(machine.screen.print).toHaveBeenCalledWith(machine, '0');
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`print_num ${value} -> 0`);
    });
  });

  describe('print_table', () => {
    it('should print a table of characters with default parameters', () => {
      // Arrange
      const address = 0x3000;
      const width = 3;
      mockMachine.memory.getByte = vi.fn().mockImplementation((addr) => {
        if (addr === address) return 65; // A
        if (addr === address + 1) return 66; // B
        if (addr === address + 2) return 67; // C
        return 0;
      });

      // Act - default height=1, lower window (getOutputWindow returns 0)
      stringOpcodes.print_table.impl(machine, [], address, width);

      // Assert
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(address);
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(address + 1);
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(address + 2);
      expect(machine.screen.print).toHaveBeenCalledWith(machine, 'ABC');
      // Per spec: "There is no implicit new-line at the end."
      // No trailing newline after the last row
      const printCalls = (machine.screen.print as ReturnType<typeof vi.fn>).mock.calls;
      const printArgs = printCalls.map((c: [unknown, string]) => c[1]);
      expect(printArgs).not.toContain('\n');
    });

    it('should print a table with multiple rows in lower window', () => {
      // Arrange
      const address = 0x3000;
      const width = 2;
      const height = 2;
      mockMachine.memory.getByte = vi.fn().mockImplementation((addr) => {
        if (addr === address) return 65; // A
        if (addr === address + 1) return 66; // B
        if (addr === address + 2) return 67; // C
        if (addr === address + 3) return 68; // D
        return 0;
      });

      // Act - lower window (getOutputWindow returns 0)
      stringOpcodes.print_table.impl(machine, [], address, width, height);

      // Assert
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(address);
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(address + 1);
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(address + 2);
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(address + 3);
      // Row 1 printed, then newline between rows, row 2 printed, then trailing newline
      expect(machine.screen.print).toHaveBeenCalledWith(machine, 'AB');
      expect(machine.screen.print).toHaveBeenCalledWith(machine, 'CD');
    });

    it('should handle skip parameter between rows', () => {
      // Arrange
      const address = 0x3000;
      const width = 2;
      const height = 2;
      const skip = 1;
      mockMachine.memory.getByte = vi.fn().mockImplementation((addr) => {
        if (addr === address) return 65; // A
        if (addr === address + 1) return 66; // B
        // addr + 2 is skipped
        if (addr === address + 3) return 67; // C
        if (addr === address + 4) return 68; // D
        return 0;
      });

      // Act - lower window
      stringOpcodes.print_table.impl(machine, [], address, width, height, skip);

      // Assert
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(address);
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(address + 1);
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(address + 3);
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(address + 4);
      expect(machine.screen.print).toHaveBeenCalledWith(machine, 'AB');
      expect(machine.screen.print).toHaveBeenCalledWith(machine, 'CD');
    });

    it('should replace control characters with spaces in table data', () => {
      // Arrange - buffer contains control characters (e.g., stray LF/CR from captured text)
      const address = 0x3000;
      const width = 5;
      mockMachine.memory.getByte = vi.fn().mockImplementation((addr) => {
        if (addr === address) return 65; // A
        if (addr === address + 1) return 10; // LF (control char)
        if (addr === address + 2) return 13; // CR (control char)
        if (addr === address + 3) return 0; // NUL (control char)
        if (addr === address + 4) return 66; // B
        return 0;
      });

      // Act
      stringOpcodes.print_table.impl(machine, [], address, width);

      // Assert - control chars (0-31) should be replaced with spaces
      expect(machine.screen.print).toHaveBeenCalledWith(machine, 'A   B');
    });

    it('should use setCursorPosition for row positioning in upper window', () => {
      // Arrange
      const address = 0x3000;
      const width = 2;
      const height = 2;
      mockMachine.screen.getOutputWindow = vi.fn().mockReturnValue(1); // Upper window
      mockMachine.screen.getCursorPosition = vi.fn().mockReturnValue({ line: 3, column: 5 });
      mockMachine.state.version = 5;
      mockMachine.memory.getByte = vi.fn().mockImplementation((addr) => {
        if (addr === address) return 65; // A
        if (addr === address + 1) return 66; // B
        if (addr === address + 2) return 67; // C
        if (addr === address + 3) return 68; // D
        return 0;
      });

      // Act
      stringOpcodes.print_table.impl(machine, [], address, width, height);

      // Assert - row 1 printed at current cursor, then setCursorPosition for row 2
      expect(machine.screen.print).toHaveBeenCalledWith(machine, 'AB');
      expect(machine.screen.setCursorPosition).toHaveBeenCalledWith(machine, 4, 5, 1); // line 3+1, col 5
      expect(machine.screen.print).toHaveBeenCalledWith(machine, 'CD');
      // Per spec: "There is no implicit new-line at the end."
      // Cursor should NOT be positioned below the table after the last row
      expect(machine.screen.setCursorPosition).toHaveBeenCalledTimes(1); // Only between rows, not after
    });
  });

  describe('tokenize', () => {
    it('should tokenize text with default parameters', () => {
      // Arrange
      const text = 0x3000;
      const parse = 0x4000;

      // Act - Z-machine spec: tokenise text parse [dict] [flag]
      stringOpcodes.tokenise.impl(machine, [], text, parse);

      // Assert
      expect(mockMachine.state.tokenizeLine).toHaveBeenCalledWith(text, parse, 0, false);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(
        `tokenise: text=0x${text.toString(16)}, parse=0x${parse.toString(16)}, dict=0x0, flag=0`
      );
    });

    it('should handle dict and flag parameters', () => {
      // Arrange
      const text = 0x3000;
      const parse = 0x5000;
      const dict = 0x4000;
      const flag = 1;

      // Act - Z-machine spec: tokenise text parse dict flag
      stringOpcodes.tokenise.impl(machine, [], text, parse, dict, flag);

      // Assert
      expect(mockMachine.state.tokenizeLine).toHaveBeenCalledWith(text, parse, dict, true);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(
        `tokenise: text=0x${text.toString(16)}, parse=0x${parse.toString(16)}, dict=0x${dict.toString(16)}, flag=${flag}`
      );
    });
  });

  describe('print_unicode', () => {
    it('should print a unicode character', () => {
      // Arrange
      const charCode = 65; // 'A'

      // Act
      stringOpcodes.print_unicode.impl(machine, [], charCode);

      // Assert
      expect(machine.screen.print).toHaveBeenCalledWith(machine, 'A');
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`print_unicode ${charCode}`);
    });

    it('should handle non-ASCII unicode characters', () => {
      // Arrange
      const charCode = 0x03b1; // Greek alpha

      // Act
      stringOpcodes.print_unicode.impl(machine, [], charCode);

      // Assert
      expect(machine.screen.print).toHaveBeenCalledWith(machine, 'α');
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`print_unicode ${charCode}`);
    });
  });

  describe('check_unicode', () => {
    it('should return 3 for displayable ASCII characters', () => {
      // Arrange
      const charCode = 65; // 'A'
      const resultVar = 42;

      // Act
      stringOpcodes.check_unicode.impl(machine, [], charCode);

      // Assert
      expect(mockMachine.state.readByte).toHaveBeenCalled();
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(resultVar, 3);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`check_unicode ${charCode} -> ${resultVar}`);
    });

    it('should return 0 for non-displayable characters', () => {
      // Arrange
      const charCode = 7; // BEL control character
      const resultVar = 42;

      // Act
      stringOpcodes.check_unicode.impl(machine, [], charCode);

      // Assert
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(resultVar, 0);
    });
  });

  describe('print_form', () => {
    it('should throw a not implemented error', () => {
      // Arrange
      const form = 0x1000;
      mockMachine.memory.getZString = vi.fn().mockReturnValue([65, 66, 67]);

      // Act & Assert
      expect(() => stringOpcodes.print_form.impl(machine, [], form)).toThrow('Unimplemented opcode: print_form');
      expect(mockMachine.memory.getZString).toHaveBeenCalledWith(form);
      expect(mockMachine.logger.debug).toHaveBeenCalled();
    });
  });

  describe('encode_text', () => {
    it('should encode ZSCII text and write packed words to memory', () => {
      // Arrange
      const zsciiText = 0x1000;
      const codedText = 0x2000;
      const text = 'look';

      // Mock memory reads for ZSCII source text
      mockMachine.memory.getByte = vi.fn().mockImplementation((addr: number) => {
        const offset = addr - zsciiText;
        if (offset >= 0 && offset < text.length) {
          return text.charCodeAt(offset);
        }
        return 0;
      });

      // Mock version
      mockMachine.state.version = 5;

      // Mock encoding functions
      const mockZChars = [17, 21, 21, 16, 5, 5, 5, 5, 5]; // "look" encoded
      const mockPacked = [0x4ab5, 0xa0a5, 0xc0a5]; // 3 packed words for V5
      vi.spyOn(ZString, 'encodeZString').mockReturnValue(mockZChars);
      vi.spyOn(ZString, 'packZCharacters').mockReturnValue(mockPacked);

      // Act
      stringOpcodes.encode_text.impl(machine, [], zsciiText, text.length, 0, codedText);

      // Assert - should read 4 bytes from source
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(zsciiText + 0);
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(zsciiText + 1);
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(zsciiText + 2);
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(zsciiText + 3);

      // Assert - should write 3 packed words to destination
      expect(mockMachine.memory.setWord).toHaveBeenCalledWith(codedText, mockPacked[0]);
      expect(mockMachine.memory.setWord).toHaveBeenCalledWith(codedText + 2, mockPacked[1]);
      expect(mockMachine.memory.setWord).toHaveBeenCalledWith(codedText + 4, mockPacked[2]);
    });

    it('should apply from offset when reading source text', () => {
      // Arrange: buffer has length byte at offset 0, then text at offset 1
      const zsciiText = 0x1000;
      const codedText = 0x2000;
      const from = 1;
      const length = 4;

      mockMachine.memory.getByte = vi.fn().mockImplementation((addr: number) => {
        // Byte 0 = length (4), bytes 1-4 = "test"
        const data = [4, 116, 101, 115, 116]; // length, t, e, s, t
        const offset = addr - zsciiText;
        return data[offset] ?? 0;
      });

      mockMachine.state.version = 5;

      const mockZChars = [25, 10, 24, 25, 5, 5, 5, 5, 5];
      const mockPacked = [0x6545, 0xc8a5, 0xc0a5];
      vi.spyOn(ZString, 'encodeZString').mockReturnValue(mockZChars);
      vi.spyOn(ZString, 'packZCharacters').mockReturnValue(mockPacked);

      // Act
      stringOpcodes.encode_text.impl(machine, [], zsciiText, length, from, codedText);

      // Assert - should read starting at zsciiText + from
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(zsciiText + 1);
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(zsciiText + 2);
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(zsciiText + 3);
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(zsciiText + 4);

      // Assert - encodeZString received the text starting after the from offset
      expect(ZString.encodeZString).toHaveBeenCalledWith(mockMachine.memory, 'test', 5);
    });

    it('should pass text to encodeZString for encoding', () => {
      // Arrange
      const zsciiText = 0x1000;
      const codedText = 0x2000;

      mockMachine.memory.getByte = vi.fn().mockImplementation((addr: number) => {
        // "hi" at offset 0
        const data = [104, 105]; // h, i
        return data[addr - zsciiText] ?? 0;
      });

      mockMachine.state.version = 5;

      vi.spyOn(ZString, 'encodeZString').mockReturnValue([13, 14, 5, 5, 5, 5, 5, 5, 5]);
      vi.spyOn(ZString, 'packZCharacters').mockReturnValue([0x3545, 0xa0a5, 0xc0a5]);

      // Act
      stringOpcodes.encode_text.impl(machine, [], zsciiText, 2, 0, codedText);

      // Assert - should pass the decoded text string to encodeZString
      expect(ZString.encodeZString).toHaveBeenCalledWith(mockMachine.memory, 'hi', 5);
      expect(ZString.packZCharacters).toHaveBeenCalledWith([13, 14, 5, 5, 5, 5, 5, 5, 5], 5);
    });
  });
});
