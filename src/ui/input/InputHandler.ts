import { ZMachine } from '../../interpreter/ZMachine';
import { Logger } from '../../utils/log';

/**
 * Input state for the Z-machine
 */
export type InputState = {
  keyPress: boolean;
  resultVar: number;
  textBuffer?: number;
  parseBuffer?: number;
  time?: number;
  routine?: number;
};

/**
 * InputHandler class to handle user input
 */
export class InputHandler {
  private machine: ZMachine;
  private logger: Logger;

  /**
   * Create a new InputHandler
   * @param machine The ZMachine instance
   * @param options Optional options
   */
  constructor(machine: ZMachine, options?: { logger?: Logger }) {
    this.machine = machine;
    this.logger = options?.logger || new Logger('InputHandler');
  }

  /**
   * Process a completed user input
   * @param input The input text from the user
   */
  processInput(input: string, terminatingChar: number = 13): void {
    const state = this.machine.getInputState();

    if (!state) {
      this.logger.error('No pending input state');
      return;
    }

    if (state.keyPress) {
      this.logger.error('processInput called for keypress');
      return;
    }

    // Convert to lowercase as per Z-machine spec
    input = input.toLowerCase();

    const { textBuffer, parseBuffer, resultVar } = state;
    if (textBuffer === undefined) {
      throw new Error('textBuffer undefined');
    }
    if (parseBuffer === undefined) {
      throw new Error('parseBuffer undefined');
    }

    const gameState = this.machine.state;
    const version = gameState.version;

    // Store text in appropriate format based on version
    this.storeTextInput(input, textBuffer, version);

    // Tokenize the input
    this.machine.state.tokenizeLine(textBuffer, parseBuffer, 0, false);

    // For V5+, we need to store the terminating character
    if (version >= 5 && resultVar !== undefined) {
      gameState.storeVariable(resultVar, terminatingChar);
    }
  }

  /**
   * Process a completed key press
   * @param key The key pressed by the user
   */
  processKeypress(key: string): void {
    const state = this.machine.getInputState();
    if (!state) {
      this.logger.error('No pending input state');
      return;
    }

    if (!state.keyPress) {
      this.logger.error('processKeypress called for text input');
      return;
    }

    // Store the key (as ZSCII)
    // For simplicity, just use the first character's code
    const keyCode = key.length > 0 ? key.charCodeAt(0) : 0;
    this.machine.state.storeVariable(state.resultVar, keyCode);
  }

  /**
   * Store text input in Z-machine memory
   */
  private storeTextInput(input: string, textBuffer: number, version: number): void {
    const memory = this.machine.state.memory;

    // Get max input length, handling differently based on version
    let maxInput = memory.getByte(textBuffer);

    // For V1-4, max length is stored as maxLength-1
    if (version <= 4) {
      maxInput--;
    }

    // Truncate input to max length
    input = input.slice(0, maxInput);

    // Store input in appropriate format based on version
    if (version <= 4) {
      // V1-4: Store text starting at byte 1, terminate with null
      for (let i = 0; i < input.length; i++) {
        const c = input.charCodeAt(i);
        memory.setByte(textBuffer + 1 + i, c);
      }
      memory.setByte(textBuffer + 1 + input.length, 0);
    } else {
      // V5+: Store length at byte 1, text starting at byte 2
      memory.setByte(textBuffer + 1, input.length);
      for (let i = 0; i < input.length; i++) {
        const c = input.charCodeAt(i);
        memory.setByte(textBuffer + 2 + i, c);
      }
    }
  }
}
