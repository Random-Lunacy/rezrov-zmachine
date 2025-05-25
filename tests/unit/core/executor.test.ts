import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Executor } from '../../../src/core/execution/Executor';
import { SuspendState } from '../../../src/core/execution/SuspendState';
import { ZMachine } from '../../../src/interpreter/ZMachine';
import { OperandType } from '../../../src/types';
import { InputMode } from '../../../src/ui/input/InputInterface';
import { MockZMachine } from '../../mocks';

describe('Executor', () => {
  let mockZMachine: MockZMachine;
  let executor: Executor;

  beforeEach(() => {
    // Create a mock ZMachine
    mockZMachine = new MockZMachine();

    // Create executor with the mock ZMachine
    executor = new Executor(mockZMachine as unknown as ZMachine, { logger: mockZMachine.logger });

    // Attach executor to the mock ZMachine
    mockZMachine.executor = executor;
  });

  describe('executeLoop', () => {
    it('should execute until quit is called', () => {
      // Spy on executeInstruction to control the flow
      const executeInstructionSpy = vi.spyOn(executor, 'executeInstruction').mockImplementation(async () => {
        // Set the quit flag after first execution
        Object.defineProperty(executor, '_quit', { value: true });
      });

      // Run the execution loop
      executor.executeLoop();

      // Verify executeInstruction was called
      expect(executeInstructionSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle SuspendState exceptions for text input', () => {
      // Setup a suspension state for text input
      const inputState = {
        keyPress: false,
        resultVar: 42,
        textBuffer: 0x1000,
        parseBuffer: 0x1100,
      };

      const suspendState = new SuspendState(inputState);

      // Make executeInstruction throw SuspendState
      vi.spyOn(executor, 'executeInstruction').mockImplementation(() => {
        throw suspendState;
      });

      // Mock setImmediate to execute the callback immediately
      vi.stubGlobal('setImmediate', (callback: () => void) => {
        callback();
      });

      // Execute the loop
      executor.executeLoop();

      // Verify suspension was handled properly
      expect(mockZMachine.inputProcessor.startTextInput).toHaveBeenCalledWith(
        mockZMachine,
        expect.objectContaining({
          resultVar: 42,
          textBuffer: 0x1000,
          parseBuffer: 0x1100,
          mode: InputMode.TEXT,
        })
      );
    });

    it('should handle SuspendState exceptions for key input', () => {
      // Setup a suspension state for key input
      const inputState = {
        resultVar: 42,
        keyPress: true,
        mode: 2,
      };

      const suspendState = new SuspendState(inputState);

      // Make executeInstruction throw SuspendState
      vi.spyOn(executor, 'executeInstruction').mockImplementation(() => {
        throw suspendState;
      });

      // Mock setImmediate to execute the callback immediately
      vi.stubGlobal('setImmediate', (callback: () => void) => {
        callback();
      });

      // Execute the loop
      executor.executeLoop();

      // Verify key input was handled
      expect(mockZMachine.inputProcessor.startCharInput).toHaveBeenCalledWith(
        mockZMachine,
        expect.objectContaining({
          mode: InputMode.CHAR,
        })
      );
    });

    it('should handle timed input', () => {
      // Setup a suspension state with timed input
      const inputState = {
        keyPress: false,
        resultVar: 42,
        textBuffer: 0x1000,
        parseBuffer: 0x1100,
        time: 10,
        routine: 0x2000,
      };

      const suspendState = new SuspendState(inputState);

      // Make executeInstruction throw SuspendState
      vi.spyOn(executor, 'executeInstruction').mockImplementation(() => {
        throw suspendState;
      });

      // Mock setImmediate to execute the callback immediately
      vi.stubGlobal('setImmediate', (callback: () => void) => {
        callback();
      });

      // Execute the loop
      executor.executeLoop();

      // Check that we're setting up for timed input
      expect(mockZMachine.inputProcessor.startTextInput).toHaveBeenCalledWith(
        mockZMachine,
        expect.objectContaining({
          time: 10,
          mode: InputMode.TIMED_TEXT,
          routine: 0x2000,
        })
      );
    });

    describe('executeInstruction', () => {
      it('should execute Long form instructions', () => {
        // Setup the state to read a long form instruction
        mockZMachine.state.readByte.mockReturnValueOnce(0x15); // Long form opcode

        // Setup operand reads
        mockZMachine.state.readByte.mockReturnValueOnce(5); // First operand
        mockZMachine.state.readByte.mockReturnValueOnce(3); // Second operand

        // Setup a mock opcode implementation
        const mockSubOpcode = {
          mnemonic: 'sub',
          impl: vi.fn(),
        };
        mockSubOpcode.impl.mockReturnValueOnce(42);

        // Set up the opcode table
        Object.defineProperty(executor, 'op2', {
          value: Array(32).fill(null),
        });
        executor.op2[0x15 & 0x1f] = mockSubOpcode;

        // Execute the instruction
        executor.executeInstruction();

        // Verify correct execution - focus on operands reaching the opcode
        expect(mockZMachine.state.readByte).toHaveBeenCalledTimes(3);
        expect(mockSubOpcode.impl).toHaveBeenCalledWith(
          mockZMachine,
          expect.any(Array), // operandTypes array - don't care about exact content
          5,
          3
        );
        expect(mockZMachine.logger.debug).toHaveBeenCalledWith(expect.stringContaining('Executing op = sub'));
      });

      it('should execute Short form instructions', () => {
        // Setup the state to read a short form instruction
        mockZMachine.state.readByte.mockReturnValueOnce(0x90); // Short form opcode

        // Setup operand read
        mockZMachine.state.readByte.mockReturnValueOnce(42); // Single operand

        // Setup a mock opcode implementation
        const mockJzOpcode = {
          mnemonic: 'jz',
          impl: vi.fn(),
        };

        // Set up the opcode table
        Object.defineProperty(executor, 'op1', {
          value: Array(16).fill(null),
        });
        executor.op1[0] = mockJzOpcode;

        // Execute the instruction
        executor.executeInstruction();

        // Verify correct execution - focus on operands reaching the opcode
        expect(mockZMachine.state.readByte).toHaveBeenCalledTimes(2);
        expect(mockJzOpcode.impl).toHaveBeenCalledWith(
          mockZMachine,
          expect.any(Array), // operandTypes array - don't care about exact content
          42
        );
        expect(mockZMachine.logger.debug).toHaveBeenCalledWith(expect.stringContaining('Executing op = jz'));
      });

      it('should execute Variable form instructions', () => {
        // Setup the state to read a variable form instruction
        mockZMachine.state.readByte.mockReturnValueOnce(0xe0); // Variable form opcode

        // Setup operand type byte
        mockZMachine.state.readByte.mockReturnValueOnce(0x00); // No operands in type byte

        // Setup operand reads from variables
        mockZMachine.state.readWord
          .mockReturnValueOnce(0x1234)
          .mockReturnValueOnce(0x5678)
          .mockReturnValueOnce(0x0000)
          .mockReturnValueOnce(0x0000);

        // Setup a mock opcode implementation
        const mockCallVsOpcode = {
          mnemonic: 'call_vs',
          impl: vi.fn(),
        };

        // Set up the opcode table
        Object.defineProperty(executor, 'opV', {
          value: Array(32).fill(null),
        });
        executor.opV[0] = mockCallVsOpcode;

        // Execute the instruction
        executor.executeInstruction();

        // Verify correct execution - focus on operands reaching the opcode
        expect(mockZMachine.state.readByte).toHaveBeenCalledTimes(2);
        expect(mockZMachine.state.readWord).toHaveBeenCalledTimes(4);
        expect(mockCallVsOpcode.impl).toHaveBeenCalledWith(
          mockZMachine,
          expect.any(Array), // operandTypes array - don't care about exact content
          0x1234,
          0x5678,
          0x0000,
          0x0000
        );
        expect(mockZMachine.logger.debug).toHaveBeenCalledWith(expect.stringContaining('Executing op = call_vs'));
      });

      it('should execute Extended form instructions (V5+)', () => {
        // Set version to 5 for extended instructions
        mockZMachine.state.version = 5;

        // Setup the state to read an extended form instruction
        mockZMachine.state.readByte.mockReturnValueOnce(0xbe); // Extended opcode prefix

        // Setup extended opcode number
        mockZMachine.state.readByte.mockReturnValueOnce(0x04); // Extended opcode number

        // Setup operand type byte
        mockZMachine.state.readByte.mockReturnValueOnce(0x10); // Operand types

        // Setup operand read
        mockZMachine.state.readByte.mockReturnValueOnce(3); // Single operand

        // Setup a mock opcode implementation
        const mockSetFontOpcode = {
          mnemonic: 'set_font',
          impl: vi.fn(),
        };

        // Set up the opcode table
        Object.defineProperty(executor, 'opExt', {
          value: Array(32).fill(null),
        });
        executor.opExt[4] = mockSetFontOpcode;

        // Execute the instruction
        executor.executeInstruction();

        // Verify correct execution - focus on operands reaching the opcode
        expect(mockZMachine.state.readByte).toHaveBeenCalledTimes(4);
        expect(mockSetFontOpcode.impl).toHaveBeenCalledWith(
          mockZMachine,
          expect.any(Array), // operandTypes array - don't care about exact content
          0,
          3,
          0,
          0
        );
        expect(mockZMachine.logger.debug).toHaveBeenCalledWith(expect.stringContaining('Executing op = set_font'));
      });

      it('should handle async opcode implementations', async () => {
        // Mock opcode that returns a Promise
        const asyncOpcode = {
          mnemonic: 'async_test',
          impl: vi.fn().mockImplementation(() => Promise.resolve()),
        };

        // Setup the state to read a long form instruction
        mockZMachine.state.readByte.mockReturnValueOnce(0x15); // Long form opcode

        // Setup operand reads
        mockZMachine.state.readByte.mockReturnValueOnce(5);
        mockZMachine.state.readByte.mockReturnValueOnce(3);

        // Setup the opcode in the appropriate table
        Object.defineProperty(executor, 'op2', {
          value: Array(32).fill(null),
        });
        executor.op2[0x15 & 0x1f] = asyncOpcode;

        // Execute and await the async operation
        await executor.executeInstruction();

        // Verify the async implementation was called with correct operands
        expect(asyncOpcode.impl).toHaveBeenCalledWith(
          mockZMachine,
          expect.any(Array), // operandTypes array - don't care about exact content
          5,
          3
        );
      });

      it('should handle missing opcode implementations', async () => {
        mockZMachine.state.readByte.mockReturnValueOnce(0x90);
        mockZMachine.state.readByte.mockReturnValueOnce(42);

        Object.defineProperty(executor, 'op1', {
          value: Array(16).fill(null),
        });

        await expect(executor.executeInstruction()).rejects.toThrowError(/No implementation found for opcode/);
        expect(mockZMachine.logger.error).toHaveBeenCalled();
      });

      it('should handle version-specific opcodes for V3', () => {
        // Set version to 3
        mockZMachine.state.version = 3;

        // Create mock implementations for different versions
        const v3Impl = vi.fn();
        const v5Impl = vi.fn();

        // Setup a version-specific opcode with updated signature
        const versionSpecificOpcode = {
          mnemonic: 'version_specific',
          impl: (machine: ZMachine, operandTypes: OperandType[], ...args: number[]): void => {
            if (machine.state.version <= 4) {
              v3Impl(machine, operandTypes, ...args);
            } else {
              v5Impl(machine, operandTypes, ...args);
            }
          },
        };

        // Setup the state to read a short form instruction
        mockZMachine.state.readByte.mockReturnValueOnce(0x98); // Short form opcode
        mockZMachine.state.readByte.mockReturnValueOnce(42); // Single operand

        // Set up the opcode table
        Object.defineProperty(executor, 'op1', {
          value: Array(16).fill(null),
        });
        executor.op1[8] = versionSpecificOpcode;

        // Execute the instruction
        executor.executeInstruction();

        // Verify correct version-specific execution - focus on operands
        expect(v3Impl).toHaveBeenCalledWith(
          mockZMachine,
          expect.any(Array), // operandTypes array - don't care about exact content
          42
        );
        expect(v5Impl).not.toHaveBeenCalled();
      });

      it('should handle version-specific opcodes for V5', () => {
        // Set version to 5
        mockZMachine.state.version = 5;

        // Create mock implementations for different versions
        const v3Impl = vi.fn();
        const v5Impl = vi.fn();

        // Setup a version-specific opcode with updated signature
        const versionSpecificOpcode = {
          mnemonic: 'version_specific',
          impl: (machine: ZMachine, operandTypes: OperandType[], ...args: number[]): void => {
            if (machine.state.version <= 4) {
              v3Impl(machine, operandTypes, ...args);
            } else {
              v5Impl(machine, operandTypes, ...args);
            }
          },
        };

        // Setup the state to read a short form instruction
        mockZMachine.state.readByte.mockReturnValueOnce(0x98); // Short form opcode
        mockZMachine.state.readByte.mockReturnValueOnce(42); // Single operand

        // Set up the opcode table
        Object.defineProperty(executor, 'op1', {
          value: Array(16).fill(null),
        });
        executor.op1[8] = versionSpecificOpcode;

        // Execute the instruction
        executor.executeInstruction();

        // Verify correct version-specific execution - focus on operands
        expect(v3Impl).not.toHaveBeenCalled();
        expect(v5Impl).toHaveBeenCalledWith(
          mockZMachine,
          expect.any(Array), // operandTypes array - don't care about exact content
          42
        );
      });
    });

    describe('properties and getters', () => {
      it('should return the op_pc value', () => {
        // Set a value on the private _op_pc property
        Object.defineProperty(executor, '_op_pc', { value: 0x4321 });

        // Get the value through the getter
        expect(executor.op_pc).toBe(0x4321);
      });

      it('should return the suspendedInputState when suspended', () => {
        // Setup a suspended state
        const inputState = { keyPress: false, resultVar: 42 };
        Object.defineProperty(executor, '_suspended', { value: true });
        Object.defineProperty(executor, '_suspendedInputState', { value: inputState });

        // Get the suspended state
        expect(executor.suspendedInputState).toBe(inputState);
      });

      it('should return null for suspendedInputState when not suspended', () => {
        // Setup a non-suspended state
        const inputState = { keyPress: false, resultVar: 42 };
        Object.defineProperty(executor, '_suspended', { value: false });
        Object.defineProperty(executor, '_suspendedInputState', { value: inputState });

        // Get the suspended state should be null
        expect(executor.suspendedInputState).toBeNull();
      });

      it('should return the isSuspended value', () => {
        // Set the suspension state
        Object.defineProperty(executor, '_suspended', { value: true });

        // Get the suspension state
        expect(executor.isSuspended).toBe(true);
      });
    });

    describe('resume', () => {
      it('should clear suspension state and continue execution', () => {
        // Setup a suspended state
        Object.defineProperty(executor, '_suspended', { value: true, writable: true });
        Object.defineProperty(executor, '_suspendedInputState', {
          value: { keyPress: false, resultVar: 42 },
          writable: true,
        });

        // Spy on executeLoop to verify it's called
        const executeLoopSpy = vi.spyOn(executor, 'executeLoop').mockImplementation(async () => {});

        // Resume execution
        executor.resume();

        // Verify state was cleared and execution continued
        expect(executor['_suspended']).toBe(false);
        expect(executor['_suspendedInputState']).toBeNull();
        expect(executeLoopSpy).toHaveBeenCalled();
      });
    });

    describe('quit', () => {
      it('should set the quit flag', () => {
        // Setup the quit flag
        Object.defineProperty(executor, '_quit', { value: false, writable: true });

        // Call quit
        executor.quit();

        // Verify the flag was set
        expect(executor['_quit']).toBe(true);
      });
    });

    describe('instruction decoding', () => {
      it('should decode operand types correctly', () => {
        // We need to access the private method, so define a test opcode to use it
        const operandTypeTestOpcode = {
          mnemonic: 'test_operand_types',
          impl: vi.fn(),
        };

        // Setup a variable instruction with complex operand types
        mockZMachine.state.readByte.mockReturnValueOnce(0xe0); // Variable form opcode
        mockZMachine.state.readByte.mockReturnValueOnce(0x53); // Operand types - 01 01 00 11 (small, small, large, omitted)

        // Mock operand reads
        mockZMachine.state.readByte.mockReturnValueOnce(5); // First small operand
        mockZMachine.state.readByte.mockReturnValueOnce(3); // Second small operand
        mockZMachine.state.readWord.mockReturnValueOnce(0x1234); // Large operand

        // Set up the opcode in the table
        Object.defineProperty(executor, 'opV', {
          value: Array(32).fill(null),
        });
        executor.opV[0] = operandTypeTestOpcode;

        // Execute the instruction
        executor.executeInstruction();

        // Verify the correct operands were read and passed - focus on operand values
        expect(operandTypeTestOpcode.impl).toHaveBeenCalledWith(
          mockZMachine,
          expect.any(Array), // operandTypes array - don't care about exact content
          5,
          3,
          0x1234
        );
      });
    });

    describe('error handling', () => {
      it('should handle and log errors during opcode execution', async () => {
        const errorOpcode = {
          mnemonic: 'error_opcode',
          impl: vi.fn().mockImplementation(() => {
            throw new Error('Opcode execution error');
          }),
        };

        mockZMachine.state.readByte.mockReturnValueOnce(0x90);
        mockZMachine.state.readByte.mockReturnValueOnce(42);

        Object.defineProperty(executor, 'op1', {
          value: Array(16).fill(null),
        });
        executor.op1[0] = errorOpcode;

        // Use the async/await pattern with .rejects
        await expect(executor.executeInstruction()).rejects.toThrow('Opcode execution error');

        // Error should be logged
        expect(mockZMachine.logger.error).toHaveBeenCalled();
      });
    });

    describe('state transitions', () => {
      it('should not modify PC during normal execution', () => {
        // Store the initial PC
        const initialPC = mockZMachine.state.pc;

        // Setup a simple instruction that doesn't modify PC
        mockZMachine.state.readByte.mockReturnValueOnce(0x90); // Short form opcode
        mockZMachine.state.readByte.mockReturnValueOnce(42); // Single operand

        // Setup a mock opcode that doesn't modify state
        const noopOpcode = {
          mnemonic: 'test_noop',
          impl: vi.fn(),
        };

        // Set up the opcode table
        Object.defineProperty(executor, 'op1', {
          value: Array(16).fill(null),
        });
        executor.op1[0] = noopOpcode;

        // Execute the instruction
        executor.executeInstruction();

        // PC should remain unchanged by the executor itself
        // (would be modified by the ZMachine state in real execution)
        expect(mockZMachine.state.pc).toBe(initialPC);
      });
    });
  });
});
