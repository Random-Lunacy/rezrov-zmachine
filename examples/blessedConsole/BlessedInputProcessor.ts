import * as blessed from 'blessed';
import { BaseInputProcessor, InputState, Logger, ZMachine } from '../../dist/index.js';

export class BlessedInputProcessor extends BaseInputProcessor {
  private logger: Logger;
  private screen: blessed.Widgets.Screen;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private inputBox: any | null = null; // Changed from blessed.Widgets.Box
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private currentKeypressHandler: ((ch: string, key: any) => void) | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(screen: any, options?: { logger?: Logger }) {
    // Changed parameter type
    super();
    this.logger = options?.logger || new Logger('BlessedInputProcessor');
    this.screen = screen;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private createInputBox(): any {
    // Changed return type
    if (this.inputBox) {
      this.screen.remove(this.inputBox);
    }

    this.inputBox = blessed.textbox({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      inputOnFocus: true,
      keys: true,
      mouse: true,
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: '#f0f0f0',
          bg: 'black',
        },
      },
    });

    this.screen.append(this.inputBox);
    this.screen.render();
    return this.inputBox;
  }

  protected doStartTextInput(machine: ZMachine, state: InputState): void {
    this.logger.debug('Starting text input');

    this.loadTerminatingCharacters(machine);

    if (state.time && state.time > 0 && state.routine) {
      this.handleTimedInput(machine, state);
    }

    const inputBox = this.createInputBox();

    // Register callbacks for dialog events
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((this.screen as any).setDialogDismissCallback) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.screen as any).setDialogDismissCallback(() => {
        this.enableInputHandlers();
        if (this.inputBox) {
          this.inputBox.focus();
        }
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((this.screen as any).setDialogOpenedCallback) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.screen as any).setDialogOpenedCallback(() => {
        this.disableInputHandlers();
      });
    }

    // Create the keypress handler
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.currentKeypressHandler = (ch: string, key: any) => {
      if (key?.name === 'escape') {
        inputBox.focus();
        return false;
      }
      // Note: Ctrl+C is now handled at screen level, not here
    };

    // Enable handlers initially
    this.enableInputHandlers();

    // Use the submit event for normal input
    inputBox.on('submit', (value: string) => {
      // Clean up handlers
      this.disableInputHandlers();

      // Clear the callbacks when input is done
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((this.screen as any).setDialogDismissCallback) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.screen as any).setDialogDismissCallback(null);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((this.screen as any).setDialogOpenedCallback) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (this.screen as any).setDialogOpenedCallback(null);
      }

      const input = value || '';
      const termChar = this.processTerminatingCharacters(input, this.terminatingChars);
      this.onInputComplete(machine, input, termChar);

      // Clean up
      this.screen.remove(inputBox);
      this.inputBox = null;
      this.currentKeypressHandler = null;
      this.screen.render();
    });

    inputBox.focus();
    this.screen.render();
  }

  // Add these methods
  private enableInputHandlers(): void {
    if (this.inputBox && this.currentKeypressHandler) {
      this.inputBox.on('keypress', this.currentKeypressHandler);
    }
  }

  private disableInputHandlers(): void {
    if (this.inputBox && this.currentKeypressHandler) {
      this.inputBox.removeListener('keypress', this.currentKeypressHandler);
    }
  }

  protected doStartCharInput(machine: ZMachine, state: InputState): void {
    this.logger.debug('Starting char input');

    if (state.time && state.time > 0 && state.routine) {
      this.handleTimedInput(machine, state);
    }

    // Handle special keys that should be ignored
    const handleKey = (ch: string, key: blessed.Widgets.Events.IKeyEventArg) => {
      this.screen.removeListener('keypress', handleKey);

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

    this.screen.on('keypress', handleKey);
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
      const inputBox = this.createInputBox();
      inputBox.setLabel(` ${operation} - Enter filename `);
      inputBox.focus();

      inputBox.readInput((err, value) => {
        this.screen.remove(inputBox);
        this.screen.render();
        resolve(value || '');
      });
    });
  }
}
