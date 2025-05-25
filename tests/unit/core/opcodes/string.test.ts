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
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`print ${zstring}`);
    });
  });

  describe('print_ret', () => {
    it('should print the embedded string and return 1', () => {
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

      // Act
      stringOpcodes.print_table.impl(machine, [], address, width);

      // Assert
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(address);
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(address + 1);
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(address + 2);
      expect(machine.screen.print).toHaveBeenCalledWith(machine, 'ABC\n');
    });

    it('should print a table with multiple rows', () => {
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

      // Act
      stringOpcodes.print_table.impl(machine, [], address, width, height);

      // Assert
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(address);
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(address + 1);
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(address + 2);
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(address + 3);
      expect(machine.screen.print).toHaveBeenCalledWith(machine, 'AB\n');
      expect(machine.screen.print).toHaveBeenCalledWith(machine, 'CD\n');
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

      // Act
      stringOpcodes.print_table.impl(machine, [], address, width, height, skip);

      // Assert
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(address);
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(address + 1);
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(address + 3);
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(address + 4);
      expect(machine.screen.print).toHaveBeenCalledWith(machine, 'AB\n');
      expect(machine.screen.print).toHaveBeenCalledWith(machine, 'CD\n');
    });
  });

  describe('tokenize', () => {
    it('should tokenize text with default parameters', () => {
      // Arrange
      const text = 0x3000;
      const dict = 0x4000;

      // Act
      stringOpcodes.tokenise.impl(machine, [], text, dict);

      // Assert
      expect(mockMachine.state.tokenizeLine).toHaveBeenCalledWith(text, 0, dict, false);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`tokenise: text=${text}, dict=${dict}, parse=0, flag=0`);
    });

    it('should handle parse and flag parameters', () => {
      // Arrange
      const text = 0x3000;
      const dict = 0x4000;
      const parse = 0x5000;
      const flag = 1;

      // Act
      stringOpcodes.tokenise.impl(machine, [], text, dict, parse, flag);

      // Assert
      expect(mockMachine.state.tokenizeLine).toHaveBeenCalledWith(text, parse, dict, true);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(
        `tokenise: text=${text}, dict=${dict}, parse=${parse}, flag=${flag}`
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
    it('should throw a not implemented error', () => {
      // Arrange
      const text = 0x1000;
      mockMachine.memory.getZString = vi.fn().mockReturnValue([65, 66, 67]);

      // Act & Assert
      expect(() => stringOpcodes.encode_text.impl(machine, [], text)).toThrow('Unimplemented opcode: encode_text');
      expect(mockMachine.memory.getZString).toHaveBeenCalledWith(text);
      expect(mockMachine.logger.debug).toHaveBeenCalled();
    });
  });
});
