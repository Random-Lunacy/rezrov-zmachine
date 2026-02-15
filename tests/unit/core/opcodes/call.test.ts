import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callOpcodes } from '../../../../src/core/opcodes/call';
import { ZMachine } from '../../../../src/interpreter/ZMachine';
import { Logger, LogLevel } from '../../../../src/utils/log';
import { createMockZMachine } from '../../../mocks';

describe('Call Opcodes', () => {
  let mockZMachine: ReturnType<typeof createMockZMachine>;

  beforeEach(() => {
    Logger.setLevel(LogLevel.DEBUG);
    mockZMachine = createMockZMachine();

    // Mock all the validation methods that validateAndUnpackRoutine calls
    mockZMachine.memory.unpackRoutineAddress = vi.fn().mockImplementation((addr) => addr * 2);
    mockZMachine.memory.isValidRoutineAddress = vi.fn().mockReturnValue(true); // ← Fix this
    mockZMachine.memory.checkPackedAddressAlignment = vi.fn().mockReturnValue(true);
    mockZMachine.state.memory.validateRoutineHeader = vi.fn().mockReturnValue(true); // ← Fix this
    mockZMachine.state.readByte = vi.fn().mockReturnValueOnce(0x42);

    // Mock logger methods to capture logs
    mockZMachine.logger.error = vi.fn();
    mockZMachine.logger.debug = vi.fn();
  });

  describe('call_1s opcode', () => {
    it('should call a routine with a single argument and store result', () => {
      // Setup
      const routine = 0x1234;
      const resultVar = 0x42;
      const unpackedAddr = routine * 2; // 0x2468

      mockZMachine.state.readByte = vi.fn().mockReturnValueOnce(resultVar);

      // Execute
      callOpcodes.call_1s.impl(mockZMachine as unknown as ZMachine, [], routine);

      // Verify
      expect(mockZMachine.state.readByte).toHaveBeenCalled();
      expect(mockZMachine.memory.unpackRoutineAddress).toHaveBeenCalledWith(routine);
      expect(mockZMachine.state.callRoutine).toHaveBeenCalledWith(unpackedAddr, resultVar);
    });

    it('should store 0 when routine address is 0', () => {
      // Setup
      const routine = 0;
      const resultVar = 0x42;
      mockZMachine.state.readByte = vi.fn().mockReturnValueOnce(resultVar);

      // Execute
      callOpcodes.call_1s.impl(mockZMachine as unknown as ZMachine, [], routine);

      // Verify
      expect(mockZMachine.state.storeVariable).toHaveBeenCalledWith(resultVar, 0);
      expect(mockZMachine.state.callRoutine).not.toHaveBeenCalled();
    });

    it('should throw error when unpacking routine address fails', () => {
      const routine = 0x1234;
      const resultVar = 0x42;
      mockZMachine.state.readByte = vi.fn().mockReturnValueOnce(resultVar);

      // Mock unpackRoutineAddress to throw
      mockZMachine.memory.unpackRoutineAddress = vi.fn().mockImplementation(() => {
        throw new Error('Packed address out of range');
      });

      expect(() => {
        callOpcodes.call_1s.impl(mockZMachine as unknown as ZMachine, [], routine);
      }).toThrow(/Invalid routine address/);

      expect(mockZMachine.memory.unpackRoutineAddress).toHaveBeenCalledWith(routine);
    });

    it('should throw error when routine address is not in valid memory', () => {
      const routine = 0x1234;

      // Mock validation to fail at the isValidRoutineAddress check
      mockZMachine.memory.isValidRoutineAddress.mockReturnValueOnce(false);

      expect(() => {
        callOpcodes.call_1s.impl(mockZMachine as unknown as ZMachine, [], routine);
      }).toThrow(/Invalid routine address/);

      expect(mockZMachine.memory.unpackRoutineAddress).toHaveBeenCalledWith(routine);
      expect(mockZMachine.memory.isValidRoutineAddress).toHaveBeenCalled();
    });
  });

  describe('call_1n opcode', () => {
    it('should call a routine with a single argument and discard result', () => {
      // Setup
      const routine = 0x1234;
      const unpackedAddr = routine * 2; // 0x2468

      // Execute
      callOpcodes.call_1n.impl(mockZMachine as unknown as ZMachine, [], routine);

      // Verify
      expect(mockZMachine.memory.unpackRoutineAddress).toHaveBeenCalledWith(routine);
      expect(mockZMachine.state.callRoutine).toHaveBeenCalledWith(unpackedAddr, null);
    });

    it('should do nothing when routine address is 0', () => {
      // Setup
      const routine = 0;

      // Execute
      callOpcodes.call_1n.impl(mockZMachine as unknown as ZMachine, [], routine);

      // Verify
      expect(mockZMachine.state.callRoutine).not.toHaveBeenCalled();
    });
  });

  describe('call_2s opcode', () => {
    it('should call a routine with two arguments and store result', () => {
      // Setup
      const routine = 0x1234;
      const arg1 = 42;
      const resultVar = 0x42;
      const unpackedAddr = routine * 2; // 0x2468

      mockZMachine.state.readByte.mockReturnValueOnce(resultVar);

      // Execute
      callOpcodes.call_2s.impl(mockZMachine as unknown as ZMachine, [], routine, arg1);

      // Verify
      expect(mockZMachine.state.readByte).toHaveBeenCalled();
      expect(mockZMachine.memory.unpackRoutineAddress).toHaveBeenCalledWith(routine);
      expect(mockZMachine.state.callRoutine).toHaveBeenCalledWith(unpackedAddr, resultVar, arg1);
    });

    it('should store 0 when routine address is 0', () => {
      const routine = 0;
      const arg1 = 42;
      const resultVar = 0x42;
      mockZMachine.state.readByte.mockReturnValueOnce(resultVar);

      callOpcodes.call_2s.impl(mockZMachine as unknown as ZMachine, [], routine, arg1);

      expect(mockZMachine.state.storeVariable).toHaveBeenCalledWith(resultVar, 0);
      expect(mockZMachine.state.callRoutine).not.toHaveBeenCalled();
    });
  });

  describe('call_2n opcode', () => {
    it('should call a routine with two arguments and discard result', () => {
      // Setup
      const routine = 0x1234;
      const arg1 = 42;
      const unpackedAddr = routine * 2; // 0x2468

      // Execute
      callOpcodes.call_2n.impl(mockZMachine as unknown as ZMachine, [], routine, arg1);

      // Verify
      expect(mockZMachine.memory.unpackRoutineAddress).toHaveBeenCalledWith(routine);
      expect(mockZMachine.state.callRoutine).toHaveBeenCalledWith(unpackedAddr, null, arg1);
    });

    it('should do nothing when routine address is 0', () => {
      const routine = 0;
      const arg1 = 42;

      callOpcodes.call_2n.impl(mockZMachine as unknown as ZMachine, [], routine, arg1);

      expect(mockZMachine.state.callRoutine).not.toHaveBeenCalled();
    });
  });

  describe('call_vs opcode', () => {
    it('should call a routine with variable arguments and store result', () => {
      // Setup
      const routine = 0x1234;
      const args = [42, 99, 128];
      const resultVar = 0x42;
      const unpackedAddr = routine * 2; // 0x2468

      mockZMachine.state.readByte.mockReturnValueOnce(resultVar);

      // Execute
      callOpcodes.call_vs.impl(mockZMachine as unknown as ZMachine, [], routine, ...args);

      // Verify
      expect(mockZMachine.state.readByte).toHaveBeenCalled();
      expect(mockZMachine.memory.unpackRoutineAddress).toHaveBeenCalledWith(routine);
      expect(mockZMachine.state.callRoutine).toHaveBeenCalledWith(unpackedAddr, resultVar, ...args);
    });

    it('should store 0 for routine address 0', () => {
      // Setup
      const routine = 0;
      const args = [42, 99];
      const resultVar = 0x42;
      mockZMachine.state.readByte.mockReturnValueOnce(resultVar);

      // Execute
      callOpcodes.call_vs.impl(mockZMachine as unknown as ZMachine, [], routine, ...args);

      // Verify
      expect(mockZMachine.state.storeVariable).toHaveBeenCalledWith(resultVar, 0);
      expect(mockZMachine.state.callRoutine).not.toHaveBeenCalled();
    });
  });

  describe('call_vs2 opcode', () => {
    it('should behave like call_vs (just a different encoding)', () => {
      // Setup
      const routine = 0x1234;
      const args = [42, 99];
      const resultVar = 0x42;
      const unpackedAddr = routine * 2; // 0x2468

      mockZMachine.state.readByte.mockReturnValueOnce(resultVar);

      // Execute
      callOpcodes.call_vs2.impl(mockZMachine as unknown as ZMachine, [], routine, ...args);

      // Verify
      expect(mockZMachine.state.readByte).toHaveBeenCalled();
      expect(mockZMachine.memory.unpackRoutineAddress).toHaveBeenCalledWith(routine);
      expect(mockZMachine.state.callRoutine).toHaveBeenCalledWith(unpackedAddr, resultVar, ...args);
    });

    it('should store 0 for routine address 0', () => {
      const routine = 0;
      const args = [42, 99];
      const resultVar = 0x42;
      mockZMachine.state.readByte.mockReturnValueOnce(resultVar);

      callOpcodes.call_vs2.impl(mockZMachine as unknown as ZMachine, [], routine, ...args);

      expect(mockZMachine.state.storeVariable).toHaveBeenCalledWith(resultVar, 0);
      expect(mockZMachine.state.callRoutine).not.toHaveBeenCalled();
    });
  });

  describe('call_vn opcode', () => {
    it('should call a routine with variable arguments and discard result', () => {
      // Setup
      const routine = 0x1234;
      const args = [42, 99, 128];
      const unpackedAddr = routine * 2; // 0x2468

      // Execute
      callOpcodes.call_vn.impl(mockZMachine as unknown as ZMachine, [], routine, ...args);

      // Verify
      expect(mockZMachine.memory.unpackRoutineAddress).toHaveBeenCalledWith(routine);
      expect(mockZMachine.state.callRoutine).toHaveBeenCalledWith(unpackedAddr, null, ...args);
    });

    it('should do nothing when routine address is 0', () => {
      const routine = 0;
      const args = [42, 99];

      callOpcodes.call_vn.impl(mockZMachine as unknown as ZMachine, [], routine, ...args);

      expect(mockZMachine.state.callRoutine).not.toHaveBeenCalled();
    });
  });

  describe('call_vn2 opcode', () => {
    it('should behave like call_vn (just a different encoding)', () => {
      // Setup
      const routine = 0x1234;
      const args = [42, 99];
      const unpackedAddr = routine * 2; // 0x2468

      // Execute
      callOpcodes.call_vn2.impl(mockZMachine as unknown as ZMachine, [], routine, ...args);

      // Verify
      expect(mockZMachine.memory.unpackRoutineAddress).toHaveBeenCalledWith(routine);
      expect(mockZMachine.state.callRoutine).toHaveBeenCalledWith(unpackedAddr, null, ...args);
    });

    it('should do nothing when routine address is 0', () => {
      const routine = 0;
      const args = [42, 99];

      callOpcodes.call_vn2.impl(mockZMachine as unknown as ZMachine, [], routine, ...args);

      expect(mockZMachine.state.callRoutine).not.toHaveBeenCalled();
    });
  });

  describe('catch opcode', () => {
    it('should store the current call frame index', () => {
      // Setup
      const resultVar = 0x42;
      mockZMachine.state.readByte.mockReturnValueOnce(resultVar);

      // Mock the callstack with a getter
      const mockCallstack = [1, 2, 3];
      Object.defineProperty(mockZMachine.state, 'callstack', {
        get: () => mockCallstack,
      });

      // Execute
      callOpcodes.Catch.impl(mockZMachine as unknown as ZMachine, []);

      // Verify - should store length - 1 (2)
      expect(mockZMachine.state.storeVariable).toHaveBeenCalledWith(resultVar, 2);
    });
  });

  describe('throw opcode', () => {
    it('should unwind the stack to the specified frame and return value', () => {
      // Setup
      const returnVal = 0x99;
      const frameNum = 2;

      // Properly mock the callstack and its splice method
      const mockCallstack = [0, 1, 2, 3, 4];
      const mockSplice = vi.fn();
      Object.defineProperty(mockZMachine.state, 'callstack', {
        get: () => ({
          length: mockCallstack.length,
          splice: mockSplice,
        }),
      });

      // Execute
      callOpcodes.Throw.impl(mockZMachine as unknown as ZMachine, [], returnVal, frameNum);

      // Verify
      expect(mockSplice).toHaveBeenCalledWith(frameNum + 1);
      expect(mockZMachine.state.returnFromRoutine).toHaveBeenCalledWith(returnVal);
    });

    it('should throw error when frame number is invalid', () => {
      // Setup
      const returnVal = 0x99;
      const frameNum = 10; // Invalid - we only have 3 frames

      // Simulate having 3 call frames with a getter
      Object.defineProperty(mockZMachine.state, 'callstack', {
        get: () => ({ length: 3 }),
      });

      // Execute & Verify
      expect(() => callOpcodes.Throw.impl(mockZMachine as unknown as ZMachine, [], returnVal, frameNum)).toThrow(
        /Invalid frame number/
      );
    });
  });

  describe('validateAndUnpackRoutine helper function', () => {
    it('should reject invalid routine address', () => {
      // Setup for testing the internal helper via call_1s
      const routine = 0x1234;
      const resultVar = 0x42;
      mockZMachine.state.readByte.mockReturnValueOnce(resultVar);

      // Force an error during validation
      mockZMachine.memory.unpackRoutineAddress.mockImplementationOnce(() => {
        throw new Error('Test error');
      });

      // Execute & Verify
      expect(() => callOpcodes.call_1s.impl(mockZMachine as unknown as ZMachine, [], routine)).toThrow(
        /Invalid routine address/
      );
      expect(mockZMachine.logger.error).toHaveBeenCalled();
    });
  });
});
