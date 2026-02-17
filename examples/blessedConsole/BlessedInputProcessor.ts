/* eslint-disable @typescript-eslint/no-explicit-any */
import * as blessed from 'blessed';
import { BaseInputProcessor, InputState, Logger, ZMachine } from '../../dist/index.js';
import { BlessedScreen } from './BlessedScreen.js';

export class BlessedInputProcessor extends BaseInputProcessor {
  private logger: Logger;
  private screen: blessed.Widgets.Screen;
  private blessedScreen: BlessedScreen;
  private mainWindow: any;
  private isWaitingForInput: boolean = false;
  private currentInput: string = '';
  private inputStartPosition: { line: number; column: number } = { line: 0, column: 0 };
  private keyHandler: ((ch: string, key: any) => void) | null = null;
  private cursorInterval: NodeJS.Timeout | null = null;
  private cursorVisible: boolean = true;

  // Flag to pause input handling during timeout routine execution
  private isExecutingTimeoutRoutine: boolean = false;

  // Mouse support for Beyond Zork
  private mouseClickHandler: ((data: { x: number; y: number; button: string }) => void) | null = null;
  private pendingMouseClick: { x: number; y: number; button: number } | null = null;

  constructor(blessedScreen: BlessedScreen, options?: { logger?: Logger }) {
    super();
    this.logger = options?.logger || new Logger('BlessedInputProcessor');
    this.blessedScreen = blessedScreen;
    this.screen = blessedScreen.getBlessedScreen();
    this.mainWindow = blessedScreen.getMainWindow();
  }

  protected doStartTextInput(machine: ZMachine, _state: InputState): void {
    this.logger.debug('Starting text input');

    // IMPORTANT: Clean up any existing input state before starting new input
    // This handles the case where a previous input was terminated by timeout
    // and the base class onInputComplete was called without going through finishInput
    if (this.keyHandler) {
      this.screen.removeListener('keypress', this.keyHandler);
      this.keyHandler = null;
    }
    this.stopCursorBlink();
    this.isExecutingTimeoutRoutine = false;

    this.loadTerminatingCharacters(machine);

    // NOTE: Do NOT call handleTimedInput here - the base class startTextInput() already does this.
    // Calling it twice would create duplicate timeouts, causing repeated timeout callbacks.

    this.isWaitingForInput = true;
    this.currentInput = '';

    // Disable mouse tracking during text input to prevent escape sequence leakage
    this.screen.program.disableMouse();

    // Get current cursor position from BlessedScreen's content buffer
    const content = this.blessedScreen.getMainWindowContent();
    const lines = content.split('\n');
    this.inputStartPosition = {
      line: lines.length - 1,
      column: lines[lines.length - 1]?.length || 0,
    };

    // Set up key handler for inline input
    this.keyHandler = (ch: string, key: blessed.Widgets.Events.IKeyEventArg) => {
      if (!this.isWaitingForInput) return;

      // Ignore input while timeout routine is executing to prevent race conditions
      if (this.isExecutingTimeoutRoutine) return;

      // Ignore mouse events - they can generate spurious characters
      // Mouse events in blessed have key.name === 'mouse' or include escape sequences

      if (key?.name === 'mouse' || (key as any)?.mouse) {
        return;
      }

      // Handle backspace
      if (key?.name === 'backspace' || key?.name === 'delete') {
        if (this.currentInput.length > 0) {
          this.currentInput = this.currentInput.slice(0, -1);
          this.updateInputDisplay();
        }
        return;
      }

      // Handle enter/return
      if (key?.name === 'enter' || key?.name === 'return') {
        this.finishInput(machine);
        return;
      }

      // Handle escape
      if (key?.name === 'escape') {
        this.currentInput = '';
        this.finishInput(machine);
        return;
      }

      // Handle regular characters - but filter out potential escape sequence fragments
      // Mouse escape sequences can leak characters like 'M', '[', or high-bit chars
      if (ch && ch.length === 1 && ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) < 127) {
        // Additional filter: ignore if the character looks like part of an escape sequence
        // or if there's no proper key name (which can indicate raw escape data)
        if (key?.sequence && key.sequence.includes('\x1b')) {
          return; // Part of an escape sequence
        }
        this.currentInput += ch;
        this.updateInputDisplay();
      }
    };

    this.screen.on('keypress', this.keyHandler);

    // Start cursor blinking
    this.startCursorBlink();

    this.screen.render();
  }

  private startCursorBlink(): void {
    this.cursorVisible = true;
    this.cursorInterval = setInterval(() => {
      this.cursorVisible = !this.cursorVisible;
      this.updateInputDisplay();
    }, 500); // Blink every 500ms
  }

  private stopCursorBlink(): void {
    if (this.cursorInterval) {
      clearInterval(this.cursorInterval);
      this.cursorInterval = null;
    }
    this.cursorVisible = false;
  }

  private updateInputDisplay(): void {
    // Get current content from the BlessedScreen's content buffer
    const content = this.blessedScreen.getMainWindowContent();
    const lines = content.split('\n');

    // Find the line where input should be displayed
    const inputLine = this.inputStartPosition.line;

    // Reconstruct the line with the current input
    const baseLine = lines[inputLine] || '';
    const baseContent = baseLine.substring(0, this.inputStartPosition.column);
    const newLine = baseContent + this.currentInput + (this.cursorVisible && this.isWaitingForInput ? '█' : '');

    // Update the line
    lines[inputLine] = newLine;

    // Update the main window content (only the display, not the buffer - we'll sync on finish)
    this.mainWindow.setContent(lines.join('\n'));
    this.mainWindow.setScrollPerc(100);
    this.screen.render();
  }

  private finishInput(machine: ZMachine): void {
    this.isWaitingForInput = false;
    this.isExecutingTimeoutRoutine = false;

    // Stop cursor blinking
    this.stopCursorBlink();

    // Re-enable mouse tracking
    this.screen.program.enableMouse();

    // Remove the key handler
    if (this.keyHandler) {
      this.screen.removeListener('keypress', this.keyHandler);
      this.keyHandler = null;
    }

    // Get the current content from BlessedScreen's buffer
    let content = this.blessedScreen.getMainWindowContent();
    const lines = content.split('\n');
    const inputLine = this.inputStartPosition.line;

    // Echo the input to the display (without cursor)
    if (this.currentInput.length > 0) {
      const baseLine = lines[inputLine] || '';
      const baseContent = baseLine.substring(0, this.inputStartPosition.column);
      const newLine = baseContent + this.currentInput;
      lines[inputLine] = newLine;
      content = lines.join('\n');
    }

    // Add a newline after input and sync to BlessedScreen's buffer
    content = content + '\n';
    this.blessedScreen.setMainWindowContent(content);
    this.mainWindow.setScrollPerc(100);

    // Process the input
    const termChar = this.processTerminatingCharacters(this.currentInput, this.terminatingChars);
    this.onInputComplete(machine, this.currentInput, termChar);

    this.screen.render();
  }

  protected doStartCharInput(machine: ZMachine, state: InputState): void {
    this.logger.debug('Starting char input');

    // NOTE: Do NOT call handleTimedInput here - the base class startCharInput() already does this.
    // Calling it twice would create duplicate timeouts.

    // Handle special keys that should be ignored
    const handleKey = (ch: string, key: blessed.Widgets.Events.IKeyEventArg) => {
      // Ignore mouse events - they can generate spurious characters

      if (key?.name === 'mouse' || (key as any)?.mouse) {
        return; // Don't remove listener, wait for real key
      }

      // Ignore escape sequences that leak through
      if (key?.sequence && key.sequence.includes('\x1b') && !key.name) {
        return; // Part of an escape sequence, wait for real key
      }

      this.screen.removeListener('keypress', handleKey);
      this.removeMouseHandler();

      // Enter/Return → ZSCII 13
      if (key?.name === 'enter' || key?.name === 'return') {
        this.onKeyPress(machine, String.fromCharCode(13));
        return;
      }

      // Escape → ZSCII 27
      if (key?.name === 'escape') {
        this.onKeyPress(machine, String.fromCharCode(27));
        return;
      }

      // Arrow keys → ZSCII 129-132
      const arrowMap: Record<string, number> = { up: 129, down: 130, left: 131, right: 132 };
      if (key?.name && arrowMap[key.name] !== undefined) {
        this.onKeyPress(machine, String.fromCharCode(arrowMap[key.name]));
        return;
      }

      // Function keys F1-F12 → ZSCII 133-144
      if (key?.name && /^f(\d+)$/.test(key.name)) {
        const fNum = parseInt(key.name.substring(1), 10);
        if (fNum >= 1 && fNum <= 12) {
          this.onKeyPress(machine, String.fromCharCode(132 + fNum));
          return;
        }
      }

      // Delete → ZSCII 8
      if (key?.name === 'delete' || key?.name === 'backspace') {
        this.onKeyPress(machine, String.fromCharCode(8));
        return;
      }

      if (key && key.name === 'space') {
        this.onKeyPress(machine, ' ');
        return;
      }

      // Regular character - but filter out high-bit chars from mouse events
      if (ch && ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) < 127) {
        this.onKeyPress(machine, ch);
      } else {
        // Non-printable, high-bit, or unrecognized key - restart and wait for valid input
        this.doStartCharInput(machine, state);
      }
    };

    // Set up mouse click handler for Beyond Zork
    // Mouse clicks during read_char can be used for map navigation
    this.mouseClickHandler = (_data: { x: number; y: number; button: string }) => {
      // Store the click for potential use by the game
      const button = _data.button === 'left' ? 1 : _data.button === 'right' ? 2 : _data.button === 'middle' ? 3 : 0;
      this.pendingMouseClick = {
        x: _data.x + 1,
        y: _data.y + 1,
        button,
      };
      this.logger.debug(`Mouse click during char input: ${JSON.stringify(this.pendingMouseClick)}`);

      // For Beyond Zork, a mouse click during read_char should generate
      // a special character code (254 for single click, 253 for double click)
      // Remove handlers and signal the click
      this.screen.removeListener('keypress', handleKey);
      this.removeMouseHandler();

      // Send mouse click as special character (254 = single click)
      this.onKeyPress(machine, String.fromCharCode(254));
    };

    // Listen for clicks on the main window
    const mainWindow = this.mainWindow;
    if (mainWindow) {
      mainWindow.on('click', this.mouseClickHandler);
    }

    this.screen.on('keypress', handleKey);
  }

  /**
   * Remove the current mouse click handler
   */
  private removeMouseHandler(): void {
    if (this.mouseClickHandler && this.mainWindow) {
      this.mainWindow.removeListener('click', this.mouseClickHandler);
      this.mouseClickHandler = null;
    }
  }

  /**
   * Get the pending mouse click (if any) and clear it
   */
  getPendingMouseClick(): { x: number; y: number; button: number } | null {
    const click = this.pendingMouseClick;
    this.pendingMouseClick = null;
    return click;
  }

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

  async promptForFilename(machine: ZMachine, operation: string): Promise<string> {
    return new Promise((resolve) => {
      // Create a temporary input box for filename input
      const inputBox = blessed.textbox({
        top: 'center',
        left: 'center',
        width: '50%',
        height: 3,
        inputOnFocus: true,
        keys: true,
        mouse: true,
        border: {
          type: 'line',
        },
        label: ` ${operation} - Enter filename `,
        style: {
          fg: 'white',
          bg: 'black',
          border: {
            fg: '#f0f0f0',
            bg: 'black',
          },
        },
      });

      this.screen.append(inputBox);
      inputBox.focus();

      inputBox.on('submit', (value: string) => {
        this.screen.remove(inputBox);
        this.screen.render();
        resolve(value || '');
      });

      this.screen.render();
    });
  }

  /**
   * Override onInputTimeout to pass current input to the base class.
   * The base class will execute the timeout routine and either:
   * - Restart the timer (routine returned 0) - UI stays active
   * - Complete input (routine returned non-zero) - finishInput handles cleanup
   */
  onInputTimeout(machine: ZMachine, state: InputState): void {
    // Don't process timeout if we're no longer waiting for input
    // This can happen due to race conditions with user pressing enter
    if (!this.isWaitingForInput) {
      this.logger.debug('onInputTimeout: not waiting for input, ignoring stale timeout');
      return;
    }

    // Pass the current input buffer to the state so base class can use it
    state.currentInput = this.currentInput;

    // Pause input handling while the timeout routine executes
    // This prevents race conditions where keypresses during routine execution
    // could be processed multiple times or cause display issues
    this.isExecutingTimeoutRoutine = true;

    // Stop cursor blinking during routine execution to prevent screen.render() calls
    this.stopCursorBlink();

    // Call base implementation which will execute the timeout routine
    // and either restart timer or call onInputComplete
    super.onInputTimeout(machine, state);
  }

  /**
   * Called by base class after timeout routine completes and timer is restarted.
   * We override handleTimedInput to resume input handling.
   */
  handleTimedInput(machine: ZMachine, state: InputState): void {
    // Don't restart if we're no longer waiting for input
    // This can happen if input completed while the timeout routine was executing
    // BUT: On initial setup, isWaitingForInput may not be set yet, so only check
    // this guard if we're coming from a timeout routine (isExecutingTimeoutRoutine was true)
    if (this.isExecutingTimeoutRoutine && !this.isWaitingForInput) {
      this.logger.debug('handleTimedInput: not waiting for input, ignoring');
      this.isExecutingTimeoutRoutine = false;
      return;
    }

    // Resume input handling now that the routine has finished
    this.isExecutingTimeoutRoutine = false;

    // Restart cursor blinking
    this.startCursorBlink();

    // Call base implementation to set up the timer
    super.handleTimedInput(machine, state);
  }

  cleanup(): void {
    // Stop cursor blinking if active
    this.stopCursorBlink();

    // Remove key handler if active
    if (this.keyHandler) {
      this.screen.removeListener('keypress', this.keyHandler);
      this.keyHandler = null;
    }

    // Remove mouse handler if active
    this.removeMouseHandler();
  }
}
