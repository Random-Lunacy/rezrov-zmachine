/**
 * Represents a state requiring suspension of execution, such as waiting for user input
 */
export type InputState = {
  /**
   * If true, this is for a single keypress (read_char instruction)
   * If false, this is for a line of text input (read instruction)
   */
  keyPress: boolean;

  /**
   * Variable number where the result will be stored
   */
  resultVar: number;

  /**
   * For read operations (keyPress=false):
   * Address of the text buffer where input will be stored
   */
  textBuffer?: number;

  /**
   * For read operations (keyPress=false):
   * Address of the parse buffer where tokenized input will be stored
   */
  parseBuffer?: number;

  /**
   * For timed input operations:
   * Time limit for input in tenths of a second, or 0 for no limit
   */
  time?: number;

  /**
   * For timed input operations:
   * Routine to call if the time limit expires
   */
  routine?: number;
};

/**
 * Exception that is thrown when the interpreter needs to suspend execution
 * to wait for user input. The execution should be resumed after input is received.
 */
export class SuspendState extends Error {
  private readonly _state: InputState;

  /**
   * Create a new suspend state for user input
   * @param state Input state details
   */
  constructor(state: InputState) {
    super("Execution suspended waiting for user input");
    this._state = state;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, SuspendState.prototype);
  }

  /**
   * Get the input state details
   */
  get state(): InputState {
    return this._state;
  }
}
