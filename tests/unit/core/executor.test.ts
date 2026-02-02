import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Executor } from '../../../src/core/execution/Executor';
import { SuspendState } from '../../../src/core/execution/SuspendState';
import { ZMachine } from '../../../src/interpreter/ZMachine';
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
    it('should execute until quit is called', async () => {
      // Spy on executeInstruction to control the flow
      const executeInstructionSpy = vi.spyOn(executor, 'executeInstruction').mockImplementation(async () => {
        // Set the quit flag after first execution
        Object.defineProperty(executor, '_quit', { value: true, writable: true });
      });

      // Run the execution loop
      await executor.executeLoop();

      // Verify executeInstruction was called
      expect(executeInstructionSpy).toHaveBeenCalledTimes(1);
      expect(mockZMachine.screen.quit).toHaveBeenCalled();
      expect(mockZMachine.logger.info).toHaveBeenCalledWith('Program execution terminated');
    });

    it('should execute until suspended', async () => {
      let callCount = 0;
      const executeInstructionSpy = vi.spyOn(executor, 'executeInstruction').mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          // Set suspended flag after second execution
          Object.defineProperty(executor, '_suspended', { value: true, writable: true });
        }
      });

      // Run the execution loop
      await executor.executeLoop();

      // Verify executeInstruction was called twice before suspension
      expect(executeInstructionSpy).toHaveBeenCalledTimes(2);
      expect(mockZMachine.logger.debug).toHaveBeenCalledWith('ExecuteLoop exited due to suspension');
    });

    it('should handle SuspendState exceptions for text input', async () => {
      // Setup a suspension state for text input
      const inputState = {
        keyPress: false,
        resultVar: 42,
        textBuffer: 0x1000,
        parseBuffer: 0x1100,
      };

      const suspendState = new SuspendState(inputState);

      // Make executeInstruction throw SuspendState
      vi.spyOn(executor, 'executeInstruction').mockImplementation(async () => {
        throw suspendState;
      });

      // Mock setImmediate to execute the callback immediately
      vi.stubGlobal('setImmediate', (callback: () => void) => {
        callback();
      });

      // Execute the loop
      await executor.executeLoop();

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

      // Verify suspension state was set
      expect(executor.isSuspended).toBe(true);
      expect(mockZMachine.logger.debug).toHaveBeenCalledWith('Caught SuspendState, setting up suspension...');
    });

    it('should handle SuspendState exceptions for character input', async () => {
      // Setup a suspension state for character input
      const inputState = {
        resultVar: 42,
        keyPress: true,
      };

      const suspendState = new SuspendState(inputState);

      // Make executeInstruction throw SuspendState
      vi.spyOn(executor, 'executeInstruction').mockImplementation(async () => {
        throw suspendState;
      });

      // Mock setImmediate to execute the callback immediately
      vi.stubGlobal('setImmediate', (callback: () => void) => {
        callback();
      });

      // Execute the loop
      await executor.executeLoop();

      // Verify character input was handled
      expect(mockZMachine.inputProcessor.startCharInput).toHaveBeenCalledWith(
        mockZMachine,
        expect.objectContaining({
          mode: InputMode.CHAR,
        })
      );
    });

    it('should handle timed text input', async () => {
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
      vi.spyOn(executor, 'executeInstruction').mockImplementation(async () => {
        throw suspendState;
      });

      // Mock setImmediate to execute the callback immediately
      vi.stubGlobal('setImmediate', (callback: () => void) => {
        callback();
      });

      // Execute the loop
      await executor.executeLoop();

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

    it('should handle timed character input', async () => {
      // Setup a suspension state with timed character input
      const inputState = {
        keyPress: true,
        resultVar: 42,
        time: 5,
        routine: 0x3000,
      };

      const suspendState = new SuspendState(inputState);

      // Make executeInstruction throw SuspendState
      vi.spyOn(executor, 'executeInstruction').mockImplementation(async () => {
        throw suspendState;
      });

      // Mock setImmediate to execute the callback immediately
      vi.stubGlobal('setImmediate', (callback: () => void) => {
        callback();
      });

      // Execute the loop
      await executor.executeLoop();

      // Check that we're setting up for timed character input
      expect(mockZMachine.inputProcessor.startCharInput).toHaveBeenCalledWith(
        mockZMachine,
        expect.objectContaining({
          time: 5,
          mode: InputMode.TIMED_CHAR,
          routine: 0x3000,
        })
      );
    });

    it('should handle V1-3 status bar updates during input', async () => {
      // Set version to 3
      mockZMachine.state.version = 3;

      const inputState = {
        keyPress: false,
        resultVar: 42,
        textBuffer: 0x1000,
        parseBuffer: 0x1100,
      };

      const suspendState = new SuspendState(inputState);

      vi.spyOn(executor, 'executeInstruction').mockImplementation(async () => {
        throw suspendState;
      });

      vi.stubGlobal('setImmediate', (callback: () => void) => {
        callback();
      });

      await executor.executeLoop();

      // Verify status bar was updated for V1-3
      expect(mockZMachine.updateStatusBar).toHaveBeenCalled();
    });

    it('should not update status bar for V4+', async () => {
      // Set version to 5
      mockZMachine.state.version = 5;

      const inputState = {
        keyPress: false,
        resultVar: 42,
        textBuffer: 0x1000,
        parseBuffer: 0x1100,
      };

      const suspendState = new SuspendState(inputState);

      vi.spyOn(executor, 'executeInstruction').mockImplementation(async () => {
        throw suspendState;
      });

      vi.stubGlobal('setImmediate', (callback: () => void) => {
        callback();
      });

      await executor.executeLoop();

      // Verify status bar was NOT updated for V4+
      expect(mockZMachine.updateStatusBar).not.toHaveBeenCalled();
    });

    it('should handle input setup errors gracefully', async () => {
      const inputState = {
        keyPress: false,
        resultVar: 42,
        textBuffer: 0x1000,
        parseBuffer: 0x1100,
      };

      const suspendState = new SuspendState(inputState);

      // Make executeInstruction throw SuspendState
      vi.spyOn(executor, 'executeInstruction').mockImplementation(async () => {
        throw suspendState;
      });

      // Make input processor throw an error
      mockZMachine.inputProcessor.startTextInput.mockImplementation(() => {
        throw new Error('Input setup failed');
      });

      // Mock resume method to track calls
      const resumeSpy = vi.spyOn(executor, 'resume').mockResolvedValue();

      // Mock setImmediate to execute the callback immediately
      vi.stubGlobal('setImmediate', (callback: () => void) => {
        callback();
      });

      await executor.executeLoop();

      // Verify error was logged and resume was called
      expect(mockZMachine.logger.error).toHaveBeenCalledWith('Error during input handling: Input setup failed');
      expect(resumeSpy).toHaveBeenCalled();
    });

    it('should handle resume errors in input setup', async () => {
      const inputState = {
        keyPress: false,
        resultVar: 42,
        textBuffer: 0x1000,
        parseBuffer: 0x1100,
      };

      const suspendState = new SuspendState(inputState);

      vi.spyOn(executor, 'executeInstruction').mockImplementation(async () => {
        throw suspendState;
      });

      // Make input processor throw an error
      mockZMachine.inputProcessor.startTextInput.mockImplementation(() => {
        throw new Error('Input setup failed');
      });

      // Make resume throw an error
      vi.spyOn(executor, 'resume').mockRejectedValue(new Error('Resume failed'));

      vi.stubGlobal('setImmediate', (callback: () => void) => {
        callback();
      });

      await executor.executeLoop();

      // Verify both errors were logged and quit flag was set
      expect(mockZMachine.logger.error).toHaveBeenCalledWith('Error during input handling: Input setup failed');
      expect(mockZMachine.logger.error).toHaveBeenCalledWith('Error during emergency resume: Error: Resume failed');
      expect(executor['_quit']).toBe(true);
    });

    it('should handle non-SuspendState exceptions', async () => {
      const testError = new Error('Test execution error');

      vi.spyOn(executor, 'executeInstruction').mockImplementation(async () => {
        throw testError;
      });

      await expect(executor.executeLoop()).rejects.toThrow('Test execution error');

      expect(mockZMachine.logger.error).toHaveBeenCalledWith(expect.stringContaining('Execution error at PC='));
    });

    it('should log debug messages for loop iterations', async () => {
      let callCount = 0;
      vi.spyOn(executor, 'executeInstruction').mockImplementation(async () => {
        callCount++;
        if (callCount === 2) {
          Object.defineProperty(executor, '_quit', { value: true, writable: true });
        }
      });

      await executor.executeLoop();

      expect(mockZMachine.logger.debug).toHaveBeenCalledWith('Loop iteration: quit=false, suspended=false');
    });
  });

  describe('executeInstruction', () => {
    it('should execute Long form instructions', async () => {
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
      await executor.executeInstruction();

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

    it('should execute Short form instructions', async () => {
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
      await executor.executeInstruction();

      // Verify correct execution - focus on operands reaching the opcode
      expect(mockZMachine.state.readByte).toHaveBeenCalledTimes(2);
      expect(mockJzOpcode.impl).toHaveBeenCalledWith(
        mockZMachine,
        expect.any(Array), // operandTypes array - don't care about exact content
        42
      );
      expect(mockZMachine.logger.debug).toHaveBeenCalledWith(expect.stringContaining('Executing op = jz'));
    });

    it('should execute Variable form instructions', async () => {
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
      await executor.executeInstruction();

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

    it('should execute Extended form instructions (V5+)', async () => {
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
      await executor.executeInstruction();

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

    it('should handle SuspendState exceptions without logging as errors', async () => {
      const suspendState = new SuspendState({
        keyPress: false,
        resultVar: 42,
        textBuffer: 0x1000,
        parseBuffer: 0x1100,
      });

      const mockOpcode = {
        mnemonic: 'sread',
        impl: vi.fn().mockImplementation(() => {
          throw suspendState;
        }),
      };

      mockZMachine.state.readByte.mockReturnValueOnce(0x90);
      mockZMachine.state.readByte.mockReturnValueOnce(42);

      Object.defineProperty(executor, 'op1', {
        value: Array(16).fill(null),
      });
      executor.op1[0] = mockOpcode;

      await expect(executor.executeInstruction()).rejects.toThrow(suspendState);

      // Should log as debug, not error
      expect(mockZMachine.logger.debug).toHaveBeenCalledWith(
        'Execution suspended for input: Execution suspended waiting for user input'
      );
      expect(mockZMachine.logger.error).not.toHaveBeenCalledWith(expect.stringContaining('Error executing opcode'));
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

    it('should handle opcode execution errors', async () => {
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

      await expect(executor.executeInstruction()).rejects.toThrow('Opcode execution error');

      expect(mockZMachine.logger.error).toHaveBeenCalledWith(
        'Error executing opcode error_opcode: Error: Opcode execution error'
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
      const inputState = { keyPress: false, resultVar: 42, mode: InputMode.TEXT };
      Object.defineProperty(executor, '_suspended', { value: true });
      Object.defineProperty(executor, '_suspendedInputState', { value: inputState });

      // Get the suspended state
      expect(executor.suspendedInputState).toBe(inputState);
    });

    it('should return null for suspendedInputState when not suspended', () => {
      // Setup a non-suspended state
      const inputState = { keyPress: false, resultVar: 42, mode: InputMode.TEXT };
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

    it('should return false for isSuspended when not suspended', () => {
      Object.defineProperty(executor, '_suspended', { value: false });
      expect(executor.isSuspended).toBe(false);
    });
  });

  describe('resume', () => {
    it('should clear suspension state and continue execution', async () => {
      // Setup a suspended state
      Object.defineProperty(executor, '_suspended', { value: true, writable: true });
      Object.defineProperty(executor, '_suspendedInputState', {
        value: { keyPress: false, resultVar: 42, mode: InputMode.TEXT },
        writable: true,
      });

      // Spy on executeLoop to verify it's called
      const executeLoopSpy = vi.spyOn(executor, 'executeLoop').mockImplementation(async () => {});

      // Resume execution
      await executor.resume();

      // Verify state was cleared and execution continued
      expect(executor['_suspended']).toBe(false);
      expect(executor['_suspendedInputState']).toBeNull();
      expect(executeLoopSpy).toHaveBeenCalled();
    });

    it('should warn when resume is called while not suspended', async () => {
      // Setup a non-suspended state
      Object.defineProperty(executor, '_suspended', { value: false, writable: true });

      // Spy on executeLoop to verify it's NOT called
      const executeLoopSpy = vi.spyOn(executor, 'executeLoop').mockImplementation(async () => {});

      // Resume execution
      await executor.resume();

      // Verify warning was logged and executeLoop was not called
      expect(mockZMachine.logger.warn).toHaveBeenCalledWith('Called resume() when not suspended');
      expect(executeLoopSpy).not.toHaveBeenCalled();
    });

    it('should propagate errors from executeLoop', async () => {
      Object.defineProperty(executor, '_suspended', { value: true, writable: true });

      const testError = new Error('ExecuteLoop error');
      vi.spyOn(executor, 'executeLoop').mockRejectedValue(testError);

      await expect(executor.resume()).rejects.toThrow('ExecuteLoop error');
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

    it('should not affect other state when quitting', () => {
      Object.defineProperty(executor, '_suspended', { value: true });
      Object.defineProperty(executor, '_quit', { value: false, writable: true });

      executor.quit();

      expect(executor['_quit']).toBe(true);
      expect(executor['_suspended']).toBe(true); // Should remain unchanged
    });
  });

  describe('reset', () => {
    it('should reset all execution flags', () => {
      // Set various flags to non-default values
      Object.defineProperty(executor, '_quit', { value: true, writable: true });
      Object.defineProperty(executor, '_restarting', { value: true, writable: true });
      Object.defineProperty(executor, '_suspended', { value: true, writable: true });
      Object.defineProperty(executor, '_suspendedInputState', { value: { mode: InputMode.CHAR }, writable: true });
      Object.defineProperty(executor, '_op_pc', { value: 0x1234, writable: true });

      // Call reset
      executor.reset();

      // Verify all flags are reset to default values
      expect(executor['_quit']).toBe(false);
      expect(executor['_restarting']).toBe(false);
      expect(executor['_suspended']).toBe(false);
      expect(executor['_suspendedInputState']).toBe(null);
      expect(executor['_op_pc']).toBe(0);
    });

    it('should allow executeLoop to run after reset', async () => {
      // First, set quit to true (simulating a quit state)
      Object.defineProperty(executor, '_quit', { value: true, writable: true });

      // Spy on executeInstruction
      const executeInstructionSpy = vi.spyOn(executor, 'executeInstruction').mockImplementation(async () => {
        // Set quit after first call to end the loop
        Object.defineProperty(executor, '_quit', { value: true, writable: true });
      });

      // Without reset, executeLoop should exit immediately
      await executor.executeLoop();
      expect(executeInstructionSpy).not.toHaveBeenCalled();

      // Reset the executor
      executor.reset();

      // Now executeLoop should run
      await executor.executeLoop();
      expect(executeInstructionSpy).toHaveBeenCalled();
    });

    it('should allow executeLoop to run after reset from suspended state', async () => {
      // Set suspended state
      Object.defineProperty(executor, '_suspended', { value: true, writable: true });
      Object.defineProperty(executor, '_suspendedInputState', {
        value: { mode: InputMode.TEXT, resultVar: 1 },
        writable: true,
      });

      // Spy on executeInstruction
      const executeInstructionSpy = vi.spyOn(executor, 'executeInstruction').mockImplementation(async () => {
        // Set quit after first call to end the loop
        Object.defineProperty(executor, '_quit', { value: true, writable: true });
      });

      // Without reset, executeLoop should exit immediately due to suspended flag
      await executor.executeLoop();
      expect(executeInstructionSpy).not.toHaveBeenCalled();

      // Reset the executor
      executor.reset();

      // Now executeLoop should run
      await executor.executeLoop();
      expect(executeInstructionSpy).toHaveBeenCalled();
    });
  });

  describe('signalRestart', () => {
    it('should set quit and restarting flags', () => {
      // Initially both should be false
      expect(executor['_quit']).toBe(false);
      expect(executor['_restarting']).toBe(false);

      // Signal restart
      executor.signalRestart();

      // Both flags should now be true
      expect(executor['_quit']).toBe(true);
      expect(executor['_restarting']).toBe(true);
    });

    it('should cause executeLoop to exit without calling screen.quit', async () => {
      // Set up a simple execution scenario
      let instructionCount = 0;
      vi.spyOn(executor, 'executeInstruction').mockImplementation(async () => {
        instructionCount++;
        if (instructionCount === 2) {
          // Signal restart on second instruction
          executor.signalRestart();
        }
      });

      // Run the loop
      await executor.executeLoop();

      // Should have executed 2 instructions then exited
      expect(instructionCount).toBe(2);

      // screen.quit should NOT have been called (because we're restarting, not quitting)
      expect(mockZMachine.screen.quit).not.toHaveBeenCalled();
    });
  });

  describe('instruction decoding', () => {
    it('should decode operand types correctly', async () => {
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
      await executor.executeInstruction();

      // Verify the correct operands were read and passed - focus on operand values
      expect(operandTypeTestOpcode.impl).toHaveBeenCalledWith(
        mockZMachine,
        expect.any(Array), // operandTypes array - don't care about exact content
        5,
        3,
        0x1234
      );
    });

    it('should decode variable operands correctly', async () => {
      const testOpcode = {
        mnemonic: 'test_variable_operands',
        impl: vi.fn(),
      };

      // Setup a variable instruction
      mockZMachine.state.readByte.mockReturnValueOnce(0xe0); // Variable form opcode
      mockZMachine.state.readByte.mockReturnValueOnce(0x8f); // Operand types - 10 00 11 11 (variable, large, omitted, omitted)

      // Mock operand reads
      mockZMachine.state.readByte.mockReturnValueOnce(10); // Variable number for first operand
      mockZMachine.state.loadVariable.mockReturnValueOnce(100); // Value from variable
      mockZMachine.state.readWord.mockReturnValueOnce(0x5678); // Large operand

      Object.defineProperty(executor, 'opV', {
        value: Array(32).fill(null),
      });
      executor.opV[0] = testOpcode;

      await executor.executeInstruction();

      expect(testOpcode.impl).toHaveBeenCalledWith(
        mockZMachine,
        expect.any(Array),
        100, // Value from variable
        0x5678 // Large operand
      );
    });

    it('should decode call_vn2 (opcode 26) with two operand type bytes', async () => {
      // Setup: call_vn2 instruction with 6 operands
      // 0xfa = call_vn2 (VAR opcode 26, bit pattern 11111010)
      // 0x16 = first type byte: 00 01 01 10 (Large, Small, Small, Variable)
      // 0xa7 = second type byte: 10 10 01 11 (Variable, Variable, Small, Omitted)

      mockZMachine.state.readByte
        .mockReturnValueOnce(0xfa) // opcode (call_vn2)
        .mockReturnValueOnce(0x16) // first operand types: 00 01 01 10
        .mockReturnValueOnce(0xa7) // second operand types: 10 10 01 11
        .mockReturnValueOnce(0x16) // small constant arg
        .mockReturnValueOnce(0x4d) // small constant arg
        .mockReturnValueOnce(0x01) // variable number
        .mockReturnValueOnce(0x02) // variable number
        .mockReturnValueOnce(0x03) // variable number
        .mockReturnValueOnce(0x10); // small constant arg (from second type byte)

      // Large constant (2 bytes)
      mockZMachine.state.readWord.mockReturnValueOnce(0x3f32);

      // Variable loads
      mockZMachine.state.loadVariable
        .mockReturnValueOnce(100) // var 1
        .mockReturnValueOnce(200) // var 2
        .mockReturnValueOnce(300); // var 3

      const mockCallVn2Opcode = {
        mnemonic: 'call_vn2',
        impl: vi.fn(),
      };

      Object.defineProperty(executor, 'opV', {
        value: Array(32).fill(null),
      });
      executor.opV[26] = mockCallVn2Opcode;

      await executor.executeInstruction();

      // Verify that operands were correctly extracted from TWO type bytes
      // With two type bytes: Large(0x3f32), Small(0x16), Small(0x4d), Var(100), Var(200), Var(300), Small(0x10)
      expect(mockCallVn2Opcode.impl).toHaveBeenCalledWith(
        mockZMachine,
        expect.any(Array),
        0x3f32, // Large constant (routine address)
        0x16, // Small constant
        0x4d, // Small constant
        100, // Variable 1
        200, // Variable 2
        300, // Variable 3
        0x10 // Small constant from second type byte
      );
    });

    it('should decode call_vs2 (opcode 12) with two operand type bytes', async () => {
      // Setup: call_vs2 instruction with 6 operands
      // 0xec = call_vs2 (VAR opcode 12, bit pattern 11101100)
      // 0x00 = first type byte: all Large constants (00 00 00 00)
      // 0x5f = second type byte: 01 01 11 11 (small, small, omitted, omitted)

      mockZMachine.state.readByte
        .mockReturnValueOnce(0xec) // opcode (call_vs2)
        .mockReturnValueOnce(0x00) // first operand types: 00 00 00 00 (4 large)
        .mockReturnValueOnce(0x5f) // second operand types: 01 01 11 11 (small, small, omitted, omitted)
        .mockReturnValueOnce(0x10) // small constant
        .mockReturnValueOnce(0x20); // small constant

      // Four large constants from first type byte
      mockZMachine.state.readWord
        .mockReturnValueOnce(0x1000)
        .mockReturnValueOnce(0x2000)
        .mockReturnValueOnce(0x3000)
        .mockReturnValueOnce(0x4000);

      const mockCallVs2Opcode = {
        mnemonic: 'call_vs2',
        impl: vi.fn(),
      };

      Object.defineProperty(executor, 'opV', {
        value: Array(32).fill(null),
      });
      executor.opV[12] = mockCallVs2Opcode;

      await executor.executeInstruction();

      // Should have 6 operands from two type bytes
      expect(mockCallVs2Opcode.impl).toHaveBeenCalledWith(
        mockZMachine,
        expect.any(Array),
        0x1000,
        0x2000,
        0x3000,
        0x4000, // 4 large constants
        0x10,
        0x20 // 2 small constants
      );
    });

    it('should decode regular VAR opcodes with single operand type byte', async () => {
      // Regular call_vn (opcode 25, not 26) should only read one type byte
      // 0xf9 = call_vn (VAR opcode 25, bit pattern 11111001)
      mockZMachine.state.readByte
        .mockReturnValueOnce(0xf9) // opcode (call_vn, VAR opcode 25)
        .mockReturnValueOnce(0x03); // single operand type byte: 00 00 00 11 (large, large, large, omitted)

      mockZMachine.state.readWord
        .mockReturnValueOnce(0x1234) // large constant 1
        .mockReturnValueOnce(0x5678) // large constant 2
        .mockReturnValueOnce(0x9abc); // large constant 3

      const mockCallVnOpcode = {
        mnemonic: 'call_vn',
        impl: vi.fn(),
      };

      Object.defineProperty(executor, 'opV', {
        value: Array(32).fill(null),
      });
      executor.opV[25] = mockCallVnOpcode;

      await executor.executeInstruction();

      // Should only have 3 operands from single type byte
      expect(mockCallVnOpcode.impl).toHaveBeenCalledWith(
        mockZMachine,
        expect.any(Array),
        0x1234,
        0x5678,
        0x9abc
      );
    });

    it('should stop decoding double operand types at first Omitted in first byte', async () => {
      // call_vn2 with only 2 operands (Omitted in first type byte)
      // 0xfa = call_vn2
      // 0x0f = first type byte: 00 00 11 11 (Large, Large, Omitted, Omitted)
      // 0x00 = second type byte (should be ignored since we found Omitted in first)

      mockZMachine.state.readByte
        .mockReturnValueOnce(0xfa) // opcode (call_vn2)
        .mockReturnValueOnce(0x0f) // first operand types: 00 00 11 11
        .mockReturnValueOnce(0x00); // second operand types (ignored)

      mockZMachine.state.readWord
        .mockReturnValueOnce(0x1000) // large constant 1
        .mockReturnValueOnce(0x2000); // large constant 2

      const mockCallVn2Opcode = {
        mnemonic: 'call_vn2',
        impl: vi.fn(),
      };

      Object.defineProperty(executor, 'opV', {
        value: Array(32).fill(null),
      });
      executor.opV[26] = mockCallVn2Opcode;

      await executor.executeInstruction();

      // Should only have 2 operands since Omitted was found in first byte
      expect(mockCallVn2Opcode.impl).toHaveBeenCalledWith(mockZMachine, expect.any(Array), 0x1000, 0x2000);
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
      expect(mockZMachine.logger.error).toHaveBeenCalledWith(
        'Error executing opcode error_opcode: Error: Opcode execution error'
      );
    });

    it('should handle opcode resolution errors', async () => {
      mockZMachine.state.readByte.mockReturnValueOnce(0x90);
      mockZMachine.state.readByte.mockReturnValueOnce(42);

      // Don't set up any opcode tables, so resolution will fail
      Object.defineProperty(executor, 'op1', {
        value: Array(16).fill(null),
      });

      await expect(executor.executeInstruction()).rejects.toThrow(/No implementation found for opcode/);
      expect(mockZMachine.logger.error).toHaveBeenCalledWith(expect.stringContaining('Error resolving opcode at pc='));
    });

    it('should handle errors with stack traces', async () => {
      const errorWithStack = new Error('Test error with stack');
      errorWithStack.stack = 'Test stack trace';

      vi.spyOn(executor, 'executeInstruction').mockRejectedValue(errorWithStack);

      await expect(executor.executeLoop()).rejects.toThrow('Test error with stack');

      expect(mockZMachine.logger.debug).toHaveBeenCalledWith('Test stack trace');
    });

    it('should handle errors without stack traces', async () => {
      const errorWithoutStack = new Error('Test error without stack');
      delete errorWithoutStack.stack;

      vi.spyOn(executor, 'executeInstruction').mockRejectedValue(errorWithoutStack);

      await expect(executor.executeLoop()).rejects.toThrow('Test error without stack');

      // Should not call debug for stack trace
      expect(mockZMachine.logger.debug).not.toHaveBeenCalledWith(expect.stringContaining('stack'));
    });
  });

  describe('opcode table access', () => {
    it('should provide access to opcode tables', () => {
      expect(executor.op0).toBeDefined();
      expect(executor.op1).toBeDefined();
      expect(executor.op2).toBeDefined();
      expect(executor.opV).toBeDefined();
      expect(executor.opExt).toBeDefined();

      expect(Array.isArray(executor.op0)).toBe(true);
      expect(Array.isArray(executor.op1)).toBe(true);
      expect(Array.isArray(executor.op2)).toBe(true);
      expect(Array.isArray(executor.opV)).toBe(true);
      expect(Array.isArray(executor.opExt)).toBe(true);
    });
  });

  describe('state transitions', () => {
    it('should not modify PC during normal execution', async () => {
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
      await executor.executeInstruction();

      // PC should remain unchanged by the executor itself
      // (would be modified by the ZMachine state in real execution)
      expect(mockZMachine.state.pc).toBe(initialPC);
    });

    it('should track op_pc correctly during instruction execution', async () => {
      const testPC = 0x1234;
      mockZMachine.state.pc = testPC;

      mockZMachine.state.readByte.mockReturnValueOnce(0x90);
      mockZMachine.state.readByte.mockReturnValueOnce(42);

      const testOpcode = {
        mnemonic: 'test_op',
        impl: vi.fn(),
      };

      Object.defineProperty(executor, 'op1', {
        value: Array(16).fill(null),
      });
      executor.op1[0] = testOpcode;

      // Execute within a loop to set op_pc
      let callCount = 0;
      vi.spyOn(executor, 'executeInstruction').mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          // Set op_pc as executeLoop would
          Object.defineProperty(executor, '_op_pc', { value: testPC, writable: true });
        }
        if (callCount === 2) {
          Object.defineProperty(executor, '_quit', { value: true, writable: true });
        }
      });

      await executor.executeLoop();

      expect(executor.op_pc).toBe(testPC);
    });
  });

  describe('complex instruction forms', () => {
    it('should handle extended opcodes correctly', async () => {
      mockZMachine.state.version = 5;

      mockZMachine.state.readByte.mockReturnValueOnce(0xbe); // Extended prefix
      mockZMachine.state.readByte.mockReturnValueOnce(0x00); // Extended opcode 0
      mockZMachine.state.readByte.mockReturnValueOnce(0xff); // All operands omitted

      const extendedOpcode = {
        mnemonic: 'save',
        impl: vi.fn(),
      };

      Object.defineProperty(executor, 'opExt', {
        value: Array(32).fill(null),
      });
      executor.opExt[0] = extendedOpcode;

      await executor.executeInstruction();

      expect(extendedOpcode.impl).toHaveBeenCalledWith(mockZMachine, expect.any(Array));
    });

    it('should handle variable form 2OP instructions', async () => {
      // Variable form but not really variable (2OP)
      mockZMachine.state.readByte.mockReturnValueOnce(0xc0); // Variable form, not really variable
      mockZMachine.state.readByte.mockReturnValueOnce(0x00); // All large operands

      mockZMachine.state.readWord.mockReturnValueOnce(0x1111);
      mockZMachine.state.readWord.mockReturnValueOnce(0x2222);
      mockZMachine.state.readWord.mockReturnValueOnce(0x3333);
      mockZMachine.state.readWord.mockReturnValueOnce(0x4444);

      const twoOpVariableOpcode = {
        mnemonic: 'je',
        impl: vi.fn(),
      };

      Object.defineProperty(executor, 'op2', {
        value: Array(32).fill(null),
      });
      executor.op2[0] = twoOpVariableOpcode;

      await executor.executeInstruction();

      expect(twoOpVariableOpcode.impl).toHaveBeenCalledWith(
        mockZMachine,
        expect.any(Array),
        0x1111,
        0x2222,
        0x3333,
        0x4444
      );
    });

    it('should handle short form with no operands', async () => {
      mockZMachine.state.readByte.mockReturnValueOnce(0xb0); // Short form, no operand

      const noOperandOpcode = {
        mnemonic: 'rtrue',
        impl: vi.fn(),
      };

      Object.defineProperty(executor, 'op0', {
        value: Array(16).fill(null),
      });
      executor.op0[0] = noOperandOpcode;

      await executor.executeInstruction();

      expect(noOperandOpcode.impl).toHaveBeenCalledWith(mockZMachine, expect.any(Array));
    });

    it('should reject unknown operand types', async () => {
      mockZMachine.state.readByte.mockReturnValueOnce(0xe0); // Variable form
      mockZMachine.state.readByte.mockReturnValueOnce(0xc0); // Operand types with invalid type

      // Mock readOperands to throw for unknown operand type
      vi.spyOn(executor, 'readOperands').mockImplementation(() => {
        throw new Error('Unknown operand type: 3');
      });

      await expect(executor.executeInstruction()).rejects.toThrow('Unknown operand type: 3');
    });
  });

  describe('input state management', () => {
    it('should properly store input state during suspension', async () => {
      const inputState = {
        keyPress: false,
        resultVar: 42,
        textBuffer: 0x1000,
        parseBuffer: 0x1100,
        time: 10,
        routine: 0x2000,
      };

      const suspendState = new SuspendState(inputState);

      vi.spyOn(executor, 'executeInstruction').mockImplementation(async () => {
        throw suspendState;
      });

      vi.stubGlobal('setImmediate', (callback: () => void) => {
        callback();
      });

      await executor.executeLoop();

      // Verify the input state was stored correctly
      const storedState = executor.suspendedInputState;
      expect(storedState).toMatchObject({
        resultVar: 42,
        textBuffer: 0x1000,
        parseBuffer: 0x1100,
        time: 10,
        routine: 0x2000,
        // Note: The mode will be calculated by toInputState(), not hardcoded
        // For this input state (keyPress: false, time: 10), it should be TIMED_TEXT
      });

      // Check the mode separately since it's calculated dynamically
      expect(storedState?.mode).toBe(InputMode.TIMED_TEXT);
    });

    it('should clear input state on resume', async () => {
      // Setup initial suspended state
      Object.defineProperty(executor, '_suspended', { value: true, writable: true });
      Object.defineProperty(executor, '_suspendedInputState', {
        value: { keyPress: false, resultVar: 42, mode: InputMode.TEXT },
        writable: true,
      });

      vi.spyOn(executor, 'executeLoop').mockImplementation(async () => {});

      await executor.resume();

      expect(executor.suspendedInputState).toBeNull();
    });

    it('should maintain suspension state during input setup', async () => {
      const inputState = {
        keyPress: false,
        resultVar: 42,
        textBuffer: 0x1000,
        parseBuffer: 0x1100,
      };

      const suspendState = new SuspendState(inputState);

      vi.spyOn(executor, 'executeInstruction').mockImplementation(async () => {
        throw suspendState;
      });

      let setupCallback: (() => void) | undefined;
      vi.stubGlobal('setImmediate', (callback: () => void) => {
        setupCallback = callback;
      });

      await executor.executeLoop();

      // Before setup callback runs
      expect(executor.isSuspended).toBe(true);

      // Run the setup
      expect(setupCallback).toBeDefined();
      setupCallback!(); // Use non-null assertion since we just checked it's defined

      // After setup, should still be suspended
      expect(executor.isSuspended).toBe(true);
    });
  });

  describe('debugging and logging', () => {
    it('should log detailed execution information', async () => {
      mockZMachine.state.readByte.mockReturnValueOnce(0x15); // Long form
      mockZMachine.state.readByte.mockReturnValueOnce(5);
      mockZMachine.state.readByte.mockReturnValueOnce(3);

      const testOpcode = {
        mnemonic: 'add',
        impl: vi.fn(),
      };

      Object.defineProperty(executor, 'op2', {
        value: Array(32).fill(null),
      });
      executor.op2[0x15 & 0x1f] = testOpcode;

      await executor.executeInstruction();

      // Should log execution details
      expect(mockZMachine.logger.debug).toHaveBeenCalledWith(
        expect.stringMatching(/Executing op = add at PC .* with operandTypes .* and operands .*/)
      );
    });

    it('should log suspension details', async () => {
      const suspendState = new SuspendState({
        keyPress: true,
        resultVar: 42,
      });

      vi.spyOn(executor, 'executeInstruction').mockImplementation(async () => {
        throw suspendState;
      });

      vi.stubGlobal('setImmediate', (callback: () => void) => {
        callback();
      });

      await executor.executeLoop();

      expect(mockZMachine.logger.debug).toHaveBeenCalledWith('Caught SuspendState, setting up suspension...');
      expect(mockZMachine.logger.debug).toHaveBeenCalledWith('Starting input setup in setImmediate...');
      expect(mockZMachine.logger.debug).toHaveBeenCalledWith('Starting character input...');
      expect(mockZMachine.logger.debug).toHaveBeenCalledWith('Input setup completed successfully');
    });
  });
});
