import { InputState } from './InputState';

/**
 * Exception that is thrown when the interpreter needs to suspend execution
 * to wait for user input. The execution should be resumed after input is received.
 */
export class SuspendState extends Error {
  /**
   * Create a new suspend state for user input
   * @param state Input state details
   */
  constructor(state: InputState) {
    super('Execution suspended waiting for user input');
    this._state = state;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, SuspendState.prototype);
  }

  private readonly _state: InputState;

  /**
   * Get the input state details
   */
  get state(): InputState {
    return this._state;
  }
}
