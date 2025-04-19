import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Executor } from '../../src/core/execution/Executor';
import { SuspendState } from '../../src/core/execution/SuspendState';

// Create mocks
vi.mock('../../src/interpreter/ZMachine');
vi.mock('../../src/utils/log');

describe('Executor', () => {
  let mockZMachine: any;
  let mockLogger: any;
  let mockState: any;
  let executor: Executor;

  beforeEach(() => {
    // Setup mocks
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockState = {
      pc: 0x1000,
      readByte: vi.fn(),
      readWord: vi.fn(),
      readBranchOffset: vi.fn(),
      readZString: vi.fn(),
      storeVariable: vi.fn(),
      loadVariable: vi.fn(),
      logger: mockLogger,
      version: 3,
      doBranch: vi.fn(),
    };

    mockZMachine = {
      state: mockState,
      logger: mockLogger,
      screen: {
        getKeyFromUser: vi.fn(),
        getInputFromUser: vi.fn(),
      },
      memory: {
        getByte: vi.fn(),
        getWord: vi.fn(),
      },
      handleTimedInput: vi.fn(),
    };

    // Create the executor with mocked dependencies
    executor = new Executor(mockZMachine, mockLogger);
  });

  describe('executeLoop', () => {
    it('should execute until quit is called', () => {
      // Setup - Mock a simple instruction execution
      const executeInstructionSpy = vi.spyOn(executor, 'executeInstruction').mockImplementation(() => {
        // After first call, set _quit to true
        Object.defineProperty(executor, '_quit', { value: true });
      });

      // Act
      executor.executeLoop();

      // Assert
      expect(executeInstructionSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle SuspendState exceptions', () => {
      // Setup - Create a SuspendState to throw
      const inputState = {
        keyPress: false,
        resultVar: 42,
        textBuffer: 0x1000,
        parseBuffer: 0x1100,
      };

      const suspendState = new SuspendState(inputState);

      // Make executeInstruction throw the SuspendState
      vi.spyOn(executor, 'executeInstruction').mockImplementation(() => {
        throw suspendState;
      });

      // Mock setImmediate to call the callback immediately
      vi.stubGlobal('setImmediate', (callback: () => void) => {
        callback();
      });

      // Act
      executor.executeLoop();

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Suspended for text input'));
      expect(mockZMachine.screen.getInputFromUser).toHaveBeenCalledWith(mockZMachine, inputState);
    });

    it('should handle keypress SuspendState exceptions', () => {
      // Setup - Create a SuspendState to throw for key press
      const inputState = {
        keyPress: true,
        resultVar: 42,
      };

      const suspendState = new SuspendState(inputState);

      // Make executeInstruction throw the SuspendState
      vi.spyOn(executor, 'executeInstruction').mockImplementation(() => {
        throw suspendState;
      });

      // Mock setImmediate to call the callback immediately
      vi.stubGlobal('setImmediate', (callback: () => void) => {
        callback();
      });

      // Act
      executor.executeLoop();

      // Assert
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Suspended for key input'));
      expect(mockZMachine.screen.getKeyFromUser).toHaveBeenCalledWith(mockZMachine, inputState);
    });

    it('should handle timed input', () => {
      // Setup - Create a SuspendState with time and routine
      const inputState = {
        keyPress: false,
        resultVar: 42,
        textBuffer: 0x1000,
        parseBuffer: 0x1100,
        time: 10,
        routine: 0x2000,
      };

      const suspendState = new SuspendState(inputState);

      // Make executeInstruction throw the SuspendState
      vi.spyOn(executor, 'executeInstruction').mockImplementation(() => {
        throw suspendState;
      });

      // Mock setImmediate to call the callback immediately
      vi.stubGlobal('setImmediate', (callback: () => void) => {
        callback();
      });

      // Act
      executor.executeLoop();

      // Assert
      expect(mockZMachine.handleTimedInput).toHaveBeenCalledWith(10, 0x2000);
    });

    it('should handle other exceptions', () => {
      // Setup - Make executeInstruction throw a regular Error
      const error = new Error('Test error');
      vi.spyOn(executor, 'executeInstruction').mockImplementation(() => {
        throw error;
      });

      // Act & Assert
      expect(() => executor.executeLoop()).toThrow('Test error');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('executeInstruction', () => {
    it('should execute Long form instructions', () => {
      // Setup
      // Mock opcode 0x15 = 00010101b = sub opcode
      mockState.readByte.mockReturnValueOnce(0x15);

      // Mock operand types (both Small)

      // Mock operands
      mockState.readByte.mockReturnValueOnce(5); // First operand
      mockState.readByte.mockReturnValueOnce(3); // Second operand

      // Mock the op implementation
      const mockSubOpcode = {
        mnemonic: 'sub',
        impl: vi.fn(),
      };

      // Setup the opcode
      Object.defineProperty(executor, 'op2', {
        value: Array(32).fill(null),
      });
      executor.op2[0x15 & 0x1f] = mockSubOpcode;

      // Act
      executor.executeInstruction();

      // Assert
      expect(mockState.readByte).toHaveBeenCalledTimes(3); // Opcode + 2 operands
      expect(mockSubOpcode.impl).toHaveBeenCalledWith(mockZMachine, 5, 3);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Executing op = sub'));
    });

    it('should execute Short form instructions', () => {
      // Setup
      // Mock opcode 0x90 = 10010000b = short form, jz opcode
      mockState.readByte.mockReturnValueOnce(0x90);

      // Mock operand value
      mockState.readByte.mockReturnValueOnce(42); // Operand

      // Mock the op implementation
      const mockJzOpcode = {
        mnemonic: 'jz',
        impl: vi.fn(),
      };

      // Setup the opcode
      Object.defineProperty(executor, 'op1', {
        value: Array(16).fill(null),
      });
      executor.op1[0] = mockJzOpcode; // jz is the 0th opcode in op1

      // Act
      executor.executeInstruction();

      // Assert
      expect(mockState.readByte).toHaveBeenCalledTimes(2); // Opcode + 1 operand
      expect(mockJzOpcode.impl).toHaveBeenCalledWith(mockZMachine, 42);
    });

    it('should execute Variable form instructions', () => {
      // Setup
      // Mock opcode 0xE0 = 11100000b = variable form, call_vs opcode
      mockState.readByte.mockReturnValueOnce(0xe0);

      // Mock operand types byte (all Large = 0)
      mockState.readByte.mockReturnValueOnce(0x00); // 00000000b = 2 large operands

      // Mock operands
      mockState.readWord.mockReturnValueOnce(0x1234); // First operand
      mockState.readWord.mockReturnValueOnce(0x5678); // Second operand

      // Mock the op implementation
      const mockCallVsOpcode = {
        mnemonic: 'call_vs',
        impl: vi.fn(),
      };

      // Setup the opcode
      Object.defineProperty(executor, 'opv', {
        value: Array(32).fill(null),
      });
      executor.opV[0] = mockCallVsOpcode; // call_vs is the 0th opcode in opv

      // Act
      executor.executeInstruction();

      // Assert
      expect(mockState.readByte).toHaveBeenCalledTimes(2); // Opcode + operand types
      expect(mockState.readWord).toHaveBeenCalledTimes(2); // 2 large operands
      expect(mockCallVsOpcode.impl).toHaveBeenCalledWith(mockZMachine, 0x1234, 0x5678);
    });

    it('should execute Extended form instructions (V5+)', () => {
      // Setup V5 state
      mockState.version = 5;

      // Mock opcode 0xBE = 10111110b = extended form
      mockState.readByte.mockReturnValueOnce(0xbe);

      // Mock extended opcode
      mockState.readByte.mockReturnValueOnce(0x04); // set_font

      // Mock operand types byte
      mockState.readByte.mockReturnValueOnce(0x10); // 00010000b = 1 small operand

      // Mock operand
      mockState.readByte.mockReturnValueOnce(3); // Font number

      // Mock the op implementation
      const mockSetFontOpcode = {
        mnemonic: 'set_font',
        impl: vi.fn(),
      };

      // Setup the opcode
      Object.defineProperty(executor, 'opExt', {
        value: Array(32).fill(null),
      });
      executor.opExt[4] = mockSetFontOpcode; // set_font is the 4th opcode in opExt

      // Act
      executor.executeInstruction();

      // Assert
      expect(mockState.readByte).toHaveBeenCalledTimes(4); // Opcode + ext opcode + operand types + 1 small operand
      expect(mockSetFontOpcode.impl).toHaveBeenCalledWith(mockZMachine, 3);
    });

    it('should handle missing opcode implementations', () => {
      // Setup
      // Mock opcode for unknown operation
      mockState.readByte.mockReturnValueOnce(0x15); // Sub opcode

      // Mock operand reads
      mockState.readByte.mockReturnValueOnce(5);
      mockState.readByte.mockReturnValueOnce(3);

      // Setup the opcode table with empty slots
      Object.defineProperty(executor, 'op2', {
        value: Array(32).fill(null),
      });

      // Act & Assert
      expect(() => executor.executeInstruction()).toThrow(/No implementation found for opcode/);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('properties and getters', () => {
    it('should return the op_pc value', () => {
      // Setup
      Object.defineProperty(executor, '_op_pc', { value: 0x4321 });

      // Act & Assert
      expect(executor.op_pc).toBe(0x4321);
    });

    it('should return the suspendedInputState when suspended', () => {
      // Setup
      const inputState = { keyPress: false, resultVar: 42 };
      Object.defineProperty(executor, '_suspended', { value: true });
      Object.defineProperty(executor, '_suspendedInputState', { value: inputState });

      // Act & Assert
      expect(executor.suspendedInputState).toBe(inputState);
    });

    it('should return null for suspendedInputState when not suspended', () => {
      // Setup
      const inputState = { keyPress: false, resultVar: 42 };
      Object.defineProperty(executor, '_suspended', { value: false });
      Object.defineProperty(executor, '_suspendedInputState', { value: inputState });

      // Act & Assert
      expect(executor.suspendedInputState).toBeNull();
    });

    it('should return the isSuspended value', () => {
      // Setup
      Object.defineProperty(executor, '_suspended', { value: true });

      // Act & Assert
      expect(executor.isSuspended).toBe(true);
    });
  });

  describe('resume', () => {
    it('should clear suspension state and continue execution', () => {
      // Setup
      Object.defineProperty(executor, '_suspended', { value: true, writable: true });
      Object.defineProperty(executor, '_suspendedInputState', {
        value: { keyPress: false, resultVar: 42 },
        writable: true,
      });

      // Mock executeLoop to avoid actual execution
      const executeLoopSpy = vi.spyOn(executor, 'executeLoop').mockImplementation(() => {});

      // Act
      executor.resume();

      // Assert
      expect(executor['_suspended']).toBe(false);
      expect(executor['_suspendedInputState']).toBeNull();
      expect(executeLoopSpy).toHaveBeenCalled();
    });
  });

  describe('quit', () => {
    it('should set the quit flag', () => {
      // Setup
      Object.defineProperty(executor, '_quit', { value: false, writable: true });

      // Act
      executor.quit();

      // Assert
      expect(executor['_quit']).toBe(true);
    });
  });
});
