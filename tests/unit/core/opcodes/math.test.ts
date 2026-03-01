import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toI16, toU16 } from '../../../../src/core/memory/cast16';
import { mathOpcodes } from '../../../../src/core/opcodes/math';
import { ZMachine } from '../../../../src/interpreter/ZMachine';
import * as randomUtils from '../../../../src/utils/random';
import { createMockZMachine } from '../../../mocks';

describe('Math Opcodes', () => {
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
    };

    // Cast to ZMachine type to satisfy TypeScript
    machine = mockMachine as unknown as ZMachine;

    // Spy on randomUtils functions
    vi.spyOn(randomUtils, 'initRandom');
    vi.spyOn(randomUtils, 'randomInt');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('add', () => {
    it('should add two numbers and store the result', () => {
      // Arrange
      const a = 10;
      const b = 20;
      const expected = toU16(toI16(a) + toI16(b)); // 30

      // Act
      mathOpcodes.add.impl(machine, [], a, b);

      // Assert
      expect(mockMachine.state.readByte).toHaveBeenCalled();
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`add ${a} ${b}`);
    });

    it('should handle signed 16-bit overflow correctly', () => {
      // Arrange
      const a = 0x7fff; // 32767 (max positive value in 16-bit signed)
      const b = 2;
      const expected = toU16(toI16(a) + toI16(b)); // Should wrap to -32767

      // Act
      mathOpcodes.add.impl(machine, [], a, b);

      // Assert
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
      expect(toI16(expected)).toBeLessThan(0); // Should be negative after overflow
    });

    it('should handle negative numbers correctly', () => {
      // Arrange
      const a = toU16(-5); // Convert negative to unsigned 16-bit
      const b = toU16(-10); // Convert negative to unsigned 16-bit
      const expected = toU16(toI16(a) + toI16(b)); // -15

      // Act
      mathOpcodes.add.impl(machine, [], a, b);

      // Assert
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
      expect(toI16(expected)).toBe(-15);
    });
  });

  describe('and', () => {
    it('should perform bitwise AND operation and store the result', () => {
      // Arrange
      const a = 0b1010;
      const b = 0b1100;
      const expected = a & b; // 0b1000 (8)

      // Act
      mathOpcodes.and.impl(machine, [], a, b);

      // Assert
      expect(mockMachine.state.readByte).toHaveBeenCalled();
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`and ${a} ${b}`);
    });

    it('should handle full 16-bit values', () => {
      // Arrange
      const a = 0xaaaa; // 1010 1010 1010 1010
      const b = 0x5555; // 0101 0101 0101 0101
      const expected = a & b; // 0000 0000 0000 0000

      // Act
      mathOpcodes.and.impl(machine, [], a, b);

      // Assert
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
      expect(expected).toBe(0);
    });
  });

  describe('div', () => {
    it('should divide two numbers and store the result', () => {
      // Arrange
      const a = 20;
      const b = 4;
      const expected = toU16(Math.trunc(toI16(a) / toI16(b))); // 5

      // Act
      mathOpcodes.div.impl(machine, [], a, b);

      // Assert
      expect(mockMachine.state.readByte).toHaveBeenCalled();
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`div ${a} ${b}`);
    });

    it('should handle division with truncation toward zero', () => {
      // Arrange
      const a = 21;
      const b = 4;
      const expected = toU16(Math.trunc(toI16(a) / toI16(b))); // 5

      // Act
      mathOpcodes.div.impl(machine, [], a, b);

      // Assert
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
      expect(expected).toBe(5);
    });

    it('should truncate toward zero for negative dividends (Z-spec §15)', () => {
      // Z-spec: -11 / 2 = -5 (truncate toward zero), NOT -6 (Math.floor)
      // Infocom 68K DIVS instruction also truncates toward zero
      const a = toU16(-11);
      const b = 2;

      mathOpcodes.div.impl(machine, [], a, b);

      expect(toI16(mockMachine.state.storeVariable.mock.calls[0][1])).toBe(-5);
    });

    it('should handle negative dividends', () => {
      // Arrange
      const a = toU16(-20);
      const b = 4;
      const expected = toU16(Math.trunc(toI16(a) / toI16(b))); // -5

      // Act
      mathOpcodes.div.impl(machine, [], a, b);

      // Assert
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
      expect(toI16(expected)).toBe(-5);
    });

    it('should handle negative divisors', () => {
      // Arrange
      const a = 20;
      const b = toU16(-4);
      const expected = toU16(Math.trunc(toI16(a) / toI16(b))); // -5

      // Act
      mathOpcodes.div.impl(machine, [], a, b);

      // Assert
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
      expect(toI16(expected)).toBe(-5);
    });

    it('should warn and return 0 when dividing by zero (for V6 compatibility)', () => {
      // Arrange
      const a = 20;
      const b = 0;

      // Act
      mathOpcodes.div.impl(machine, [], a, b);

      // Assert - Z-spec says halt; we return 0 for games that hit this via interpreter edge cases
      expect(mockMachine.logger.warn).toHaveBeenCalledWith('Division by zero; returning 0');
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, 0);
    });
  });

  describe('mod', () => {
    it('should calculate the remainder and store the result', () => {
      // Arrange
      const a = 23;
      const b = 5;
      const expected = toU16(toI16(a) % toI16(b)); // 3

      // Act
      mathOpcodes.mod.impl(machine, [], a, b);

      // Assert
      expect(mockMachine.state.readByte).toHaveBeenCalled();
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`mod ${a} ${b}`);
    });

    it('should handle negative dividends', () => {
      // Arrange
      const a = toU16(-23);
      const b = 5;
      const expected = toU16(toI16(a) % toI16(b)); // -3

      // Act
      mathOpcodes.mod.impl(machine, [], a, b);

      // Assert
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
      expect(toI16(expected)).toBe(-3);
    });

    it('should handle negative divisors', () => {
      // Arrange
      const a = 23;
      const b = toU16(-5);
      const expected = toU16(toI16(a) % toI16(b)); // 3

      // Act
      mathOpcodes.mod.impl(machine, [], a, b);

      // Assert
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
      expect(toI16(expected)).toBe(3);
    });

    it('should warn and return 0 when modulo by zero (for V6 compatibility)', () => {
      // Arrange
      const a = 23;
      const b = 0;

      // Act
      mathOpcodes.mod.impl(machine, [], a, b);

      // Assert - Z-spec says halt; we return 0 for games that hit this via interpreter edge cases
      expect(mockMachine.logger.debug).toHaveBeenCalledWith('Modulo by zero; returning 0');
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, 0);
    });
  });

  describe('mul', () => {
    it('should multiply two numbers and store the result', () => {
      // Arrange
      const a = 7;
      const b = 6;
      const expected = toU16(toI16(a) * toI16(b)); // 42

      // Act
      mathOpcodes.mul.impl(machine, [], a, b);

      // Assert
      expect(mockMachine.state.readByte).toHaveBeenCalled();
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`mul ${a} ${b}`);
    });

    it('should handle negative multipliers', () => {
      // Arrange
      const a = 7;
      const b = toU16(-6);
      const expected = toU16(toI16(a) * toI16(b)); // -42

      // Act
      mathOpcodes.mul.impl(machine, [], a, b);

      // Assert
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
      expect(toI16(expected)).toBe(-42);
    });

    it('should handle overflow correctly', () => {
      // Arrange
      const a = 1000;
      const b = 1000;
      const expected = toU16(toI16(a) * toI16(b)); // 1000000 doesn't fit in 16 bits

      // Act
      mathOpcodes.mul.impl(machine, [], a, b);

      // Assert
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
      // Check that overflow happened correctly
      expect(expected).not.toBe(1000000);
      expect(expected).toBe(toU16(1000000 & 0xffff));
    });
  });

  describe('not', () => {
    it('should perform bitwise NOT operation and store the result', () => {
      // Arrange
      const value = 0xaaaa; // 1010 1010 1010 1010
      const expected = value ^ 0xffff; // 0101 0101 0101 0101

      // Act
      mathOpcodes.not.impl(machine, [], value);

      // Assert
      expect(mockMachine.state.readByte).toHaveBeenCalled();
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`not ${value}`);
    });

    it('should invert all bits in a 16-bit value', () => {
      // Arrange
      const value = 0;
      const expected = 0xffff; // All bits set

      // Act
      mathOpcodes.not.impl(machine, [], value);

      // Assert
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
    });

    it('should handle NOT of 0xFFFF correctly', () => {
      // Arrange
      const value = 0xffff;
      const expected = 0; // All bits cleared

      // Act
      mathOpcodes.not.impl(machine, [], value);

      // Assert
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
    });
  });

  describe('or', () => {
    it('should perform bitwise OR operation and store the result', () => {
      // Arrange
      const a = 0b1010;
      const b = 0b1100;
      const expected = a | b; // 0b1110 (14)

      // Act
      mathOpcodes.or.impl(machine, [], a, b);

      // Assert
      expect(mockMachine.state.readByte).toHaveBeenCalled();
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`or ${a} ${b}`);
    });

    it('should handle full 16-bit values', () => {
      // Arrange
      const a = 0xaaaa; // 1010 1010 1010 1010
      const b = 0x5555; // 0101 0101 0101 0101
      const expected = a | b; // 1111 1111 1111 1111

      // Act
      mathOpcodes.or.impl(machine, [], a, b);

      // Assert
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
      expect(expected).toBe(0xffff);
    });
  });

  describe('sub', () => {
    it('should subtract the second number from the first and store the result', () => {
      // Arrange
      const a = 30;
      const b = 10;
      const expected = toU16(toI16(a) - toI16(b)); // 20

      // Act
      mathOpcodes.sub.impl(machine, [], a, b);

      // Assert
      expect(mockMachine.state.readByte).toHaveBeenCalled();
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`sub ${a} ${b}`);
    });

    it('should handle negative result correctly', () => {
      // Arrange
      const a = 10;
      const b = 20;
      const expected = toU16(toI16(a) - toI16(b)); // -10

      // Act
      mathOpcodes.sub.impl(machine, [], a, b);

      // Assert
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
      expect(toI16(expected)).toBe(-10);
    });

    it('should handle signed 16-bit underflow correctly', () => {
      // Arrange
      const a = 0x8000; // -32768 (min negative value in 16-bit signed)
      const b = 1;
      const expected = toU16(toI16(a) - toI16(b)); // Should wrap to 32767

      // Act
      mathOpcodes.sub.impl(machine, [], a, b);

      // Assert
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
      expect(toI16(expected)).toBeGreaterThan(0); // Should be positive after underflow
    });
  });

  describe('random', () => {
    it('should generate a random number and store the result when range > 0', () => {
      // Arrange
      const range = 100;
      const randomValue = 42;
      vi.mocked(randomUtils.randomInt).mockReturnValue(randomValue);

      // Act
      mathOpcodes.random.impl(machine, [], range);

      // Assert
      expect(mockMachine.state.readByte).toHaveBeenCalled();
      expect(randomUtils.randomInt).toHaveBeenCalledWith(range);
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, randomValue);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`random ${range}`);
    });

    it('should reseed the RNG when range <= 0', () => {
      // Arrange
      const range = -5;

      // Act
      mathOpcodes.random.impl(machine, [], range);

      // Assert
      expect(randomUtils.initRandom).toHaveBeenCalledWith(range.toString());
      expect(randomUtils.randomInt).not.toHaveBeenCalled();
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, 0);
    });

    it('should reseed the RNG when range = 0', () => {
      // Arrange
      const range = 0;

      // Act
      mathOpcodes.random.impl(machine, [], range);

      // Assert
      expect(randomUtils.initRandom).toHaveBeenCalledWith(range.toString());
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, 0);
    });
  });

  describe('art_shift', () => {
    it('should perform left shift when places > 0', () => {
      // Arrange
      const value = 0b0101;
      const places = 2;
      const expected = (value << places) & 0xffff; // 0b010100 (20)

      // Act
      mathOpcodes.art_shift.impl(machine, [], value, places);

      // Assert
      expect(mockMachine.state.readByte).toHaveBeenCalled();
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`art_shift ${value} ${places}`);
    });

    it('should perform arithmetic right shift when places < 0', () => {
      // Arrange
      const value = 0b1010; // 10 in decimal
      const places = toU16(-1); // -1 (right shift by 1)
      const expected = toU16(toI16(value) >> 1); // 0b0101 (5)

      // Act
      mathOpcodes.art_shift.impl(machine, [], value, places);

      // Assert
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
      expect(expected).toBe(5);
    });

    it('should preserve sign bit during right shift', () => {
      // Arrange
      const value = 0x8010; // Negative number in 16-bit signed
      const places = toU16(-4); // -4 (right shift by 4)
      const expected = toU16(toI16(value) >> 4);

      // Act
      mathOpcodes.art_shift.impl(machine, [], value, places);

      // Assert
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
      // Check that the sign bit is preserved
      expect(toI16(expected)).toBeLessThan(0);
    });
  });

  describe('log_shift', () => {
    it('should perform left shift when places > 0', () => {
      // Arrange
      const value = 0b0101;
      const places = 2;
      const expected = (value << places) & 0xffff; // 0b010100 (20)

      // Act
      mathOpcodes.log_shift.impl(machine, [], value, places);

      // Assert
      expect(mockMachine.state.readByte).toHaveBeenCalled();
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`log_shift ${value} ${places}`);
    });

    it('should perform logical right shift when places < 0', () => {
      // Arrange
      const value = 0b1010; // 10 in decimal
      const places = toU16(-1); // -1 (right shift by 1)
      const expected = (value >>> 1) & 0xffff; // 0b0101 (5)

      // Act
      mathOpcodes.log_shift.impl(machine, [], value, places);

      // Assert
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
      expect(expected).toBe(5);
    });

    it('should NOT preserve sign bit during logical right shift', () => {
      // Arrange
      const value = 0x8010; // Negative number in 16-bit signed
      const places = toU16(-4); // -4 (right shift by 4)
      const expected = (value >>> 4) & 0xffff;

      // Act
      mathOpcodes.log_shift.impl(machine, [], value, places);

      // Assert
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, expected);
      // This should be different from art_shift - bits shifted in should be 0
      expect(expected).toBe(0x0801);
      // Should still be positive since most significant bit is zeroed out
      expect(toI16(expected)).toBeGreaterThanOrEqual(0);
    });
  });
});
