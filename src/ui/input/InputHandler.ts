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

    // Convert to lowercase (Z-machine convention)
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

    // Process the text input
    this.storeTextInput(input, textBuffer, version);

    // Tokenize the input
    this.machine.tokenizeLine(textBuffer, parseBuffer, 0, false);

    // For V5+, store the terminating key (assume Enter key)
    if (version >= 5) {
      gameState.storeVariable(resultVar, 0x0d);
    }
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

    // Store the key (as ZSCII)
    // For simplicity, just use the first character's code
    const keyCode = key.length > 0 ? key.charCodeAt(0) : 0;
    this.machine.getGameState().storeVariable(state.resultVar, keyCode);
  }

  /**
   * Store text input in Z-machine memory
   */
  private storeTextInput(
    input: string,
    textBuffer: number,
    version: number
  ): void {
    const memory = this.machine.getGameState().memory;

    // Get the maximum input length
    let maxInput = memory.getByte(textBuffer);
    if (version <= 4) {
      // Need room for terminator
      maxInput--;
    }

    // Truncate if needed
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
  }
}
