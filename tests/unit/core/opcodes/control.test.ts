import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toI16 } from '../../../../src/core/memory/cast16';
import { controlOpcodes } from '../../../../src/core/opcodes/control';
import { ZMachine } from '../../../../src/interpreter/ZMachine';
import { Logger, LogLevel } from '../../../../src/utils/log';
import { createMockZMachine } from '../../../mocks';

// Suppress console output during tests
Logger.setLevel(LogLevel.ERROR);

describe('Control opcodes', () => {
  let mockZMachine: ReturnType<typeof createMockZMachine>;

  beforeEach(() => {
    mockZMachine = createMockZMachine();
    // Mock necessary methods and properties
    vi.spyOn(mockZMachine.state, 'doBranch');
    vi.spyOn(mockZMachine.state, 'readBranchOffset').mockReturnValue([2, true]);
    vi.spyOn(mockZMachine.state, 'returnFromRoutine');
  });

  describe('je (Jump if Equal)', () => {
    it('should branch when first arg equals one of the other args', () => {
      // Test with 2 arguments (a equals b)
      controlOpcodes.je.impl(mockZMachine as unknown as ZMachine, [], 42, 42);
      expect(mockZMachine.state.doBranch).toHaveBeenCalledWith(true, true, 2);

      // Reset mock
      vi.clearAllMocks();

      // Test with 2 arguments (a does not equal b)
      controlOpcodes.je.impl(mockZMachine as unknown as ZMachine, [], 42, 99);
      expect(mockZMachine.state.doBranch).toHaveBeenCalledWith(false, true, 2);

      // Reset mock
      vi.clearAllMocks();

      // Test with multiple arguments (a equals one of them)
      controlOpcodes.je.impl(mockZMachine as unknown as ZMachine, [], 42, 10, 42, 30);
      expect(mockZMachine.state.doBranch).toHaveBeenCalledWith(true, true, 2);

      // Reset mock
      vi.clearAllMocks();

      // Test with multiple arguments (a equals none of them)
      controlOpcodes.je.impl(mockZMachine as unknown as ZMachine, [], 42, 10, 20, 30);
      expect(mockZMachine.state.doBranch).toHaveBeenCalledWith(false, true, 2);
    });

    it('should throw an error if fewer than 2 operands are provided', () => {
      expect(() => {
        controlOpcodes.je.impl(mockZMachine as unknown as ZMachine, [], 42);
      }).toThrow('je opcode requires at least 2 operands');
    });
  });

  describe('jl (Jump if Less Than)', () => {
    it('should branch when first arg is less than second arg', () => {
      // Test with signed values (a < b)
      controlOpcodes.jl.impl(mockZMachine as unknown as ZMachine, [], 10, 20);
      expect(mockZMachine.state.doBranch).toHaveBeenCalledWith(true, true, 2);

      // Reset mock
      vi.clearAllMocks();

      // Test with signed values (a >= b)
      controlOpcodes.jl.impl(mockZMachine as unknown as ZMachine, [], 20, 10);
      expect(mockZMachine.state.doBranch).toHaveBeenCalledWith(false, true, 2);

      // Test with negative values
      vi.clearAllMocks();
      controlOpcodes.jl.impl(mockZMachine as unknown as ZMachine, [], toI16(-10), toI16(-5));
      expect(mockZMachine.state.doBranch).toHaveBeenCalledWith(true, true, 2);

      // Test with negative and positive
      vi.clearAllMocks();
      controlOpcodes.jl.impl(mockZMachine as unknown as ZMachine, [], toI16(-10), 5);
      expect(mockZMachine.state.doBranch).toHaveBeenCalledWith(true, true, 2);
    });
  });

  describe('jg (Jump if Greater Than)', () => {
    it('should branch when first arg is greater than second arg', () => {
      // Test with signed values (a > b)
      controlOpcodes.jg.impl(mockZMachine as unknown as ZMachine, [], 20, 10);
      expect(mockZMachine.state.doBranch).toHaveBeenCalledWith(true, true, 2);

      // Reset mock
      vi.clearAllMocks();

      // Test with signed values (a <= b)
      controlOpcodes.jg.impl(mockZMachine as unknown as ZMachine, [], 10, 20);
      expect(mockZMachine.state.doBranch).toHaveBeenCalledWith(false, true, 2);

      // Test with negative values
      vi.clearAllMocks();
      controlOpcodes.jg.impl(mockZMachine as unknown as ZMachine, [], toI16(-5), toI16(-10));
      expect(mockZMachine.state.doBranch).toHaveBeenCalledWith(true, true, 2);

      // Test with negative and positive
      vi.clearAllMocks();
      controlOpcodes.jg.impl(mockZMachine as unknown as ZMachine, [], 5, toI16(-10));
      expect(mockZMachine.state.doBranch).toHaveBeenCalledWith(true, true, 2);
    });
  });

  describe('jz (Jump if Zero)', () => {
    it('should branch when arg is zero', () => {
      // Test with zero
      controlOpcodes.jz.impl(mockZMachine as unknown as ZMachine, [], 0);
      expect(mockZMachine.state.doBranch).toHaveBeenCalledWith(true, true, 2);

      // Reset mock
      vi.clearAllMocks();

      // Test with non-zero
      controlOpcodes.jz.impl(mockZMachine as unknown as ZMachine, [], 42);
      expect(mockZMachine.state.doBranch).toHaveBeenCalledWith(false, true, 2);
    });
  });

  describe('jump', () => {
    it('should update program counter with relative offset', () => {
      // Setup
      const initialPC = 1000;
      vi.spyOn(mockZMachine.state, 'pc', 'get').mockReturnValue(initialPC);
      const pcSetter = vi.spyOn(mockZMachine.state, 'pc', 'set');

      // Test with positive offset
      controlOpcodes.jump.impl(mockZMachine as unknown as ZMachine, [], 50);
      expect(pcSetter).toHaveBeenCalledWith(initialPC + 50 - 2);

      // Reset mock
      vi.clearAllMocks();
      vi.spyOn(mockZMachine.state, 'pc', 'get').mockReturnValue(initialPC);

      // Test with negative offset
      controlOpcodes.jump.impl(mockZMachine as unknown as ZMachine, [], -50);
      expect(pcSetter).toHaveBeenCalledWith(initialPC - 50 - 2);
    });
  });

  describe('test', () => {
    it('should branch if all specified bits in bitmap are set', () => {
      // Test when all bits are set
      controlOpcodes.test.impl(mockZMachine as unknown as ZMachine, [], 0b1111, 0b0101);
      expect(mockZMachine.state.doBranch).toHaveBeenCalledWith(true, true, 2);

      // Reset mock
      vi.clearAllMocks();

      // Test when not all bits are set
      controlOpcodes.test.impl(mockZMachine as unknown as ZMachine, [], 0b1100, 0b1101);
      expect(mockZMachine.state.doBranch).toHaveBeenCalledWith(false, true, 2);
    });
  });

  describe('check_arg_count', () => {
    it('should branch if specified argument number is provided', () => {
      // Setup
      vi.spyOn(mockZMachine.state, 'getArgumentCount').mockReturnValue(3);

      // Test with argument number within count
      controlOpcodes.check_arg_count.impl(mockZMachine as unknown as ZMachine, [], 3);
      expect(mockZMachine.state.doBranch).toHaveBeenCalledWith(true, true, 2);

      // Reset mock
      vi.clearAllMocks();
      vi.spyOn(mockZMachine.state, 'getArgumentCount').mockReturnValue(3);

      // Test with argument number outside count
      controlOpcodes.check_arg_count.impl(mockZMachine as unknown as ZMachine, [], 4);
      expect(mockZMachine.state.doBranch).toHaveBeenCalledWith(false, true, 2);
    });
  });

  describe('Return opcodes', () => {
    it('rtrue should return 1', () => {
      controlOpcodes.rtrue.impl(mockZMachine as unknown as ZMachine, []);
      expect(mockZMachine.state.returnFromRoutine).toHaveBeenCalledWith(1);
    });

    it('rfalse should return 0', () => {
      controlOpcodes.rfalse.impl(mockZMachine as unknown as ZMachine, []);
      expect(mockZMachine.state.returnFromRoutine).toHaveBeenCalledWith(0);
    });

    it('ret should return specified value', () => {
      controlOpcodes.ret.impl(mockZMachine as unknown as ZMachine, [], 42);
      expect(mockZMachine.state.returnFromRoutine).toHaveBeenCalledWith(42);
    });

    it('ret_popped should return value from stack', () => {
      // Setup
      vi.spyOn(mockZMachine.state, 'popStack').mockReturnValue(99);

      controlOpcodes.ret_popped.impl(mockZMachine as unknown as ZMachine, []);
      expect(mockZMachine.state.popStack).toHaveBeenCalled();
      expect(mockZMachine.state.returnFromRoutine).toHaveBeenCalledWith(99);
    });
  });

  describe('nop', () => {
    it('should do nothing', () => {
      // We're just verifying it doesn't throw an error
      expect(() => controlOpcodes.nop.impl(mockZMachine as unknown as ZMachine, [])).not.toThrow();
    });
  });
});
