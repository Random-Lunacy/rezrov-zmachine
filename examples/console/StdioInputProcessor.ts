import * as readline from 'readline-sync';
import { BaseInputProcessor, InputState, Logger, ZMachine } from '../../dist/index.js';

/**
 * Simple stdio-based input processor using readline-sync.
 *
 * NOTE: This implementation uses blocking (synchronous) input via readline-sync.
 * This means true timed input support is not possible - the timeout callbacks
 * cannot fire while the event loop is blocked waiting for input. For games that
 * require timed input (like Border Zone), use the BlessedInputProcessor instead
 * which uses event-based non-blocking input.
 */
export class StdioInputProcessor extends BaseInputProcessor {
  private logger: Logger;

  constructor(options?: { logger?: Logger }) {
    super();
    this.logger = options?.logger || new Logger('StdioInputProcessor');
    this.loadTerminatingCharacters = this.loadTerminatingCharacters.bind(this);
  }

  protected doStartTextInput(machine: ZMachine, _state: InputState): void {
    this.logger.debug('Starting text input');

    this.loadTerminatingCharacters(machine);

    // NOTE: Timed input is not properly supported with readline-sync
    // because it uses blocking I/O. The timeout would only fire after
    // input completes, which defeats the purpose.

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

  protected doStartCharInput(machine: ZMachine, _state: InputState): void {
    this.logger.debug('Starting char input');

    this.loadTerminatingCharacters(machine);

    // NOTE: Timed input is not properly supported with readline-sync
    // because it uses blocking I/O.

    try {
      const key = readline.keyIn('', { hideEchoBack: true });
      this.onKeyPress(machine, key);
    } catch (error) {
      this.logger.error(`Error getting key press: ${error}`);
      this.onKeyPress(machine, '\0'); // Null character on error
    }
  }

  async promptForFilename(_machine: ZMachine, operation: string): Promise<string> {
    process.stdout.write(`Enter filename for ${operation}: `);
    return readline.question('');
  }

  /**
   * Cleanup method for interface compatibility.
   * No cleanup needed for readline-sync since it uses blocking I/O.
   */
  cleanup(): void {
    // No-op for readline-sync - it doesn't maintain any state that needs cleanup
  }
}
