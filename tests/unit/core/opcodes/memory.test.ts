import { beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryOpcodes } from '../../../../src/core/opcodes/memory';
import { ZMachine } from '../../../../src/interpreter/ZMachine';
import { createMockZMachine } from '../../../mocks';

describe('Memory Opcodes', () => {
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
      readBranchOffset: vi.fn().mockReturnValue([10, false]), // offset, branchOnFalse
      doBranch: vi.fn(),
    };

    // Add executor with op_pc property
    mockMachine.executor = {
      op_pc: 0x1234,
    } as any;

    // Ensure memory methods are properly mocked
    mockMachine.memory = {
      ...mockMachine.memory,
      copyBlock: vi.fn(),
      setByte: vi.fn(),
      getByte: vi.fn(),
      getWord: vi.fn(),
      setWord: vi.fn(),
      size: 0x10000, // 64K memory
    };

    // Cast to ZMachine type to satisfy TypeScript
    machine = mockMachine as unknown as ZMachine;
  });

  describe('copy_table', () => {
    it('should copy a region of memory when size > 0', () => {
      // Arrange
      const sourceAddr = 0x1000;
      const destAddr = 0x2000;
      const size = 10;

      // Act
      memoryOpcodes.copy_table.impl(machine, [], sourceAddr, destAddr, size);

      // Assert
      expect(mockMachine.memory.copyBlock).toHaveBeenCalledWith(sourceAddr, destAddr, size);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`copy_table ${sourceAddr} ${destAddr} ${size}`);
    });

    it('should copy forwards when size < 0 (for overlapping regions)', () => {
      // Arrange
      const sourceAddr = 0x1000;
      const destAddr = 0x2000;
      const size = -5;

      // Set up getByte to return predictable values
      mockMachine.memory.getByte.mockImplementation((addr: number) => addr & 0xff);

      // Act - Per Z-machine spec: negative size means copy forwards (low to high)
      memoryOpcodes.copy_table.impl(machine, [], sourceAddr, destAddr, size);

      // Assert
      expect(mockMachine.memory.copyBlock).not.toHaveBeenCalled();
      // Should copy 5 bytes forwards from source to dest
      expect(mockMachine.memory.setByte).toHaveBeenCalledTimes(5);
      for (let i = 0; i < 5; i++) {
        expect(mockMachine.memory.getByte).toHaveBeenCalledWith(sourceAddr + i);
        expect(mockMachine.memory.setByte).toHaveBeenCalledWith(destAddr + i, (sourceAddr + i) & 0xff);
      }
    });

    it('should do nothing when size = 0', () => {
      // Arrange
      const sourceAddr = 0x1000;
      const destAddr = 0x2000;
      const size = 0;

      // Act
      memoryOpcodes.copy_table.impl(machine, [], sourceAddr, destAddr, size);

      // Assert
      expect(mockMachine.memory.copyBlock).not.toHaveBeenCalled();
      expect(mockMachine.memory.setByte).not.toHaveBeenCalled();
      expect(mockMachine.logger.debug).toHaveBeenCalledWith('copy_table: no-op');
    });

    it('should zero source table when destAddr = 0', () => {
      // Arrange
      const sourceAddr = 0x1000;
      const destAddr = 0;
      const size = 10;

      // Act - Per Z-machine spec: "If second is zero, the first table is zeroed for size bytes"
      memoryOpcodes.copy_table.impl(machine, [], sourceAddr, destAddr, size);

      // Assert
      expect(mockMachine.memory.copyBlock).not.toHaveBeenCalled();
      // Should zero 10 bytes at source address
      for (let i = 0; i < size; i++) {
        expect(mockMachine.memory.setByte).toHaveBeenCalledWith(sourceAddr + i, 0);
      }
    });
  });

  describe('scan_table', () => {
    it('should scan for a word value and branch when found', () => {
      // Arrange
      const value = 0x1234;
      const table = 0x3000;
      const length = 3;
      const form = 0x82; // Word mode, element size 2
      const foundAddr = table + 2; // Found in second element

      // Set up readBranchOffset mock
      mockMachine.state.readBranchOffset.mockReturnValue([10, false]);

      // Set up memory mocks
      mockMachine.memory.getWord
        .mockReturnValueOnce(0x5678) // First element
        .mockReturnValueOnce(value) // Second element - match
        .mockReturnValueOnce(0x9abc); // Third element

      // Act
      memoryOpcodes.scan_table.impl(machine, [], value, table, length, form);

      // Assert
      expect(mockMachine.state.readByte).toHaveBeenCalled(); // Read result variable
      expect(mockMachine.state.readBranchOffset).toHaveBeenCalled();
      expect(mockMachine.memory.getWord).toHaveBeenCalledTimes(2); // Only need to check until match found
      expect(mockMachine.memory.getWord).toHaveBeenNthCalledWith(1, table);
      expect(mockMachine.memory.getWord).toHaveBeenNthCalledWith(2, table + 2);
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, foundAddr);
      expect(mockMachine.state.doBranch).toHaveBeenCalledWith(true, false, 10);
    });

    it('should scan for a byte value and branch when found', () => {
      // Arrange
      const value = 0x42;
      const table = 0x3000;
      const length = 3;
      const form = 0x01; // Byte mode, element size 1
      const foundAddr = table + 2; // Found in third element

      // Set up readBranchOffset mock
      mockMachine.state.readBranchOffset.mockReturnValue([10, false]);

      // Set up memory mocks
      mockMachine.memory.getByte
        .mockReturnValueOnce(0x11) // First element
        .mockReturnValueOnce(0x22) // Second element
        .mockReturnValueOnce(value); // Third element - match

      // Act
      memoryOpcodes.scan_table.impl(machine, [], value, table, length, form);

      // Assert
      expect(mockMachine.memory.getByte).toHaveBeenCalledTimes(3);
      expect(mockMachine.memory.getByte).toHaveBeenNthCalledWith(1, table);
      expect(mockMachine.memory.getByte).toHaveBeenNthCalledWith(2, table + 1);
      expect(mockMachine.memory.getByte).toHaveBeenNthCalledWith(3, table + 2);
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, foundAddr);
      expect(mockMachine.state.doBranch).toHaveBeenCalledWith(true, false, 10);
    });

    it('should not branch when value is not found', () => {
      // Arrange
      const value = 0x1234;
      const table = 0x3000;
      const length = 3;
      const form = 0x82; // Word mode, element size 2

      // Set up readBranchOffset mock
      mockMachine.state.readBranchOffset.mockReturnValue([10, false]);

      // Set up memory mocks - no matching values
      mockMachine.memory.getWord.mockReturnValueOnce(0x5678).mockReturnValueOnce(0xabcd).mockReturnValueOnce(0x9abc);

      // Act
      memoryOpcodes.scan_table.impl(machine, [], value, table, length, form);

      // Assert
      expect(mockMachine.memory.getWord).toHaveBeenCalledTimes(3); // Check all elements
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, 0); // Store 0 when not found
      expect(mockMachine.state.doBranch).toHaveBeenCalledWith(false, false, 10);
    });

    it('should handle custom element sizes', () => {
      // Arrange
      const value = 0x1234;
      const table = 0x3000;
      const length = 3;
      const form = 0x84; // Word mode, element size 4
      const foundAddr = table + 8; // Found in third element (offset 2 * 4)

      // Set up readBranchOffset mock
      mockMachine.state.readBranchOffset.mockReturnValue([10, false]);

      // Set up memory mocks
      mockMachine.memory.getWord.mockReturnValueOnce(0x5678).mockReturnValueOnce(0xabcd).mockReturnValueOnce(value);

      // Act
      memoryOpcodes.scan_table.impl(machine, [], value, table, length, form);

      // Assert
      expect(mockMachine.memory.getWord).toHaveBeenCalledTimes(3);
      expect(mockMachine.memory.getWord).toHaveBeenNthCalledWith(1, table);
      expect(mockMachine.memory.getWord).toHaveBeenNthCalledWith(2, table + 4);
      expect(mockMachine.memory.getWord).toHaveBeenNthCalledWith(3, table + 8);
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, foundAddr);
    });
  });

  describe('loadw', () => {
    it('should load a word from an array', () => {
      // Arrange
      const array = 0x2000;
      const wordIndex = 3;
      const address = array + 2 * wordIndex; // 0x2006
      const value = 0x1234;

      // Set up memory mock
      mockMachine.memory.getWord.mockReturnValue(value);

      // Act
      memoryOpcodes.loadw.impl(machine, [], array, wordIndex);

      // Assert
      expect(mockMachine.state.readByte).toHaveBeenCalled();
      expect(mockMachine.memory.getWord).toHaveBeenCalledWith(address);
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, value);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`1234 loadw ${array} ${wordIndex} -> (42)`);
    });

    it('should handle address wrapping at 16-bit boundary', () => {
      // Arrange
      const array = 0xfffe; // Near end of memory
      const wordIndex = 2;
      const address = (array + 2 * wordIndex) & 0xffff; // Should wrap around to 0x0002
      const value = 0xabcd;

      // Set up memory mock
      mockMachine.memory.getWord.mockReturnValue(value);

      // Act
      memoryOpcodes.loadw.impl(machine, [], array, wordIndex);

      // Assert
      expect(mockMachine.memory.getWord).toHaveBeenCalledWith(address);
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, value);
    });
  });

  describe('loadb', () => {
    it('should load a byte from an array', () => {
      // Arrange
      const array = 0x2000;
      const byteIndex = 5;
      const address = array + byteIndex; // 0x2005
      const value = 0x42;

      // Set up memory mock
      mockMachine.memory.getByte.mockReturnValue(value);

      // Act
      memoryOpcodes.loadb.impl(machine, [], array, byteIndex);

      // Assert
      expect(mockMachine.state.readByte).toHaveBeenCalled();
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(address);
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, value);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`1234 loadb ${array} ${byteIndex} -> (42)`);
    });

    it('should handle address wrapping at 16-bit boundary', () => {
      // Arrange
      const array = 0xffff; // End of memory
      const byteIndex = 3;
      const address = (array + byteIndex) & 0xffff; // Should wrap around to 0x0002
      const value = 0x7f;

      // Set up memory mock
      mockMachine.memory.getByte.mockReturnValue(value);

      // Act
      memoryOpcodes.loadb.impl(machine, [], array, byteIndex);

      // Assert
      expect(mockMachine.memory.getByte).toHaveBeenCalledWith(address);
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, value);
    });
  });

  describe('storew', () => {
    it('should store a word in an array', () => {
      // Arrange
      const array = 0x3000;
      const wordIndex = 2;
      const value = 0xcdef;
      const address = array + 2 * wordIndex; // 0x3004

      // Act
      memoryOpcodes.storew.impl(machine, [], array, wordIndex, value);

      // Assert
      expect(mockMachine.memory.setWord).toHaveBeenCalledWith(address, value);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`1234 storew ${array} ${wordIndex} ${value}`);
    });

    it('should handle address wrapping at 16-bit boundary', () => {
      // Arrange
      const array = 0xfffe; // Near end of memory
      const wordIndex = 2;
      const value = 0x1234;
      const address = (array + 2 * wordIndex) & 0xffff; // Should wrap around to 0x0002

      // Act
      memoryOpcodes.storew.impl(machine, [], array, wordIndex, value);

      // Assert
      expect(mockMachine.memory.setWord).toHaveBeenCalledWith(address, value);
    });
  });

  describe('storeb', () => {
    it('should store a byte in an array', () => {
      // Arrange
      const array = 0x3000;
      const byteIndex = 7;
      const value = 0xa5;
      const address = array + byteIndex; // 0x3007

      // Act
      memoryOpcodes.storeb.impl(machine, [], array, byteIndex, value);

      // Assert
      expect(mockMachine.memory.setByte).toHaveBeenCalledWith(address, value);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`1234 storeb ${array} ${byteIndex} ${value}`);
    });

    it('should truncate values to 8 bits', () => {
      // Arrange
      const array = 0x3000;
      const byteIndex = 5;
      const value = 0x12ff; // Value exceeds 8 bits
      const address = array + byteIndex; // 0x3005

      // Act
      memoryOpcodes.storeb.impl(machine, [], array, byteIndex, value);

      // Assert
      expect(mockMachine.memory.setByte).toHaveBeenCalledWith(address, 0xff); // Only lowest 8 bits stored
    });

    it('should handle address wrapping at 16-bit boundary', () => {
      // Arrange
      const array = 0xffff; // End of memory
      const byteIndex = 3;
      const value = 0x42;
      const address = (array + byteIndex) & 0xffff; // Should wrap around to 0x0002

      // Act
      memoryOpcodes.storeb.impl(machine, [], array, byteIndex, value);

      // Assert
      expect(mockMachine.memory.setByte).toHaveBeenCalledWith(address, value);
    });
  });
});
