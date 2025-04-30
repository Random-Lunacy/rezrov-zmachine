import { Mock, vi } from 'vitest';
import { StackFrame } from '../../src/core/execution/StackFrame';

/**
 * MockStackFrame provides a flexible implementation of StackFrame
 * for unit testing purposes
 */
export class MockStackFrame implements StackFrame {
  // Configurable properties with sensible defaults
  returnPC: number;
  previousSP: number;
  locals: Uint16Array;
  resultVariable: number | null;
  argumentCount: number;
  routineAddress: number;
  frameStack?: number[];

  // Mocking utilities
  private _mockMethods: { [key: string]: Mock } = {};

  constructor(config: Partial<StackFrame> = {}) {
    this.returnPC = config.returnPC ?? 0x1000;
    this.previousSP = config.previousSP ?? 0;

    // Robust locals initialization
    if (config.locals instanceof Uint16Array) {
      this.locals = config.locals;
    } else if (Array.isArray(config.locals)) {
      this.locals = new Uint16Array(config.locals);
    } else {
      const localLength =
        typeof config.locals === 'object' && config.locals !== null
          ? Object.prototype.hasOwnProperty.call(config.locals, 'length')
            ? (config.locals as { length: number }).length
            : 0
          : 0;
      this.locals = new Uint16Array(localLength);
    }

    this.resultVariable = config.resultVariable ?? null;
    this.argumentCount = config.argumentCount ?? 0;
    this.routineAddress = config.routineAddress ?? 0x2000;
    this.frameStack = config.frameStack ?? [];
  }

  /**
   * Create a mock stack frame with predefined configurations
   */
  static create(overrides: Partial<StackFrame> = {}): MockStackFrame {
    return new MockStackFrame(overrides);
  }

  /**
   * Create a stack frame with a specific number of locals
   */
  static withLocals(localCount: number, localValues?: number[] | Uint16Array): MockStackFrame {
    let locals: Uint16Array;

    if (localValues instanceof Uint16Array) {
      locals =
        localValues.length > localCount
          ? localValues.subarray(0, localCount)
          : new Uint16Array([...localValues, ...new Array(localCount - localValues.length).fill(0)]);
    } else if (Array.isArray(localValues)) {
      locals = new Uint16Array(localCount);
      locals.set(localValues.slice(0, localCount));
    } else {
      locals = new Uint16Array(localCount);
    }

    return new MockStackFrame({ locals });
  }

  /**
   * Create a stack frame with a result variable
   */
  static withResultVariable(resultVar: number, value?: number): MockStackFrame {
    return new MockStackFrame({
      resultVariable: resultVar,
      locals: value !== undefined ? new Uint16Array([value]) : undefined,
    });
  }

  /**
   * Add a mock method to the stack frame
   */
  mockMethod(methodName: string): Mock {
    const mock = vi.fn();
    this._mockMethods[methodName] = mock;
    return mock;
  }

  /**
   * Get a previously created mock method
   */
  getMockMethod(methodName: string): Mock | undefined {
    return this._mockMethods[methodName];
  }

  /**
   * Utility method to reset all mock methods
   */
  resetMocks(): void {
    Object.values(this._mockMethods).forEach((mock) => mock.mockClear());
  }

  /**
   * Create a deep clone of the stack frame
   */
  clone(): MockStackFrame {
    return new MockStackFrame({
      returnPC: this.returnPC,
      previousSP: this.previousSP,
      locals: new Uint16Array(this.locals), // Ensure new Uint16Array
      resultVariable: this.resultVariable,
      argumentCount: this.argumentCount,
      routineAddress: this.routineAddress,
      frameStack: this.frameStack ? [...this.frameStack] : undefined,
    });
  }

  /**
   * Perform a partial update of the stack frame
   */
  update(updates: Partial<StackFrame>): MockStackFrame {
    return new MockStackFrame({
      returnPC: updates.returnPC ?? this.returnPC,
      previousSP: updates.previousSP ?? this.previousSP,
      locals:
        updates.locals instanceof Uint16Array
          ? updates.locals
          : Array.isArray(updates.locals)
            ? new Uint16Array(updates.locals)
            : this.locals,
      resultVariable: updates.resultVariable ?? this.resultVariable,
      argumentCount: updates.argumentCount ?? this.argumentCount,
      routineAddress: updates.routineAddress ?? this.routineAddress,
      frameStack: updates.frameStack ?? this.frameStack,
    });
  }

  /**
   * Validate the stack frame against certain conditions
   */
  validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.locals.length > 15) {
      errors.push('Too many local variables (max 15)');
    }

    if (this.argumentCount > this.locals.length) {
      errors.push('Argument count exceeds local variable count');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
