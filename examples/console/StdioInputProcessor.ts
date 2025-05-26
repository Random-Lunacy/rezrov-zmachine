import * as readline from 'readline-sync';
import { BaseInputProcessor, InputState, Logger, ZMachine } from '../../dist/index.js';

export class StdioInputProcessor extends BaseInputProcessor {
  private logger: Logger;

  constructor(options?: { logger?: Logger }) {
    super();
    this.logger = options?.logger || new Logger('StdioInputProcessor');
    this.loadTerminatingCharacters = this.loadTerminatingCharacters.bind(this);
  }

  protected doStartTextInput(machine: ZMachine, state: InputState): void {
    this.logger.debug('Starting text input');

    this.loadTerminatingCharacters(machine);

    if (state.time && state.time > 0 && state.routine) {
      this.handleTimedInput(machine, state);
    }

    // Don't print a prompt - Z-Machine already did
    try {
      const input = readline.question('');
      const termChar = this.processTerminatingCharacters(input, this.terminatingChars);
      this.onInputComplete(machine, input, termChar);
    } catch (error) {
      this.logger.error(`Error getting input: ${error}`);
      this.onInputComplete(machine, '', 13); // Empty input with Enter terminator
    }
  }

  protected doStartCharInput(machine: ZMachine, state: InputState): void {
    this.logger.debug('Starting char input');

    this.loadTerminatingCharacters(machine);

    if (state.time && state.time > 0 && state.routine) {
      this.handleTimedInput(machine, state);
    }

    try {
      const key = readline.keyIn('', { hideEchoBack: true });
      this.onKeyPress(machine, key);
    } catch (error) {
      this.logger.error(`Error getting key press: ${error}`);
      this.onKeyPress(machine, '\0'); // Null character on error
    }
  }

  async promptForFilename(machine: ZMachine, operation: string): Promise<string> {
    process.stdout.write(`Enter filename for ${operation}: `);
    return readline.question('');
  }
}
