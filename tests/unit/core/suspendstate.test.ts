import { describe, expect, it } from 'vitest';
import { SuspendState } from '../../../src/core/execution/SuspendState';
import { InputMode } from '../../../src/ui/input/InputInterface';

describe('SuspendState', () => {
  // Existing tests
  it('should create an instance with the provided state', () => {
    const inputState = {
      keyPress: false,
      resultVar: 42,
      textBuffer: 0x1000,
      parseBuffer: 0x1100,
      time: 10,
      routine: 0x2000,
    };

    const suspendState = new SuspendState(inputState);

    expect(suspendState.state).toEqual(inputState);
    expect(suspendState.state.keyPress).toBe(false);
    expect(suspendState.state.resultVar).toBe(42);
    expect(suspendState.state.textBuffer).toBe(0x1000);
    expect(suspendState.state.parseBuffer).toBe(0x1100);
    expect(suspendState.state.time).toBe(10);
    expect(suspendState.state.routine).toBe(0x2000);
  });

  it('should create an instance for key press input', () => {
    const inputState = {
      keyPress: true,
      resultVar: 12,
      time: 5,
      routine: 0x3000,
    };

    const suspendState = new SuspendState(inputState);

    expect(suspendState.state).toEqual(inputState);
    expect(suspendState.state.keyPress).toBe(true);
    expect(suspendState.state.resultVar).toBe(12);
    expect(suspendState.state.textBuffer).toBeUndefined();
    expect(suspendState.state.parseBuffer).toBeUndefined();
    expect(suspendState.state.time).toBe(5);
    expect(suspendState.state.routine).toBe(0x3000);
  });

  it('should be an instance of Error', () => {
    const inputState = {
      keyPress: false,
      resultVar: 42,
    };

    const suspendState = new SuspendState(inputState);

    expect(suspendState).toBeInstanceOf(Error);
    expect(suspendState.message).toBe('Execution suspended waiting for user input');
  });

  it('should preserve the error prototype chain', () => {
    const suspendState = new SuspendState({
      keyPress: false,
      resultVar: 42,
    });

    expect(Object.getPrototypeOf(suspendState)).toBe(SuspendState.prototype);
    expect(suspendState instanceof SuspendState).toBe(true);
    expect(suspendState instanceof Error).toBe(true);
  });

  it('should handle incomplete input state', () => {
    const inputState = {
      keyPress: false,
      resultVar: 42,
    };

    const suspendState = new SuspendState(inputState);

    expect(suspendState.state).toEqual(inputState);
    expect(suspendState.state.keyPress).toBe(false);
    expect(suspendState.state.resultVar).toBe(42);
    expect(suspendState.state.textBuffer).toBeUndefined();
    expect(suspendState.state.parseBuffer).toBeUndefined();
    expect(suspendState.state.time).toBeUndefined();
    expect(suspendState.state.routine).toBeUndefined();
  });

  // New tests for toInputState method
  describe('toInputState', () => {
    it('should convert to TEXT mode for non-keyPress without time', () => {
      const inputState = {
        keyPress: false,
        resultVar: 42,
        textBuffer: 0x1000,
        parseBuffer: 0x1100,
      };

      const suspendState = new SuspendState(inputState);
      const result = suspendState.toInputState();

      expect(result.mode).toBe(InputMode.TEXT);
      expect(result.resultVar).toBe(42);
      expect(result.textBuffer).toBe(0x1000);
      expect(result.parseBuffer).toBe(0x1100);
      expect(result.time).toBeUndefined();
      expect(result.routine).toBeUndefined();
    });

    it('should convert to TIMED_TEXT mode for non-keyPress with time', () => {
      const inputState = {
        keyPress: false,
        resultVar: 42,
        textBuffer: 0x1000,
        parseBuffer: 0x1100,
        time: 10,
        routine: 0x2000,
      };

      const suspendState = new SuspendState(inputState);
      const result = suspendState.toInputState();

      expect(result.mode).toBe(InputMode.TIMED_TEXT);
      expect(result.time).toBe(10);
      expect(result.routine).toBe(0x2000);
    });

    it('should convert to CHAR mode for keyPress without time', () => {
      const inputState = {
        keyPress: true,
        resultVar: 42,
      };

      const suspendState = new SuspendState(inputState);
      const result = suspendState.toInputState();

      expect(result.mode).toBe(InputMode.CHAR);
      expect(result.resultVar).toBe(42);
    });

    it('should convert to TIMED_CHAR mode for keyPress with time', () => {
      const inputState = {
        keyPress: true,
        resultVar: 42,
        time: 10,
        routine: 0x2000,
      };

      const suspendState = new SuspendState(inputState);
      const result = suspendState.toInputState();

      expect(result.mode).toBe(InputMode.TIMED_CHAR);
      expect(result.time).toBe(10);
      expect(result.routine).toBe(0x2000);
    });
  });

  // Tests for edge cases
  describe('edge cases', () => {
    it('should handle zero values correctly', () => {
      const inputState = {
        keyPress: false,
        resultVar: 0,
        textBuffer: 0,
        parseBuffer: 0,
        time: 0,
        routine: 0,
      };

      const suspendState = new SuspendState(inputState);
      const result = suspendState.toInputState();

      expect(result.resultVar).toBe(0);
      expect(result.textBuffer).toBe(0);
      expect(result.parseBuffer).toBe(0);
      expect(result.time).toBe(0);
      expect(result.routine).toBe(0);
    });

    it('should work with minimal required state', () => {
      // According to the implementation, only keyPress and resultVar are required
      const inputState = {
        keyPress: false,
        resultVar: 42,
      };

      const suspendState = new SuspendState(inputState);
      const result = suspendState.toInputState();

      expect(result.mode).toBe(InputMode.TEXT);
      expect(result.resultVar).toBe(42);
    });
  });

  // Test state immutability
  describe('state immutability', () => {
    it('should not allow modification of internal state through returned state', () => {
      const inputState = {
        keyPress: false,
        resultVar: 42,
        textBuffer: 0x1000,
      };

      const suspendState = new SuspendState(inputState);

      // This modification should not affect the original object
      const retrievedState = suspendState.state;
      retrievedState.resultVar = 99;

      // Both the internal state and the state we passed should remain unchanged
      expect(suspendState.state.resultVar).toBe(42);
      expect(inputState.resultVar).toBe(42);
    });
  });
});
