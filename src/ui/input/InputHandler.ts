import { ZMachine } from "../../interpreter/ZMachine";
import { Screen } from "../screen/interfaces";

export type InputState = {
  keyPress: boolean;
  resultVar: number;
  textBuffer?: number;
  parseBuffer?: number;
  time?: number;
  routine?: number;
};

export class InputHandler {
  private machine: ZMachine;
  private screen: Screen;

  constructor(machine: ZMachine, screen: Screen) {
    this.machine = machine;
    this.screen = screen;
  }

  /**
   * Process a completed user input
   * @param input The input text from the user
   */
  processInput(input: string): void {
    const state = this.machine.getInputState();
    if (!state) {
      this.machine.logger.error("No pending input state");
      return;
    }

    if (state.keyPress) {
      this.machine.logger.error("processInput called for keypress");
      return;
    }

    // Process the input and resume execution
    this.processTextInput(state, input);
  }

  /**
   * Process a completed key press
   * @param key The key pressed by the user
   */
  processKeypress(key: string): void {
    const state = this.machine.getInputState();
    if (!state) {
      this.machine.logger.error("No pending input state");
      return;
    }

    if (!state.keyPress) {
      this.machine.logger.error("processKeypress called for text input");
      return;
    }

    // Process the keypress and resume execution
    this.processKeyInput(state, key);
  }

  /**
   * Process text input and store in the Z-machine memory
   * @param state Input state
   * @param input Text input from user
   */
  private processTextInput(state: InputState, input: string): void {
    input = input.toLowerCase();

    const { textBuffer, parseBuffer, resultVar } = state;
    if (textBuffer === undefined) {
      throw new Error("textBuffer undefined");
    }
    if (parseBuffer === undefined) {
      throw new Error("parseBuffer undefined");
    }

    const gameState = this.machine.getGameState();
    const memory = gameState.memory;
    const version = gameState.version;

    let maxInput = memory.getByte(textBuffer);
    if (version <= 4) {
      // Need room for terminator
      maxInput--;
    }
    input = input.slice(0, maxInput);

    // Store the input text in memory
    for (let i = 0; i < input.length; i++) {
      const c = input.charCodeAt(i);
      memory.setByte(textBuffer + (version <= 4 ? 1 : 2) + i, c);
    }

    if (version <= 4) {
      // Store terminating null
      memory.setByte(textBuffer + 1 + input.length, 0);
    } else {
      // Store length of string
      memory.setByte(textBuffer + 1, input.length);
    }

    // Tokenize the input
    this.machine.tokenizeLine(textBuffer, parseBuffer, 0, false);

    if (version >= 5) {
      // Store terminating key (assume Enter key)
      gameState.storeVariable(resultVar, 0x0d);
    }

    // Resume execution
    this.machine.resumeExecution();
  }

  /**
   * Process key input and store in the Z-machine
   * @param state Input state
   * @param key Key pressed by user
   */
  private processKeyInput(state: InputState, key: string): void {
    const { resultVar } = state;

    // Store the key (as ZSCII)
    // For simplicity, just use the first character's code
    const keyCode = key.length > 0 ? key.charCodeAt(0) : 0;
    this.machine.getGameState().storeVariable(resultVar, keyCode);

    // Resume execution
    this.machine.resumeExecution();
  }
}
