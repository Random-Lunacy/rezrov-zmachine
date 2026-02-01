import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Executor } from '../../../src/core/execution/Executor';
import { ZMachine } from '../../../src/interpreter/ZMachine';
import { BaseInputProcessor, InputMode, InputState } from '../../../src/ui/input/InputInterface';
import { HeaderLocation } from '../../../src/utils/constants';
import { MockZMachine, createMockZMachine } from '../../mocks';
import { MockExecutor } from '../../mocks/MockExecutor';

// Create a concrete implementation of BaseInputProcessor for testing
class TestInputProcessor extends BaseInputProcessor {
  // Implement abstract methods
  public doStartTextInput = vi.fn();
  public doStartCharInput = vi.fn();
  promptForFilename = vi.fn().mockResolvedValue('test.sav');

  // Expose protected methods for testing
  public exposedStoreTextInput(machine: MockZMachine, input: string, textBuffer: number): void {
    this.storeTextInput(machine as any, input, textBuffer);
  }

  public exposedValidateTextBuffer(machine: MockZMachine, textBuffer: number): boolean {
    return this.validateTextBuffer(machine as any, textBuffer);
  }

  public exposedValidateParseBuffer(machine: MockZMachine, parseBuffer: number): boolean {
    return this.validateParseBuffer(machine as any, parseBuffer);
  }

  public exposedProcessTextInput(machine: MockZMachine, input: string, termChar: number): void {
    this.processTextInput(machine as any, input, termChar);
  }

  public exposedProcessCharInput(machine: MockZMachine, key: string): void {
    this.processCharInput(machine as any, key);
  }

  public exposedLoadTerminatingCharacters(machine: MockZMachine): void {
    this.loadTerminatingCharacters(machine as any);
  }

  public exposedValidateInputCompatibility(machine: MockZMachine, state: InputState): boolean {
    return this.validateInputCompatibility(machine as any, state);
  }

  public exposedProcessUnicodeInput(input: string): string {
    return this.processUnicodeInput(input);
  }

  public exposedHandleV3InputSetup(machine: MockZMachine): void {
    this.handleV3InputSetup(machine as any);
  }

  // Allow direct access to terminatingChars for testing
  public getTerminatingChars(): number[] {
    return this.terminatingChars;
  }
}

describe('InputInterface', () => {
  let machine: MockZMachine;
  let inputProcessor: TestInputProcessor;

  beforeEach(() => {
    machine = createMockZMachine();
    inputProcessor = new TestInputProcessor();

    // Add mock executor
    machine.executor = new MockExecutor(machine as any as ZMachine) as Partial<Executor> as Executor;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('InputMode enum', () => {
    it('should define the correct input modes', () => {
      expect(InputMode.TEXT).toBe(1);
      expect(InputMode.CHAR).toBe(2);
      expect(InputMode.TIMED_TEXT).toBe(3);
      expect(InputMode.TIMED_CHAR).toBe(4);
      expect(InputMode.UNICODE_TEXT).toBe(5);
      expect(InputMode.UNICODE_CHAR).toBe(6);
    });
  });

  describe('InputState interface', () => {
    it('should support unicodeMode property for V5+', () => {
      const state: InputState = {
        mode: InputMode.UNICODE_TEXT,
        resultVar: 0,
        unicodeMode: true,
      };

      expect(state.unicodeMode).toBe(true);
    });

    it('should have all required properties', () => {
      const state: InputState = {
        mode: InputMode.TEXT,
        resultVar: 0,
        textBuffer: 0x1000,
        parseBuffer: 0x2000,
        time: 10,
        routine: 0x3000,
        currentInput: 'test',
        terminating: 13,
        unicodeMode: false,
      };

      expect(state.mode).toBe(InputMode.TEXT);
      expect(state.resultVar).toBe(0);
      expect(state.textBuffer).toBe(0x1000);
      expect(state.parseBuffer).toBe(0x2000);
      expect(state.time).toBe(10);
      expect(state.routine).toBe(0x3000);
      expect(state.currentInput).toBe('test');
      expect(state.terminating).toBe(13);
      expect(state.unicodeMode).toBe(false);
    });
  });

  describe('BaseInputProcessor', () => {
    describe('startTextInput', () => {
      it('should call doStartTextInput with valid buffers', () => {
        // Set up valid text and parse buffers
        machine.state.memory.getByte.mockImplementation((addr) => {
          if (addr === 0x1000) return 20; // Max length
          return 0;
        });

        const state: InputState = {
          mode: InputMode.TEXT,
          resultVar: 0,
          textBuffer: 0x1000,
          parseBuffer: 0x2000,
        };

        inputProcessor.startTextInput(machine as any, state);

        expect(inputProcessor.doStartTextInput).toHaveBeenCalledWith(machine, state);
      });

      it('should validate input compatibility before proceeding', () => {
        // Set up valid text and parse buffers
        machine.state.memory.getByte.mockImplementation((addr) => {
          if (addr === 0x1000) return 20; // Max length
          return 0;
        });

        // Set version to 3
        machine.state.version = 3;

        const state: InputState = {
          mode: InputMode.TEXT,
          resultVar: 0,
          textBuffer: 0x1000,
          parseBuffer: 0x2000,
        };

        // Spy on validateInputCompatibility
        const validateSpy = vi.spyOn(inputProcessor as any, 'validateInputCompatibility');

        inputProcessor.startTextInput(machine as any, state);

        expect(validateSpy).toHaveBeenCalledWith(machine, state);
        expect(inputProcessor.doStartTextInput).toHaveBeenCalledWith(machine, state);
      });

      it('should cancel input if compatibility validation fails', () => {
        // Set version to 3 but try to use Unicode mode (not supported)
        machine.state.version = 3;

        const state: InputState = {
          mode: InputMode.UNICODE_TEXT, // Not supported in V3
          resultVar: 0,
          textBuffer: 0x1000,
          parseBuffer: 0x2000,
        };

        // Spy on onInputComplete
        const onInputCompleteSpy = vi.spyOn(inputProcessor, 'onInputComplete');

        inputProcessor.startTextInput(machine as any, state);

        // Should call onInputComplete with empty input when compatibility fails
        expect(onInputCompleteSpy).toHaveBeenCalledWith(machine, '', 13);
        expect(inputProcessor.doStartTextInput).not.toHaveBeenCalled();
      });

      it('should handle invalid text buffer', () => {
        // Make text buffer validation fail
        machine.state.memory.getByte.mockImplementation(() => {
          throw new Error('Memory access error');
        });

        const state: InputState = {
          mode: InputMode.TEXT,
          resultVar: 0,
          textBuffer: 0x1000,
          parseBuffer: 0x2000,
        };

        // Spy on onInputComplete
        const onInputCompleteSpy = vi.spyOn(inputProcessor, 'onInputComplete');

        inputProcessor.startTextInput(machine as any, state);

        // Should call onInputComplete with empty input when buffer is invalid
        expect(onInputCompleteSpy).toHaveBeenCalledWith(machine, '', 13);
        expect(inputProcessor.doStartTextInput).not.toHaveBeenCalled();
      });

      it('should handle invalid parse buffer', () => {
        // Make text buffer validation succeed
        machine.state.memory.getByte.mockImplementation((addr) => {
          if (addr === 0x1000) return 20; // Max length
          if (addr >= 0x1000 && addr < 0x1000 + 20) return 0;
          throw new Error('Memory access error');
        });

        const state: InputState = {
          mode: InputMode.TEXT,
          resultVar: 0,
          textBuffer: 0x1000,
          parseBuffer: 0x2000,
        };

        // Spy on onInputComplete
        const onInputCompleteSpy = vi.spyOn(inputProcessor, 'onInputComplete');

        inputProcessor.startTextInput(machine as any, state);

        // Should call onInputComplete with empty input when buffer is invalid
        expect(onInputCompleteSpy).toHaveBeenCalledWith(machine, '', 13);
        expect(inputProcessor.doStartTextInput).not.toHaveBeenCalled();
      });

      it('should set up timed input if required', () => {
        // Set up valid text and parse buffers
        machine.state.memory.getByte.mockImplementation((addr) => {
          if (addr === 0x1000) return 20; // Max length
          return 0;
        });

        const state: InputState = {
          mode: InputMode.TIMED_TEXT,
          resultVar: 0,
          textBuffer: 0x1000,
          parseBuffer: 0x2000,
          time: 10,
          routine: 0x3000,
        };

        // Spy on handleTimedInput
        const handleTimedInputSpy = vi.spyOn(inputProcessor, 'handleTimedInput');

        inputProcessor.startTextInput(machine as any, state);

        expect(handleTimedInputSpy).toHaveBeenCalledWith(machine, state);
        expect(inputProcessor.doStartTextInput).toHaveBeenCalledWith(machine, state);
      });

      it('should handle V3-specific input setup', () => {
        // Set version to 3
        machine.state.version = 3;

        // Set up valid text and parse buffers
        machine.state.memory.getByte.mockImplementation((addr) => {
          if (addr === 0x1000) return 20; // Max length
          return 0;
        });

        const state: InputState = {
          mode: InputMode.TEXT,
          resultVar: 0,
          textBuffer: 0x1000,
          parseBuffer: 0x2000,
        };

        // Mock ZMachine.updateStatusBar method (delegated to by handleV3InputSetup)
        machine.updateStatusBar = vi.fn();

        inputProcessor.startTextInput(machine as any, state);

        // Should delegate to ZMachine.updateStatusBar for V3
        expect(machine.updateStatusBar).toHaveBeenCalled();
        expect(inputProcessor.doStartTextInput).toHaveBeenCalledWith(machine, state);
      });

      it('should handle V3 status line update errors gracefully', () => {
        // Set version to 3
        machine.state.version = 3;

        // Set up valid text and parse buffers
        machine.state.memory.getByte.mockImplementation((addr) => {
          if (addr === 0x1000) return 20; // Max length
          return 0;
        });

        // Make global variables access fail
        machine.state.memory.getWord.mockImplementation(() => {
          throw new Error('Memory access error');
        });

        const state: InputState = {
          mode: InputMode.TEXT,
          resultVar: 0,
          textBuffer: 0x1000,
          parseBuffer: 0x2000,
        };

        // Mock screen updateStatusBar method
        machine.screen.updateStatusBar = vi.fn();

        // Should not throw error and should continue with input
        expect(() => {
          inputProcessor.startTextInput(machine as any, state);
        }).not.toThrow();

        // Since compatibility validation fails, doStartTextInput should not be called
        expect(inputProcessor.doStartTextInput).not.toHaveBeenCalled();
      });
    });

    describe('startCharInput', () => {
      it('should call doStartCharInput', () => {
        const state: InputState = {
          mode: InputMode.CHAR,
          resultVar: 0,
        };

        inputProcessor.startCharInput(machine as any, state);

        expect(inputProcessor.doStartCharInput).toHaveBeenCalledWith(machine, state);
      });

      it('should set up timed input if required', () => {
        const state: InputState = {
          mode: InputMode.TIMED_CHAR,
          resultVar: 0,
          time: 10,
          routine: 0x3000,
        };

        // Spy on handleTimedInput
        const handleTimedInputSpy = vi.spyOn(inputProcessor, 'handleTimedInput');

        inputProcessor.startCharInput(machine as any, state);

        expect(handleTimedInputSpy).toHaveBeenCalledWith(machine, state);
        expect(inputProcessor.doStartCharInput).toHaveBeenCalledWith(machine, state);
      });

      it('should enable Unicode mode for V5+ Unicode character input', () => {
        // Set version to 5
        machine.state.version = 5;

        const state: InputState = {
          mode: InputMode.UNICODE_CHAR,
          resultVar: 0,
        };

        inputProcessor.startCharInput(machine as any, state);

        // Should set unicodeMode to true for V5+ Unicode character input
        expect(state.unicodeMode).toBe(true);
        expect(inputProcessor.doStartCharInput).toHaveBeenCalledWith(machine, state);
      });

      it('should not enable Unicode mode for regular character input', () => {
        // Set version to 5
        machine.state.version = 5;

        const state: InputState = {
          mode: InputMode.CHAR,
          resultVar: 0,
        };

        inputProcessor.startCharInput(machine as any, state);

        // Should not set unicodeMode for regular character input
        expect(state.unicodeMode).toBeUndefined();
        expect(inputProcessor.doStartCharInput).toHaveBeenCalledWith(machine, state);
      });
    });

    describe('cancelInput', () => {
      it('should clear timeout handle if it exists', () => {
        // Set up a timeout
        const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

        // Manually set timeoutHandle
        (inputProcessor as any).timeoutHandle = setTimeout(() => {}, 1000);

        inputProcessor.cancelInput(machine as any);

        expect(clearTimeoutSpy).toHaveBeenCalled();
        expect((inputProcessor as any).timeoutHandle).toBeNull();
      });
    });

    describe('handleTimedInput', () => {
      it('should set a timeout for the specified time', () => {
        const setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockReturnValue(123 as any);

        const state: InputState = {
          mode: InputMode.TIMED_TEXT,
          resultVar: 0,
          time: 10,
          routine: 0x3000,
        };

        // Simulate executor being suspended (waiting for input)
        (machine.executor as any).simulateSuspend(state);

        inputProcessor.handleTimedInput(machine as any, state);

        expect(setTimeoutSpy).toHaveBeenCalled();
        // Time argument should be state.time * 100 (10 * 100 = 1000ms)
        expect(setTimeoutSpy.mock.calls[0][1]).toBe(1000);
      });

      it('should not set a timeout if time or routine is missing', () => {
        const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

        const state: InputState = {
          mode: InputMode.TIMED_TEXT,
          resultVar: 0,
          time: 0, // Zero time
          routine: 0x3000,
        };

        // Simulate executor being suspended
        (machine.executor as any).simulateSuspend(state);

        inputProcessor.handleTimedInput(machine as any, state);

        expect(setTimeoutSpy).not.toHaveBeenCalled();
      });

      it('should not set a timeout if executor is not suspended', () => {
        const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

        const state: InputState = {
          mode: InputMode.TIMED_TEXT,
          resultVar: 0,
          time: 10,
          routine: 0x3000,
        };

        // Don't call simulateSuspend - executor is not suspended
        inputProcessor.handleTimedInput(machine as any, state);

        expect(setTimeoutSpy).not.toHaveBeenCalled();
      });
    });

    describe('processTerminatingCharacters', () => {
      it('should return 13 (Enter) for empty input', () => {
        const result = inputProcessor.processTerminatingCharacters('', [13, 27]);
        expect(result).toBe(13);
      });

      it('should detect terminating character at end of input', () => {
        // Set terminatingChars to include 27 (Escape)
        (inputProcessor as any).terminatingChars = [13, 27];

        const result = inputProcessor.processTerminatingCharacters('test\u001B', [13, 27]);
        expect(result).toBe(27); // ASCII for Escape
      });

      it('should detect function key terminating characters', () => {
        // Include function key code 129 (F1)
        (inputProcessor as any).terminatingChars = [13, 129];

        // Input with F1 character somewhere in it
        const input = 'test' + String.fromCharCode(129) + 'more';

        const result = inputProcessor.processTerminatingCharacters(input, [13, 129]);
        expect(result).toBe(129);
      });

      it('should default to Enter (13) when no terminator found', () => {
        const result = inputProcessor.processTerminatingCharacters('test', [27]); // Only Escape as terminator
        expect(result).toBe(13); // Should default to Enter
      });
    });

    describe('onInputComplete', () => {
      it('should process text input for TEXT mode', () => {
        // Set up getInputState mock
        machine.getInputState.mockReturnValue({
          mode: InputMode.TEXT,
          resultVar: 0,
          textBuffer: 0x1000,
          parseBuffer: 0x2000,
        });

        // Spy on processTextInput
        const processTextInputSpy = vi.spyOn(inputProcessor as any, 'processTextInput');

        inputProcessor.onInputComplete(machine as any, 'test', 13);

        expect(processTextInputSpy).toHaveBeenCalledWith(machine, 'test', 13);
        expect(machine.executor.resume).toHaveBeenCalled();
      });

      it('should process char input for CHAR mode', () => {
        // Set up getInputState mock
        machine.getInputState.mockReturnValue({
          mode: InputMode.CHAR,
          resultVar: 0,
        });

        // Spy on processCharInput
        const processCharInputSpy = vi.spyOn(inputProcessor as any, 'processCharInput');

        inputProcessor.onInputComplete(machine as any, 't', 13);

        expect(processCharInputSpy).toHaveBeenCalledWith(machine, 't');
        expect(machine.executor.resume).toHaveBeenCalled();
      });

      it('should cancel any pending input', () => {
        // Set up getInputState mock
        machine.getInputState.mockReturnValue({
          mode: InputMode.TEXT,
          resultVar: 0,
          textBuffer: 0x1000,
        });

        // Spy on cancelInput
        const cancelInputSpy = vi.spyOn(inputProcessor, 'cancelInput');

        inputProcessor.onInputComplete(machine as any, 'test', 13);

        expect(cancelInputSpy).toHaveBeenCalledWith(machine);
      });
    });

    describe('onKeyPress', () => {
      it('should store key code in result variable', () => {
        // Set up getInputState mock
        machine.getInputState.mockReturnValue({
          mode: InputMode.CHAR,
          resultVar: 0,
        });

        inputProcessor.onKeyPress(machine as any, 'A');

        // 'A' should be stored as 65
        expect(machine.state.storeVariable).toHaveBeenCalledWith(0, 65);
        expect(machine.executor.resume).toHaveBeenCalled();
      });

      it('should handle empty key input', () => {
        // Set up getInputState mock
        machine.getInputState.mockReturnValue({
          mode: InputMode.CHAR,
          resultVar: 0,
        });

        inputProcessor.onKeyPress(machine as any, '');

        // Empty string should store 0
        expect(machine.state.storeVariable).toHaveBeenCalledWith(0, 0);
      });
    });

    describe('onInputTimeout', () => {
      it('should call the routine specified in state and execute it', async () => {
        const state: InputState = {
          mode: InputMode.TIMED_TEXT,
          resultVar: 0,
          routine: 0x1234,
        };

        // Simulate executor being suspended
        (machine.executor as any).simulateSuspend(state);

        machine.state.memory.unpackRoutineAddress.mockReturnValue(0x2468);
        machine.state.callstack = { length: 1 };

        inputProcessor.onInputTimeout(machine as any, state);

        // Should call the routine with variable 0 (stack) to capture return value
        expect(machine.state.callRoutine).toHaveBeenCalledWith(0x2468, 0);
        expect(machine.executor.executeTimeoutRoutine).toHaveBeenCalledWith(1);
      });

      it('should restart timer if routine returns 0', async () => {
        const state: InputState = {
          mode: InputMode.TIMED_TEXT,
          resultVar: 0,
          routine: 0x1234,
          time: 10,
        };

        // Simulate executor being suspended
        (machine.executor as any).simulateSuspend(state);

        machine.state.memory.unpackRoutineAddress.mockReturnValue(0x2468);
        machine.state.callstack = { length: 1 };
        machine.executor.executeTimeoutRoutine.mockResolvedValue(0);

        inputProcessor.onInputTimeout(machine as any, state);

        // Wait for the promise to resolve
        await vi.waitFor(() => {
          expect(machine.executor.executeTimeoutRoutine).toHaveBeenCalled();
        });
      });

      it('should complete input if routine returns non-zero', async () => {
        const state: InputState = {
          mode: InputMode.TIMED_TEXT,
          resultVar: 0,
          routine: 0x1234,
          time: 10,
          currentInput: 'test',
        };

        // Simulate executor being suspended
        (machine.executor as any).simulateSuspend(state);

        machine.state.memory.unpackRoutineAddress.mockReturnValue(0x2468);
        machine.state.callstack = { length: 1 };
        machine.executor.executeTimeoutRoutine.mockResolvedValue(1);

        // Spy on onInputComplete
        const onInputCompleteSpy = vi.spyOn(inputProcessor, 'onInputComplete');

        inputProcessor.onInputTimeout(machine as any, state);

        // Wait for the promise to resolve
        await vi.waitFor(() => {
          expect(onInputCompleteSpy).toHaveBeenCalledWith(machine, 'test', 0);
        });
      });

      it('should do nothing if no routine specified', () => {
        const state: InputState = {
          mode: InputMode.TIMED_TEXT,
          resultVar: 0,
          routine: undefined,
        };

        // Simulate executor being suspended
        (machine.executor as any).simulateSuspend(state);

        inputProcessor.onInputTimeout(machine as any, state);

        expect(machine.state.callRoutine).not.toHaveBeenCalled();
        expect(machine.executor.executeTimeoutRoutine).not.toHaveBeenCalled();
      });

      it('should do nothing if executor is not suspended', () => {
        const state: InputState = {
          mode: InputMode.TIMED_TEXT,
          resultVar: 0,
          routine: 0x1234,
        };

        // Don't call simulateSuspend - executor is not suspended
        inputProcessor.onInputTimeout(machine as any, state);

        expect(machine.state.callRoutine).not.toHaveBeenCalled();
        expect(machine.executor.executeTimeoutRoutine).not.toHaveBeenCalled();
      });
    });

    describe('storeTextInput', () => {
      it('should store text input according to V1-4 format', () => {
        // Set version to 3
        machine.state.version = 3;

        // Set up text buffer with max length 10
        machine.state.memory.getByte.mockImplementation((addr) => {
          if (addr === 0x1000) return 10; // Max length
          return 0;
        });

        // Call the exposed method
        inputProcessor.exposedStoreTextInput(machine, 'test', 0x1000);

        // Should store as null-terminated string
        // 't' = 116, 'e' = 101, 's' = 115, 't' = 116, followed by 0
        expect(machine.state.memory.setByte).toHaveBeenCalledWith(0x1000 + 1, 116); // 't'
        expect(machine.state.memory.setByte).toHaveBeenCalledWith(0x1000 + 2, 101); // 'e'
        expect(machine.state.memory.setByte).toHaveBeenCalledWith(0x1000 + 3, 115); // 's'
        expect(machine.state.memory.setByte).toHaveBeenCalledWith(0x1000 + 4, 116); // 't'
        expect(machine.state.memory.setByte).toHaveBeenCalledWith(0x1000 + 5, 0); // null terminator
      });

      it('should store text input according to V5+ format', () => {
        // Set version to 5
        machine.state.version = 5;

        // Set up text buffer with max length 10
        machine.state.memory.getByte.mockImplementation((addr) => {
          if (addr === 0x1000) return 10; // Max length
          return 0;
        });

        // Call the exposed method
        inputProcessor.exposedStoreTextInput(machine, 'test', 0x1000);

        // Should store with length prefix (4) followed by characters
        expect(machine.state.memory.setByte).toHaveBeenCalledWith(0x1000 + 1, 4); // length
        expect(machine.state.memory.setByte).toHaveBeenCalledWith(0x1000 + 2, 116); // 't'
        expect(machine.state.memory.setByte).toHaveBeenCalledWith(0x1000 + 3, 101); // 'e'
        expect(machine.state.memory.setByte).toHaveBeenCalledWith(0x1000 + 4, 115); // 's'
        expect(machine.state.memory.setByte).toHaveBeenCalledWith(0x1000 + 5, 116); // 't'
      });

      it('should truncate input that exceeds max length', () => {
        // Set version to 3
        machine.state.version = 3;

        // Set up text buffer with max length 5
        machine.state.memory.getByte.mockImplementation((addr) => {
          if (addr === 0x1000) return 5; // Max length - 1 for terminator = 4 chars
          return 0;
        });

        // Call the exposed method with input longer than allowed
        inputProcessor.exposedStoreTextInput(machine, 'testing', 0x1000);

        // Should store only first 4 chars ('test') + null terminator
        expect(machine.state.memory.setByte).toHaveBeenCalledWith(0x1000 + 1, 116); // 't'
        expect(machine.state.memory.setByte).toHaveBeenCalledWith(0x1000 + 2, 101); // 'e'
        expect(machine.state.memory.setByte).toHaveBeenCalledWith(0x1000 + 3, 115); // 's'
        expect(machine.state.memory.setByte).toHaveBeenCalledWith(0x1000 + 4, 116); // 't'
        expect(machine.state.memory.setByte).toHaveBeenCalledWith(0x1000 + 5, 0); // null terminator

        // 'ing' should not be stored
        expect(machine.state.memory.setByte).not.toHaveBeenCalledWith(0x1000 + 6, 105); // 'i'
      });
    });

    describe('loadTerminatingCharacters', () => {
      it('should default to Enter (13) terminator', () => {
        // No custom terminators in header
        machine.state.memory.getWord.mockImplementation((addr) => {
          if (addr === HeaderLocation.TerminatingChars) return 0;
          return 0;
        });

        inputProcessor.exposedLoadTerminatingCharacters(machine);

        // Should only have Enter (13) as terminator
        expect(inputProcessor.getTerminatingChars()).toEqual([13]);
      });

      it('should load custom terminators for V5+', () => {
        // Set version to 5
        machine.state.version = 5;

        // Set terminating chars table address
        machine.state.memory.getWord.mockImplementation((addr) => {
          if (addr === HeaderLocation.TerminatingChars) return 0x2000;
          return 0;
        });

        // Set up terminating chars table: 27 (Escape), 129 (F1), 0 (end)
        machine.state.memory.getByte.mockImplementation((addr) => {
          if (addr === 0x2000) return 27; // Escape
          if (addr === 0x2001) return 129; // F1
          if (addr === 0x2002) return 0; // End of table
          return 0;
        });

        inputProcessor.exposedLoadTerminatingCharacters(machine);

        // Should have Escape (27), F1 (129), and always Enter (13)
        expect(inputProcessor.getTerminatingChars()).toContain(13);
        expect(inputProcessor.getTerminatingChars()).toContain(27);
        expect(inputProcessor.getTerminatingChars()).toContain(129);
        expect(inputProcessor.getTerminatingChars().length).toBe(3);
      });

      it('should handle special terminator 255 (any function key)', () => {
        // Set version to 5
        machine.state.version = 5;

        // Set terminating chars table address
        machine.state.memory.getWord.mockImplementation((addr) => {
          if (addr === HeaderLocation.TerminatingChars) return 0x2000;
          return 0;
        });

        // Set up terminating chars table: 255 (any function key), 0 (end)
        machine.state.memory.getByte.mockImplementation((addr) => {
          if (addr === 0x2000) return 255; // Any function key
          if (addr === 0x2001) return 0; // End of table
          return 0;
        });

        inputProcessor.exposedLoadTerminatingCharacters(machine);

        // Should have expanded 255 to all function keys (129-154, 252-254)
        // Plus Enter (13)
        const terminators = inputProcessor.getTerminatingChars();
        expect(terminators).toContain(13);

        // Check each function key code is included
        for (let i = 129; i <= 154; i++) {
          expect(terminators).toContain(i);
        }

        for (let i = 252; i <= 254; i++) {
          expect(terminators).toContain(i);
        }

        // Should not have 255 itself anymore
        expect(terminators).not.toContain(255);
      });

      it('should ignore invalid terminating characters', () => {
        // Set version to 5
        machine.state.version = 5;

        // Set terminating chars table address
        machine.state.memory.getWord.mockImplementation((addr) => {
          if (addr === HeaderLocation.TerminatingChars) return 0x2000;
          return 0;
        });

        // Set up terminating chars table: 27 (valid), 65 (invalid - 'A'), 0 (end)
        machine.state.memory.getByte.mockImplementation((addr) => {
          if (addr === 0x2000) return 27; // Escape (valid)
          if (addr === 0x2001) return 65; // 'A' (invalid)
          if (addr === 0x2002) return 0; // End of table
          return 0;
        });

        inputProcessor.exposedLoadTerminatingCharacters(machine);

        // Should only have valid terminators: Enter (13) and Escape (27)
        const terminators = inputProcessor.getTerminatingChars();
        expect(terminators).toContain(13);
        expect(terminators).toContain(27);
        expect(terminators).not.toContain(65);
        expect(terminators.length).toBe(2);
      });
    });

    describe('validateTextBuffer', () => {
      it('should validate V1-4 text buffer', () => {
        // Set version to 3
        machine.state.version = 3;

        // Set up valid text buffer with max length 5
        machine.state.memory.getByte.mockImplementation((addr) => {
          if (addr === 0x1000) return 5; // Max length
          return 0;
        });

        const result = inputProcessor.exposedValidateTextBuffer(machine, 0x1000);

        expect(result).toBe(true);
      });

      it('should validate V5+ text buffer', () => {
        // Set version to 5
        machine.state.version = 5;

        // Set up valid text buffer with max length 5
        machine.state.memory.getByte.mockImplementation((addr) => {
          if (addr === 0x1000) return 5; // Max length
          return 0;
        });

        const result = inputProcessor.exposedValidateTextBuffer(machine, 0x1000);

        expect(result).toBe(true);
      });

      it('should fail validation on invalid address', () => {
        // Make getByte throw for invalid addresses
        machine.state.memory.getByte.mockImplementation((addr) => {
          if (addr === 0x1000) return 5; // Max length
          throw new Error('Invalid memory access');
        });

        const result = inputProcessor.exposedValidateTextBuffer(machine, 0x1000);

        expect(result).toBe(false);
      });
    });

    describe('validateParseBuffer', () => {
      it('should validate parse buffer', () => {
        // Set up valid parse buffer
        machine.state.memory.getByte.mockImplementation((addr) => {
          if (addr === 0x2000) return 4; // Max tokens
          if (addr === 0x2000 + 1) return 0; // Actual tokens
          if (addr === 0x2000 + 4) return 0; // First token length
          if (addr === 0x2000 + 5) return 0; // First token position
          return 0;
        });

        machine.state.memory.getWord.mockImplementation((addr) => {
          if (addr === 0x2000 + 2) return 0x3000; // First token address
          return 0;
        });

        const result = inputProcessor.exposedValidateParseBuffer(machine, 0x2000);

        expect(result).toBe(true);
      });

      it('should fail validation on invalid address', () => {
        // Make getByte throw for invalid addresses
        machine.state.memory.getByte.mockImplementation((addr) => {
          if (addr === 0x2000) return 4; // Max tokens
          throw new Error('Invalid memory access');
        });

        const result = inputProcessor.exposedValidateParseBuffer(machine, 0x2000);

        expect(result).toBe(false);
      });
    });

    describe('processTextInput', () => {
      it('should store input and tokenize for V1-4', () => {
        // Set version to 3
        machine.state.version = 3;

        // Set up getInputState mock
        machine.getInputState.mockReturnValue({
          mode: InputMode.TEXT,
          resultVar: 0,
          textBuffer: 0x1000,
          parseBuffer: 0x2000,
        });

        // Spy on storeTextInput
        const storeTextInputSpy = vi.spyOn(inputProcessor as any, 'storeTextInput');

        inputProcessor.exposedProcessTextInput(machine, 'test', 13);

        expect(storeTextInputSpy).toHaveBeenCalledWith(machine, 'test', 0x1000);
        expect(machine.state.tokenizeLine).toHaveBeenCalledWith(0x1000, 0x2000);

        // V1-4 should not store terminating character
        expect(machine.state.storeVariable).not.toHaveBeenCalled();
      });

      it('should store input, tokenize, and store terminator for V5+', () => {
        // Set version to 5
        machine.state.version = 5;

        // Set up getInputState mock
        machine.getInputState.mockReturnValue({
          mode: InputMode.TEXT,
          resultVar: 0,
          textBuffer: 0x1000,
          parseBuffer: 0x2000,
        });

        // Spy on storeTextInput
        const storeTextInputSpy = vi.spyOn(inputProcessor as any, 'storeTextInput');

        inputProcessor.exposedProcessTextInput(machine, 'test', 27); // Use Escape (27) as terminator

        expect(storeTextInputSpy).toHaveBeenCalledWith(machine, 'test', 0x1000);
        expect(machine.state.tokenizeLine).toHaveBeenCalledWith(0x1000, 0x2000);

        // V5+ should store terminating character
        expect(machine.state.storeVariable).toHaveBeenCalledWith(0, 27);
      });

      it('should process Unicode input for V5+ Unicode text mode', () => {
        // Set version to 5
        machine.state.version = 5;

        // Set up getInputState mock with Unicode mode
        machine.getInputState.mockReturnValue({
          mode: InputMode.UNICODE_TEXT,
          resultVar: 0,
          textBuffer: 0x1000,
          parseBuffer: 0x2000,
          unicodeMode: true,
        });

        // Spy on processUnicodeInput
        const processUnicodeSpy = vi.spyOn(inputProcessor as any, 'processUnicodeInput');

        inputProcessor.exposedProcessTextInput(machine, 'test\u00E9', 13); // 'testé'

        // Should process Unicode input
        expect(processUnicodeSpy).toHaveBeenCalledWith('testé');
        expect(machine.state.tokenizeLine).toHaveBeenCalledWith(0x1000, 0x2000);
      });

      it('should skip tokenization if parse buffer is invalid', () => {
        // Set version to 3
        machine.state.version = 3;

        // Set up getInputState mock
        machine.getInputState.mockReturnValue({
          mode: InputMode.TEXT,
          resultVar: 0,
          textBuffer: 0x1000,
          parseBuffer: 0x2000,
        });

        // Make parse buffer validation fail
        vi.spyOn(inputProcessor as any, 'validateParseBuffer').mockReturnValue(false);

        inputProcessor.exposedProcessTextInput(machine, 'test', 13);

        // Should still store text input
        expect(machine.state.memory.setByte).toHaveBeenCalled();

        // But should not tokenize
        expect(machine.state.tokenizeLine).not.toHaveBeenCalled();
      });
    });

    describe('processCharInput', () => {
      it('should store character code in result variable', () => {
        // Set up getInputState mock
        machine.getInputState.mockReturnValue({
          mode: InputMode.CHAR,
          resultVar: 0,
        });

        inputProcessor.exposedProcessCharInput(machine, 'A');

        // 'A' should be stored as 65
        expect(machine.state.storeVariable).toHaveBeenCalledWith(0, 65);
      });

      it('should handle empty input', () => {
        // Set up getInputState mock
        machine.getInputState.mockReturnValue({
          mode: InputMode.CHAR,
          resultVar: 0,
        });

        inputProcessor.exposedProcessCharInput(machine, '');

        // Empty string should store 0
        expect(machine.state.storeVariable).toHaveBeenCalledWith(0, 0);
      });
    });

    describe('validateInputCompatibility', () => {
      it('should validate Unicode input mode compatibility with V5+', () => {
        // Set version to 5
        machine.state.version = 5;

        const state: InputState = {
          mode: InputMode.UNICODE_TEXT,
          resultVar: 0,
        };

        const result = inputProcessor.exposedValidateInputCompatibility(machine, state);

        expect(result).toBe(true);
      });

      it('should reject Unicode input mode for V1-4', () => {
        // Set version to 3
        machine.state.version = 3;

        const state: InputState = {
          mode: InputMode.UNICODE_TEXT,
          resultVar: 0,
        };

        const result = inputProcessor.exposedValidateInputCompatibility(machine, state);

        expect(result).toBe(false);
      });

      it('should validate timed input compatibility with V3+', () => {
        // Set version to 3
        machine.state.version = 3;

        const state: InputState = {
          mode: InputMode.TIMED_TEXT,
          resultVar: 0,
          time: 10,
          routine: 0x3000,
        };

        const result = inputProcessor.exposedValidateInputCompatibility(machine, state);

        expect(result).toBe(true);
      });

      it('should reject timed input for V1-2', () => {
        // Set version to 2
        machine.state.version = 2;

        const state: InputState = {
          mode: InputMode.TIMED_TEXT,
          resultVar: 0,
          time: 10,
          routine: 0x3000,
        };

        const result = inputProcessor.exposedValidateInputCompatibility(machine, state);

        expect(result).toBe(false);
      });

      it('should validate V3 text input requires both buffers', () => {
        // Set version to 3
        machine.state.version = 3;

        const state: InputState = {
          mode: InputMode.TEXT,
          resultVar: 0,
          textBuffer: 0x1000,
          // Missing parseBuffer - should fail validation
        };

        const result = inputProcessor.exposedValidateInputCompatibility(machine, state);

        expect(result).toBe(false);
      });

      it('should allow V3 text input with both buffers', () => {
        // Set version to 3
        machine.state.version = 3;

        const state: InputState = {
          mode: InputMode.TEXT,
          resultVar: 0,
          textBuffer: 0x1000,
          parseBuffer: 0x2000,
        };

        const result = inputProcessor.exposedValidateInputCompatibility(machine, state);

        expect(result).toBe(true);
      });

      it('should allow V4+ text input without parse buffer', () => {
        // Set version to 4
        machine.state.version = 4;

        const state: InputState = {
          mode: InputMode.TEXT,
          resultVar: 0,
          textBuffer: 0x1000,
          // Missing parseBuffer - should be allowed in V4+
        };

        const result = inputProcessor.exposedValidateInputCompatibility(machine, state);

        expect(result).toBe(true);
      });
    });

    describe('processUnicodeInput', () => {
      it('should filter out invalid Unicode characters', () => {
        const input = 'Hello\u0000World\u0007Test'; // Contains null and bell characters
        const result = inputProcessor.exposedProcessUnicodeInput(input);

        // Should filter out control characters below 32
        expect(result).toBe('HelloWorldTest');
      });

      it('should preserve valid ASCII characters', () => {
        const input = 'Hello World! 123';
        const result = inputProcessor.exposedProcessUnicodeInput(input);

        expect(result).toBe('Hello World! 123');
      });

      it('should handle mixed Unicode and ASCII', () => {
        const input = 'Hello\u00E9\u00F1\u00F6World'; // 'HelloéñöWorld'
        const result = inputProcessor.exposedProcessUnicodeInput(input);

        // Should filter to basic ASCII range (32-126)
        expect(result).toBe('HelloWorld');
      });

      it('should handle empty input', () => {
        const result = inputProcessor.exposedProcessUnicodeInput('');

        expect(result).toBe('');
      });

      it('should handle input with only control characters', () => {
        const input = '\u0000\u0007\u0008\u0009\u000A\u000D';
        const result = inputProcessor.exposedProcessUnicodeInput(input);

        expect(result).toBe('');
      });
    });

    describe('handleV3InputSetup', () => {
      it('should delegate to ZMachine.updateStatusBar', () => {
        // Mock ZMachine.updateStatusBar method
        machine.updateStatusBar = vi.fn();

        inputProcessor.exposedHandleV3InputSetup(machine);

        // Should delegate to ZMachine.updateStatusBar which handles:
        // - Looking up the location object's name (not just the number)
        // - Checking Flags1 bit 1 for time mode (not global variable 3)
        expect(machine.updateStatusBar).toHaveBeenCalled();
      });

      it('should handle missing screen gracefully', () => {
        // Set up global variables
        machine.state.memory.getWord.mockImplementation((addr) => {
          if (addr === HeaderLocation.GlobalVariables) return 0x3000;
          return 0;
        });

        // Remove screen object
        delete machine.screen;

        // Should not throw error
        expect(() => {
          inputProcessor.exposedHandleV3InputSetup(machine);
        }).not.toThrow();
      });

      it('should handle missing updateStatusBar method gracefully', () => {
        // Set up global variables
        machine.state.memory.getWord.mockImplementation((addr) => {
          if (addr === HeaderLocation.GlobalVariables) return 0x3000;
          return 0;
        });

        // Remove updateStatusBar method
        delete machine.screen.updateStatusBar;

        // Should not throw error
        expect(() => {
          inputProcessor.exposedHandleV3InputSetup(machine);
        }).not.toThrow();
      });

      it('should handle memory access errors gracefully', () => {
        // Make global variables access fail
        machine.state.memory.getWord.mockImplementation(() => {
          throw new Error('Memory access error');
        });

        // Mock screen updateStatusBar method
        machine.screen.updateStatusBar = vi.fn();

        // Should not throw error and should not call updateStatusBar
        expect(() => {
          inputProcessor.exposedHandleV3InputSetup(machine);
        }).not.toThrow();

        expect(machine.screen.updateStatusBar).not.toHaveBeenCalled();
      });
    });
  });
});
