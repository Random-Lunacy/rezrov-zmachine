import { describe, it, expect } from 'vitest';
import { SuspendState } from '../../src/core/execution/SuspendState';

describe('SuspendState', () => {
  it('should create an instance with the provided state', () => {
    // Setup
    const inputState = {
      keyPress: false,
      resultVar: 42,
      textBuffer: 0x1000,
      parseBuffer: 0x1100,
      time: 10,
      routine: 0x2000
    };

    // Act
    const suspendState = new SuspendState(inputState);

    // Assert
    expect(suspendState.state).toBe(inputState);
    expect(suspendState.state.keyPress).toBe(false);
    expect(suspendState.state.resultVar).toBe(42);
    expect(suspendState.state.textBuffer).toBe(0x1000);
    expect(suspendState.state.parseBuffer).toBe(0x1100);
    expect(suspendState.state.time).toBe(10);
    expect(suspendState.state.routine).toBe(0x2000);
  });

  it('should create an instance for key press input', () => {
    // Setup
    const inputState = {
      keyPress: true,
      resultVar: 12,
      time: 5,
      routine: 0x3000
    };

    // Act
    const suspendState = new SuspendState(inputState);

    // Assert
    expect(suspendState.state).toBe(inputState);
    expect(suspendState.state.keyPress).toBe(true);
    expect(suspendState.state.resultVar).toBe(12);
    expect(suspendState.state.textBuffer).toBeUndefined();
    expect(suspendState.state.parseBuffer).toBeUndefined();
    expect(suspendState.state.time).toBe(5);
    expect(suspendState.state.routine).toBe(0x3000);
  });

  it('should be an instance of Error', () => {
    // Setup
    const inputState = {
      keyPress: false,
      resultVar: 42
    };

    // Act
    const suspendState = new SuspendState(inputState);

    // Assert
    expect(suspendState).toBeInstanceOf(Error);
    expect(suspendState.message).toBe('Execution suspended waiting for user input');
  });

  it('should preserve the error prototype chain', () => {
    // Setup & Act
    const suspendState = new SuspendState({
      keyPress: false,
      resultVar: 42
    });

    // Assert
    expect(Object.getPrototypeOf(suspendState)).toBe(SuspendState.prototype);
    expect(suspendState instanceof SuspendState).toBe(true);
    expect(suspendState instanceof Error).toBe(true);
  });

  it('should handle incomplete input state', () => {
    // Setup - minimum required properties
    const inputState = {
      keyPress: false,
      resultVar: 42
    };

    // Act
    const suspendState = new SuspendState(inputState);

    // Assert
    expect(suspendState.state).toBe(inputState);
    expect(suspendState.state.keyPress).toBe(false);
    expect(suspendState.state.resultVar).toBe(42);
    expect(suspendState.state.textBuffer).toBeUndefined();
    expect(suspendState.state.parseBuffer).toBeUndefined();
    expect(suspendState.state.time).toBeUndefined();
    expect(suspendState.state.routine).toBeUndefined();
  });
});
