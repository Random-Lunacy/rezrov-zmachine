export type InputState = {
  // will be false for a "read" instruction, true for a "read_char" instruction
  keyPress: boolean;
  resultVar: number;

  // will only be filled in for keyPress === false
  textBuffer?: number;
  parseBuffer?: number;
  time?: unknown;
  routine?: unknown;
};

export class SuspendState {
  private _state: InputState;
  
  constructor(state: InputState) {
    this._state = state;
  }
  
  get state() {
    return this._state;
  }
}
