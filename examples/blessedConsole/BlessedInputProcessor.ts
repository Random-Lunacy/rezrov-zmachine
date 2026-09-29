/* eslint-disable @typescript-eslint/no-explicit-any */
import * as blessed from 'blessed';
import { BaseInputProcessor, InputState, Logger, MouseClickCode, ZMachine, type MouseClick } from 'rezrov-zmachine';
import { BlessedScreen } from './BlessedScreen.js';

/** Clicks held while the game is busy; more than this is a burst the player didn't mean. */
const MAX_PENDING_CLICKS = 4;
/** A second press on the same cell within this many ms is a double-click (blessed doesn't count). */
const DOUBLE_CLICK_MS = 400;

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

  // Mouse support (Beyond Zork's map, Zork Zero's compass): see handleMouse.
  // Set once the game first asks for input; clicks before then have nowhere to go.
  private machine: ZMachine | null = null;
  private charKeyHandler: ((ch: string, key: any) => void) | null = null;
  // Clicks that arrived while the game was busy, delivered when it next waits for input
  private pendingClicks: MouseClick[] = [];
  private lastClick: { x: number; y: number; time: number } | null = null;
  // Typed text left on screen by a click that ended line input, taken back if the game asks again
  // with the same text preloaded (Zork Zero does, for a click that misses the compass)
  private clickEcho: { text: string; content: string } | null = null;

  private readonly handleMouse = (data: { x: number; y: number; action: string; button?: string }): void => {
    if (data.action !== 'mousedown' || data.button !== 'left') return;
    const machine = this.machine;
    if (!machine) return;

    // blessed doesn't count clicks: a second press on the same cell soon after is a double-click
    const now = Date.now();
    const last = this.lastClick;
    const isDouble = last !== null && last.x === data.x && last.y === data.y && now - last.time <= DOUBLE_CLICK_MS;
    this.lastClick = isDouble ? null : { x: data.x, y: data.y, time: now };

    // blessed reports 0-based screen cells; the game wants 1-based ones, in characters
    const click: MouseClick = { x: data.x + 1, y: data.y + 1, isDouble };
    if (this.isWaitingForClick()) {
      this.onMouseClick(machine, click, this.isWaitingForInput ? this.currentInput : '');
    } else if (this.pendingClicks.length < MAX_PENDING_CLICKS) {
      this.pendingClicks.push(click);
    }
  };

  constructor(blessedScreen: BlessedScreen, options?: { logger?: Logger }) {
    super();
    this.logger = options?.logger || new Logger('BlessedInputProcessor');
    this.blessedScreen = blessedScreen;
    this.screen = blessedScreen.getBlessedScreen();
    this.mainWindow = blessedScreen.getMainWindow();
    this.screen.program.on('mouse', this.handleMouse);
  }

  protected doStartTextInput(machine: ZMachine, state: InputState): void {
    this.logger.debug('Starting text input');
    this.machine = machine;

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
    // Z-spec §15.2: pre-loaded text is part of the input, for the player to edit or append to
    const preloaded = state.preloadedText ?? '';
    this.currentInput = preloaded;

    // Get current cursor position from BlessedScreen's content buffer
    const content = this.blessedScreen.getMainWindowContent();
    const lines = content.split('\n');
    this.inputStartPosition = {
      line: lines.length - 1,
      column: lines[lines.length - 1]?.length || 0,
    };

    // The preloaded text may be what a click just left on screen (see endTextInputForClick):
    // edit it in place rather than print it twice
    const echo = this.clickEcho;
    this.clickEcho = null;
    if (echo && preloaded === echo.text && content === echo.content) {
      this.inputStartPosition.column = Math.max(0, this.inputStartPosition.column - preloaded.length);
    }

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

    this.updateInputDisplay();
    this.deliverPendingClicks(machine);
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
    this.machine = machine;

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

      this.removeCharKeyHandler();

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

    this.charKeyHandler = handleKey;
    this.screen.on('keypress', handleKey);
    this.deliverPendingClicks(machine);
  }

  /** Stop listening for the key that ends character input. */
  private removeCharKeyHandler(): void {
    if (this.charKeyHandler) {
      this.screen.removeListener('keypress', this.charKeyHandler);
      this.charKeyHandler = null;
    }
  }

  /** Whether a click now would reach the game: line input (not mid-timeout) or char input. */
  private isWaitingForClick(): boolean {
    return (this.isWaitingForInput && !this.isExecutingTimeoutRoutine) || this.charKeyHandler !== null;
  }

  /**
   * Deliver clicks queued while the game was busy, now that it is waiting for input again.
   * Stops at the first one the game accepts; the rest wait for the input after that.
   */
  private deliverPendingClicks(machine: ZMachine): void {
    while (this.pendingClicks.length > 0 && this.isWaitingForClick()) {
      const click = this.pendingClicks.shift()!;
      if (this.onMouseClick(machine, click, this.isWaitingForInput ? this.currentInput : '')) return;
    }
  }

  /** A click can end char input (as ZSCII 254/253) without going through its key handler. */
  onKeyPress(machine: ZMachine, key: string): void {
    this.removeCharKeyHandler();
    super.onKeyPress(machine, key);
  }

  /** A click can end line input too; it doesn't go through finishInput either. */
  onInputComplete(machine: ZMachine, input: string, termChar: number = 13): void {
    const isClick = termChar === MouseClickCode.SingleClick || termChar === MouseClickCode.DoubleClick;
    if (isClick && this.isWaitingForInput) {
      this.endTextInputForClick(input);
    }
    super.onInputComplete(machine, input, termChar);
  }

  /**
   * A click that ends line input leaves what the player typed on screen, without a newline:
   * the game may carry on from there (Zork Zero prints the direction clicked on after it).
   */
  private endTextInputForClick(input: string): void {
    this.isWaitingForInput = false;
    this.stopCursorBlink();
    if (this.keyHandler) {
      this.screen.removeListener('keypress', this.keyHandler);
      this.keyHandler = null;
    }

    const lines = this.blessedScreen.getMainWindowContent().split('\n');
    const inputLine = this.inputStartPosition.line;
    lines[inputLine] = (lines[inputLine] || '').substring(0, this.inputStartPosition.column) + input;
    const content = lines.join('\n');
    this.blessedScreen.setMainWindowContent(content);
    this.clickEcho = input ? { text: input, content } : null;
    this.screen.render();
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

      // Settle exactly once, whichever way the box is dismissed. Without the
      // cancel path an Escape leaves this Promise pending forever and the
      // interpreter hangs mid-save with no way back.
      let settled = false;
      const finish = (value: string): void => {
        if (settled) return;
        settled = true;
        this.screen.remove(inputBox);
        this.screen.render();
        resolve(value);
      };

      inputBox.on('submit', (value: string) => finish(value || ''));
      inputBox.on('cancel', () => finish(''));
      inputBox.key(['escape'], () => finish(''));

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

    // Stop listening for the mouse
    this.removeCharKeyHandler();
    this.screen.program.removeListener('mouse', this.handleMouse);
    this.pendingClicks = [];
    this.machine = null;
  }
}
