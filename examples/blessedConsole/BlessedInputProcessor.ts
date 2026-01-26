/* eslint-disable @typescript-eslint/no-explicit-any */
import * as blessed from 'blessed';
import { BaseInputProcessor, InputState, Logger, ZMachine } from '../../dist/index.js';

export class BlessedInputProcessor extends BaseInputProcessor {
  private logger: Logger;
  private screen: blessed.Widgets.Screen;
  private mainWindow: any;
  private isWaitingForInput: boolean = false;
  private currentInput: string = '';
  private inputStartPosition: { line: number; column: number } = { line: 0, column: 0 };
  private keyHandler: ((ch: string, key: any) => void) | null = null;
  private cursorInterval: NodeJS.Timeout | null = null;
  private cursorVisible: boolean = true;

  // Mouse support for Beyond Zork
  private mouseClickHandler: ((data: { x: number; y: number; button: string }) => void) | null = null;
  private pendingMouseClick: { x: number; y: number; button: number } | null = null;

  constructor(screen: any, options?: { logger?: Logger }) {
    super();
    this.logger = options?.logger || new Logger('BlessedInputProcessor');
    this.screen = screen;
    // Get the main window from the screen - look for the box that's not at the top
    this.mainWindow = screen.children.find(
      (child: any) => child.type === 'box' && child.top !== 0 && child.scrollable === true
    );
  }

  protected doStartTextInput(machine: ZMachine, state: InputState): void {
    this.logger.debug('Starting text input');

    this.loadTerminatingCharacters(machine);

    if (state.time && state.time > 0 && state.routine) {
      this.handleTimedInput(machine, state);
    }

    this.isWaitingForInput = true;
    this.currentInput = '';

    // Get current cursor position from the main window
    const content = this.mainWindow.getContent();
    const lines = content.split('\n');
    this.inputStartPosition = {
      line: lines.length - 1,
      column: lines[lines.length - 1]?.length || 0,
    };

    // Set up key handler for inline input
    this.keyHandler = (ch: string, key: blessed.Widgets.Events.IKeyEventArg) => {
      if (!this.isWaitingForInput) return;

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

      // Handle regular characters
      if (ch && ch.length === 1 && ch.charCodeAt(0) >= 32) {
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
    // Get current content
    const content = this.mainWindow.getContent();
    const lines = content.split('\n');

    // Find the line where input should be displayed
    const inputLine = this.inputStartPosition.line;

    // Reconstruct the line with the current input
    const baseLine = lines[inputLine] || '';
    const baseContent = baseLine.substring(0, this.inputStartPosition.column);
    const newLine = baseContent + this.currentInput + (this.cursorVisible && this.isWaitingForInput ? '█' : '');

    // Update the line
    lines[inputLine] = newLine;

    // Update the main window content
    this.mainWindow.setContent(lines.join('\n'));
    this.mainWindow.setScrollPerc(100);
    this.screen.render();
  }

  private finishInput(machine: ZMachine): void {
    this.isWaitingForInput = false;

    // Stop cursor blinking
    this.stopCursorBlink();

    // Remove the key handler
    if (this.keyHandler) {
      this.screen.removeListener('keypress', this.keyHandler);
      this.keyHandler = null;
    }

    // Echo the input to the display (without cursor)
    if (this.currentInput.length > 0) {
      const content = this.mainWindow.getContent();
      const lines = content.split('\n');
      const inputLine = this.inputStartPosition.line;
      const baseLine = lines[inputLine] || '';
      const baseContent = baseLine.substring(0, this.inputStartPosition.column);
      const newLine = baseContent + this.currentInput;
      lines[inputLine] = newLine;
      this.mainWindow.setContent(lines.join('\n'));
      this.mainWindow.setScrollPerc(100);
    }

    // Add a newline after input
    const content = this.mainWindow.getContent();
    this.mainWindow.setContent(content + '\n');
    this.mainWindow.setScrollPerc(100);

    // Process the input
    const termChar = this.processTerminatingCharacters(this.currentInput, this.terminatingChars);
    this.onInputComplete(machine, this.currentInput, termChar);

    this.screen.render();
  }

  protected doStartCharInput(machine: ZMachine, state: InputState): void {
    this.logger.debug('Starting char input');

    if (state.time && state.time > 0 && state.routine) {
      this.handleTimedInput(machine, state);
    }

    // Handle special keys that should be ignored
    const handleKey = (ch: string, key: blessed.Widgets.Events.IKeyEventArg) => {
      this.screen.removeListener('keypress', handleKey);
      this.removeMouseHandler();

      // Ignore escape - don't handle it at all
      if (key?.name === 'escape') {
        // Restart character input, ignoring escape
        this.doStartCharInput(machine, state);
        return;
      }

      // Ignore extended keys (arrows, function keys, etc.)
      if (
        key &&
        (key.name === 'up' ||
          key.name === 'down' ||
          key.name === 'left' ||
          key.name === 'right' ||
          key.name === 'pageup' ||
          key.name === 'pagedown' ||
          key.name?.startsWith('f') || // Function keys
          key.name === 'home' ||
          key.name === 'end' ||
          key.name === 'insert' ||
          key.name === 'delete')
      ) {
        // Restart character input, ignoring this key
        this.doStartCharInput(machine, state);
        return;
      }

      if (key && key.name === 'space') {
        this.onKeyPress(machine, ' ');
        return;
      }

      // Regular character
      this.onKeyPress(machine, ch || '');
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
