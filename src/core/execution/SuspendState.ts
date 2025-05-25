import { InputMode, InputState } from '../../ui/input/InputInterface';

/**
 * Exception thrown when execution needs to be suspended for user input
 */
export class SuspendState extends Error {
  private readonly _state: {
    keyPress: boolean;
    resultVar: number;
    textBuffer?: number;
    parseBuffer?: number;
    time?: number;
    routine?: number;
  };

  constructor(state: {
    keyPress: boolean;
    resultVar: number;
    textBuffer?: number;
    parseBuffer?: number;
    time?: number;
    routine?: number;
  }) {
    super('Execution suspended waiting for user input');
    Object.setPrototypeOf(this, SuspendState.prototype);
    this._state = { ...state };
  }

  get state(): {
    keyPress: boolean;
    resultVar: number;
    textBuffer?: number;
    parseBuffer?: number;
    time?: number;
    routine?: number;
  } {
    return { ...this._state };
  }

  toInputState(): InputState {
    return {
      mode: this._state.keyPress
        ? this._state.time
          ? InputMode.TIMED_CHAR
          : InputMode.CHAR
        : this._state.time
          ? InputMode.TIMED_TEXT
          : InputMode.TEXT,
      resultVar: this._state.resultVar,
      textBuffer: this._state.textBuffer,
      parseBuffer: this._state.parseBuffer,
      time: this._state.time,
      routine: this._state.routine,
    };
  }
}
