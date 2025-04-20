import { ZMachine } from '../../interpreter/ZMachine';
import { HeaderLocation } from '../../utils/constants';

/**
 * Input Interface for Z-Machine
 * This interface defines the methods and properties required for handling user input in a Z-Machine interpreter.
 * It includes methods for starting text and character input, handling timed input, and processing terminating characters.
 * The interface also provides event handlers for input completion, key presses, and input timeouts.
 */

/**
 * Input modes for the Z-Machine
 */
export enum InputMode {
  TEXT = 1, // Line input
  CHAR = 2, // Character input
  TIMED_TEXT = 3, // Timed line input
  TIMED_CHAR = 4, // Timed character input
  UNICODE_TEXT = 5, // Unicode line input (V5+)
  UNICODE_CHAR = 6, // Unicode character input (V5+)
}

/**
 * InputState interface for managing input state
 * This interface defines the properties required to manage the state of user input in the Z-Machine interpreter.
 */
export interface InputState {
  mode: InputMode; // Input mode (e.g., TEXT, CHAR, etc.)
  resultVar: number; // Variable to store the result
  textBuffer?: number; // For text input
  parseBuffer?: number; // For text input
  time?: number; // For timed input
  routine?: number; // For timed input
  currentInput?: string; // Current input buffer
  terminating?: number; // Terminating character
}

/**
 * InputProcessor interface for handling input
 * This interface defines the methods required for processing user input in the Z-Machine interpreter.
 * It includes methods for starting text and character input, canceling input, and handling timed input.
 */
export interface InputProcessor {
  // Core methods that must be implemented
  startTextInput(machine: ZMachine, state: InputState): void;
  startCharInput(machine: ZMachine, state: InputState): void;
  cancelInput(machine: ZMachine): void;

  // Optional methods that can be overridden for advanced features
  handleTimedInput?(machine: ZMachine, state: InputState): void;
  processTerminatingCharacters?(input: string, terminators: number[]): number;
  promptForFilename(machine: ZMachine, operation: string): Promise<string>;

  // Event handlers
  onInputComplete(machine: ZMachine, input: string, termChar?: number): void;
  onKeyPress(machine: ZMachine, key: string): void;
  onInputTimeout(machine: ZMachine, state: InputState): void;
}

/**
 * BaseInputProcessor class for handling input
 * This class provides a base implementation of the InputProcessor interface.
 * Platform-specific implementations must extend this class and provide concrete implementations for the abstract methods.
 */
export abstract class BaseInputProcessor implements InputProcessor {
  protected terminatingChars: number[] = [13]; // Default to just Enter key
  protected timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  // Abstract methods that must be implemented by platform-specific subclasses
  abstract startTextInput(machine: ZMachine, state: InputState): void;
  abstract startCharInput(machine: ZMachine, state: InputState): void;
  abstract promptForFilename(machine: ZMachine, operation: string): Promise<string>;

  /**
   * Cancel any pending input
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  cancelInput(machine: ZMachine): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  /**
   * Handle timed input
   * This method is called when timed input is requested.
   * It sets a timeout to trigger the input routine after the specified time.
   */
  handleTimedInput(machine: ZMachine, state: InputState): void {
    if (state.time && state.time > 0 && state.routine) {
      this.timeoutHandle = setTimeout(() => {
        this.onInputTimeout(machine, state);
      }, state.time * 100); // Time is in 1/10 seconds per spec
    }
  }

  /**
   * Process terminating characters
   * This method is called to determine the terminating character for the input.
   * It can be overridden by subclasses to provide custom behavior.
   */
  processTerminatingCharacters(input: string, terminators: number[]): number {
    // Default processing logic
    if (input.length === 0) return 13; // Default to Enter

    const lastChar = input.charCodeAt(input.length - 1);
    if (terminators.includes(lastChar)) {
      return lastChar;
    }
    return 13; // Default to Enter
  }

  /**
   * Process input completion
   * This method is called when the input is completed.
   * It processes the input based on the current input mode and stores the result in the appropriate variable.
   * It also handles the terminating character if specified.
   */
  onInputComplete(machine: ZMachine, input: string, termChar: number = 13): void {
    const state = machine.getInputState();
    if (!state) return;

    if (state.mode === InputMode.TEXT || state.mode === InputMode.TIMED_TEXT) {
      this.processTextInput(machine, input, termChar);
    } else {
      this.processCharInput(machine, input.charAt(0) || '\0');
    }

    this.cancelInput(machine);
    machine.executor.resume();
  }

  /**
   * Handle key press events
   * This method is called when a key is pressed.
   * It processes the key based on the current input mode and stores the result in the appropriate variable.
   */
  onKeyPress(machine: ZMachine, key: string): void {
    const state = machine.getInputState();
    if (!state) return;

    const keyCode = key.length > 0 ? key.charCodeAt(0) : 0;
    machine.state.storeVariable(state.resultVar, keyCode);

    this.cancelInput(machine);
    machine.executor.resume();
  }

  /**
   * Handle input timeout events
   * This method is called when the input times out.
   * It processes the timeout based on the current input mode and calls the specified routine if provided.
   */
  onInputTimeout(machine: ZMachine, state: InputState): void {
    if (state.routine) {
      const routineAddr = machine.memory.unpackRoutineAddress(state.routine);
      machine.state.callRoutine(routineAddr, null);
      machine.executor.resume();
    }
  }

  /**
   * Process text input
   * This method is called to process text input.
   * It stores the input in the text buffer and tokenizes it if a parse buffer is provided.
   * It also handles the terminating character if running V5+.
   */
  protected processTextInput(machine: ZMachine, input: string, termChar: number): void {
    const state = machine.getInputState();
    if (!state || !state.textBuffer) return;

    // Store the text in the text buffer
    this.storeTextInput(machine, input, state.textBuffer);

    // Tokenize the input if parse buffer is provided
    if (state.parseBuffer) {
      machine.state.tokenizeLine(state.textBuffer, state.parseBuffer);
    }

    // Store terminating character if running V5+
    if (machine.state.version >= 5 && state.resultVar !== undefined) {
      machine.state.storeVariable(state.resultVar, termChar);
    }
  }

  /**
   * Process character input
   * This method is called to process character input.
   * It stores the input in the result variable.
   */
  protected processCharInput(machine: ZMachine, key: string): void {
    const state = machine.getInputState();
    if (!state) return;

    const keyCode = key.length > 0 ? key.charCodeAt(0) : 0;
    machine.state.storeVariable(state.resultVar, keyCode);
  }

  /**
   * Store text input in the text buffer
   * This method is called to store the text input in the specified text buffer.
   * It handles different storage formats based on the Z-Machine version.
   */
  protected storeTextInput(machine: ZMachine, input: string, textBuffer: number): void {
    const memory = machine.state.memory;
    const version = machine.state.version;

    // Get maximum input length
    let maxInput = memory.getByte(textBuffer);
    if (version <= 4) maxInput--;

    // Truncate input if needed
    input = input.slice(0, maxInput);

    // Store input according to version requirements
    if (version <= 4) {
      // V1-4: Store as null-terminated string
      for (let i = 0; i < input.length; i++) {
        memory.setByte(textBuffer + 1 + i, input.charCodeAt(i));
      }
      memory.setByte(textBuffer + 1 + input.length, 0);
    } else {
      // V5+: Store with length prefix
      memory.setByte(textBuffer + 1, input.length);
      for (let i = 0; i < input.length; i++) {
        memory.setByte(textBuffer + 2 + i, input.charCodeAt(i));
      }
    }
  }

  /**
   * Load terminating characters from the Z-Machine header
   * This method loads the terminating characters from the Z-Machine header.
   * It sets the terminating characters based on the version of the Z-Machine.
   */
  protected loadTerminatingCharacters(machine: ZMachine): void {
    const version = machine.state.version;

    // Default terminating characters (always includes Enter)
    this.terminatingChars = [13];

    // V5+ can specify custom terminating characters
    if (version >= 5) {
      const headerTermChars = machine.memory.getWord(HeaderLocation.TerminatingChars);
      if (headerTermChars !== 0) {
        const customTermChars: number[] = [];
        let addr = headerTermChars;
        let char = machine.memory.getByte(addr);

        while (char !== 0) {
          customTermChars.push(char);
          addr++;
          char = machine.memory.getByte(addr);
        }

        if (customTermChars.length > 0) {
          this.terminatingChars = customTermChars;
        }
      }
    }
  }
}
