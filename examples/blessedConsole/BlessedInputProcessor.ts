import * as blessed from 'blessed';
import { BaseInputProcessor, InputState, Logger, ZMachine } from '../../dist/index.js';

export class BlessedInputProcessor extends BaseInputProcessor {
  private logger: Logger;
  private screen: blessed.Widgets.Screen;
  private inputBox: blessed.Widgets.Textbox | null = null;

  constructor(screen: blessed.Widgets.Screen, options?: { logger?: Logger }) {
    super();
    this.logger = options?.logger || new Logger('BlessedInputProcessor');
    this.screen = screen;
    this.loadTerminatingCharacters = this.loadTerminatingCharacters.bind(this);
  }

  private createInputBox(): blessed.Widgets.Textbox {
    if (this.inputBox) {
      this.screen.remove(this.inputBox);
    }

    this.inputBox = blessed.textbox({
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      inputOnFocus: true,
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: '#f0f0f0',
        },
      },
      label: ' Input ',
    });

    this.screen.append(this.inputBox);
    return this.inputBox;
  }

  protected doStartTextInput(machine: ZMachine, state: InputState): void {
    this.logger.debug('Starting text input');

    this.loadTerminatingCharacters(machine);

    if (state.time && state.time > 0 && state.routine) {
      this.handleTimedInput(machine, state);
    }

    const inputBox = this.createInputBox();
    inputBox.focus();

    inputBox.readInput((err, value) => {
      if (err) {
        this.logger.error(`Input error: ${err}`);
        this.onInputComplete(machine, '', 13);
        return;
      }

      const input = value || '';
      const termChar = this.processTerminatingCharacters(input, this.terminatingChars);
      this.onInputComplete(machine, input, termChar);

      // Remove input box after use
      this.screen.remove(inputBox);
      this.screen.render();
    });
  }

  protected doStartCharInput(machine: ZMachine, state: InputState): void {
    this.logger.debug('Starting char input');

    if (state.time && state.time > 0 && state.routine) {
      this.handleTimedInput(machine, state);
    }

    // Handle special keys that should be ignored
    const handleKey = (ch: string, key: blessed.Widgets.Events.IKeyEventArg) => {
      this.screen.removeListener('keypress', handleKey);

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

      // Handle special cases
      if (key && key.name === 'enter') {
        this.onKeyPress(machine, '\r');
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
