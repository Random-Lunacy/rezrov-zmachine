// src/core/execution/SuspendState.ts
import { InputState } from './InputState';

/**
 * Exception thrown when execution needs to be suspended for user input
 */
export class SuspendState extends Error {
  constructor(private _state: InputState) {
    super('Execution suspended waiting for user input');
    // Fix for error subclassing in TypeScript
    Object.setPrototypeOf(this, SuspendState.prototype);
  }

  /**
   * Gets the input state that caused the suspension
   */
  get state(): InputState {
    return this._state;
  }
}
