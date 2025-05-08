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

  startTextInput(machine: ZMachine, state: InputState): void {
    // Validate the text buffer
    if (state.textBuffer && !this.validateTextBuffer(machine, state.textBuffer)) {
      machine.logger.error('Text input cancelled due to invalid text buffer');
      this.onInputComplete(machine, '', 13); // Return empty input with Enter as terminator
      return;
    }

    // Validate the parse buffer if provided
    if (state.parseBuffer && !this.validateParseBuffer(machine, state.parseBuffer)) {
      machine.logger.error('Text input cancelled due to invalid parse buffer');
      this.onInputComplete(machine, '', 13); // Return empty input with Enter as terminator
      return;
    }

    // Load terminating characters
    this.loadTerminatingCharacters(machine);

    // Set up timed input if required
    if (state.time && state.time > 0 && state.routine) {
      this.handleTimedInput(machine, state);
    }

    // Concrete implementation provided by subclasses
    this.doStartTextInput(machine, state);
  }

  /**
   * Start character input with validation
   * @param machine The Z-Machine instance
   * @param state The input state
   */
  startCharInput(machine: ZMachine, state: InputState): void {
    // Load terminating characters
    this.loadTerminatingCharacters(machine);

    // Set up timed input if required
    if (state.time && state.time > 0 && state.routine) {
      this.handleTimedInput(machine, state);
    }

    // Concrete implementation provided by subclasses
    this.doStartCharInput(machine, state);
  }

  /**
   * Process text input with buffer validation
   * @param machine The Z-Machine instance
   * @param input The input string
   * @param termChar The terminating character
   */
  protected processTextInput(machine: ZMachine, input: string, termChar: number): void {
    const state = machine.getInputState();
    if (!state || !state.textBuffer) return;

    // Validate the text buffer before writing to it
    if (!this.validateTextBuffer(machine, state.textBuffer)) {
      machine.logger.error('Cannot store text input due to invalid text buffer');
      return;
    }

    // Store the text in the text buffer
    this.storeTextInput(machine, input, state.textBuffer);

    // Tokenize the input if parse buffer is provided
    if (state.parseBuffer) {
      // Validate the parse buffer before writing to it
      if (!this.validateParseBuffer(machine, state.parseBuffer)) {
        machine.logger.error('Cannot tokenize input due to invalid parse buffer');
      } else {
        machine.state.tokenizeLine(state.textBuffer, state.parseBuffer);
      }
    }

    // Store terminating character if running V5+
    if (machine.state.version >= 5 && state.resultVar !== undefined) {
      machine.state.storeVariable(state.resultVar, termChar);
    }
  }

  // Abstract methods that must be implemented by platform-specific subclasses
  protected abstract doStartTextInput(machine: ZMachine, state: InputState): void;
  protected abstract doStartCharInput(machine: ZMachine, state: InputState): void;
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
   * @param input The input string
   * @param terminators List of terminating characters
   * @returns The terminating character code or 13 (Enter) by default
   */
  processTerminatingCharacters(input: string, terminators: number[] = this.terminatingChars): number {
    // Default to Enter/Return
    if (input.length === 0) return 13;

    const lastChar = input.charCodeAt(input.length - 1);

    // Check if the last character is a terminator
    if (terminators.includes(lastChar)) {
      return lastChar;
    }

    // Check if we have any special keys in the input
    for (let i = 0; i < input.length; i++) {
      const charCode = input.charCodeAt(i);

      // Is this a function key code used as a terminator?
      if (
        terminators.includes(charCode) &&
        ((charCode >= 129 && charCode <= 154) || (charCode >= 252 && charCode <= 254))
      ) {
        return charCode;
      }
    }

    // Default to Enter/Return
    return 13;
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
   * Validates and loads terminating characters from the Z-Machine header
   * @param machine The Z-Machine instance
   * @returns Array of valid terminating characters
   */
  protected loadTerminatingCharacters(machine: ZMachine): void {
    const version = machine.state.version;

    // Default terminating characters (always includes Enter/Return)
    this.terminatingChars = [13];

    // Only V5+ can specify custom terminating characters
    if (version >= 5) {
      const headerTermCharsAddr = machine.memory.getWord(HeaderLocation.TerminatingChars);
      if (headerTermCharsAddr !== 0) {
        this.loadCustomTerminatingChars(machine, headerTermCharsAddr);
      }
    }

    machine.logger.debug(
      `Loaded ${this.terminatingChars.length} terminating characters: ${this.terminatingChars.join(', ')}`
    );
  }

  /**
   * Loads and validates custom terminating characters
   * @param machine The Z-Machine instance
   * @param tableAddr Address of the terminating characters table
   */
  private loadCustomTerminatingChars(machine: ZMachine, tableAddr: number): void {
    try {
      const customTermChars: number[] = [];
      let addr = tableAddr;
      let char = machine.memory.getByte(addr);

      // Read the table until we reach a zero byte or invalid memory
      while (char !== 0) {
        // Add to our list if it's a valid terminating character
        if (this.isValidTerminatingCharacter(char)) {
          customTermChars.push(char);
        } else {
          machine.logger.warn(`Invalid terminating character ${char} at address 0x${addr.toString(16)}`);
        }

        addr++;
        char = machine.memory.getByte(addr);
      }

      // Special handling for 255 (any function key)
      if (customTermChars.includes(255)) {
        machine.logger.debug('Special terminator 255 found: any function key will terminate input');

        // Replace 255 with all function key codes
        customTermChars.splice(customTermChars.indexOf(255), 1);

        // Add all function key codes (129-154, 252-254)
        for (let i = 129; i <= 154; i++) {
          if (!customTermChars.includes(i)) {
            customTermChars.push(i);
          }
        }

        for (let i = 252; i <= 254; i++) {
          if (!customTermChars.includes(i)) {
            customTermChars.push(i);
          }
        }
      }

      // Only update our terminators if we found valid ones
      if (customTermChars.length > 0) {
        // Always include Enter/Return as a terminator
        if (!customTermChars.includes(13)) {
          customTermChars.push(13);
        }

        this.terminatingChars = customTermChars;
      }
    } catch (e) {
      machine.logger.error(`Error reading terminating characters table: ${e}`);
      // Fall back to default terminators
      this.terminatingChars = [13];
    }
  }

  /**
   * Checks if a character code is a valid terminating character
   * According to the Z-Machine spec, only function key codes (129-154, 252-254)
   * and the special value 255 are permitted as terminating characters
   *
   * @param code The character code to check
   * @returns True if it's a valid terminating character
   */
  private isValidTerminatingCharacter(code: number): boolean {
    // Enter/Return is always valid
    if (code === 13) return true;

    // Function keys (129-154)
    if (code >= 129 && code <= 154) return true;

    // Additional function keys (252-254)
    if (code >= 252 && code <= 254) return true;

    // Special value: any function key
    if (code === 255) return true;

    // Any other code is invalid as a terminator
    return false;
  }

  /**
   * Validates a text buffer to ensure it meets the minimum size requirements
   * @param machine The Z-Machine instance
   * @param textBuffer Address of the text buffer
   * @returns True if the buffer is valid, false otherwise
   */
  protected validateTextBuffer(machine: ZMachine, textBuffer: number): boolean {
    // Ensure the text buffer is at least 3 bytes long
    try {
      // Check if we can access the first 3 bytes of the buffer
      machine.memory.getByte(textBuffer); // Max length byte
      machine.memory.getByte(textBuffer + 1); // First data byte
      machine.memory.getByte(textBuffer + 2); // Second data byte (or terminator)

      // Additional version-specific validation
      const version = machine.state.version;
      const maxLength = machine.memory.getByte(textBuffer);

      if (version <= 4) {
        // V1-4: Check if we can access the full buffer size (+1 for terminator)
        for (let i = 0; i <= maxLength; i++) {
          machine.memory.getByte(textBuffer + 1 + i);
        }
      } else {
        // V5+: Check if we can access the full buffer size (+1 for length byte)
        for (let i = 0; i < maxLength; i++) {
          machine.memory.getByte(textBuffer + 2 + i);
        }
      }

      return true;
    } catch (e) {
      machine.logger.error(`Invalid text buffer at 0x${textBuffer.toString(16)}: ${e}`);
      return false;
    }
  }

  /**
   * Validates a parse buffer to ensure it meets the minimum size requirements
   * @param machine The Z-Machine instance
   * @param parseBuffer Address of the parse buffer
   * @returns True if the buffer is valid, false otherwise
   */
  protected validateParseBuffer(machine: ZMachine, parseBuffer: number): boolean {
    // Ensure the parse buffer is at least 6 bytes long
    try {
      // Check if we can access the first 6 bytes of the buffer
      machine.memory.getByte(parseBuffer); // Max tokens byte
      machine.memory.getByte(parseBuffer + 1); // Actual tokens byte
      machine.memory.getWord(parseBuffer + 2); // First token address
      machine.memory.getByte(parseBuffer + 4); // First token length
      machine.memory.getByte(parseBuffer + 5); // First token position

      // Additional validation to ensure we can access all potential entries
      const maxTokens = machine.memory.getByte(parseBuffer);
      if (maxTokens > 0) {
        // Ensure we can access the last potential entry
        const lastEntryStart = parseBuffer + 2 + (maxTokens - 1) * 4;
        machine.memory.getWord(lastEntryStart);
        machine.memory.getByte(lastEntryStart + 2);
        machine.memory.getByte(lastEntryStart + 3);
      }

      return true;
    } catch (e) {
      machine.logger.error(`Invalid parse buffer at 0x${parseBuffer.toString(16)}: ${e}`);
      return false;
    }
  }
}
