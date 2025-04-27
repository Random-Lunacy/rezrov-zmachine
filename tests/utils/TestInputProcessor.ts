import { ZMachine } from '../../src/interpreter/ZMachine';
import { InputProcessor, InputState } from '../../src/ui/input/InputInterface';
import { Logger } from '../../src/utils/log';

/**
 * InputProcessor implementation for use in integrations tests
 */
export class TestInputProcessor implements InputProcessor {
  private logger: Logger;
  private autoRespond: boolean = true;

  constructor(logger: Logger, autoRespond: boolean = true) {
    this.logger = logger;
    this.autoRespond = autoRespond;
  }

  startTextInput(machine: ZMachine, state: InputState): void {
    this.logger.debug('Test input processor: Simulating text input');

    // Immediately respond with a predefined input if autoRespond is true
    if (this.autoRespond) {
      setTimeout(() => {
        const simulatedInput = 'test input';
        this.onInputComplete(machine, simulatedInput);
      }, 0);
    }
  }

  startCharInput(machine: ZMachine, state: InputState): void {
    this.logger.debug('Test input processor: Simulating key press');

    // Immediately respond with a carriage return if autoRespond is true
    if (this.autoRespond) {
      setTimeout(() => {
        this.onKeyPress(machine, '\r');
      }, 0);
    }
  }

  cancelInput(machine: ZMachine): void {
    this.logger.debug('Input canceled');
  }

  handleTimedInput?(machine: ZMachine, state: InputState): void {
    if (state.time && state.time > 0 && state.routine) {
      setTimeout(() => {
        this.onInputTimeout(machine, state);
      }, 10);
    }
  }

  processTerminatingCharacters?(input: string, terminators: number[]): number {
    return 13;
  }

  async promptForFilename(machine: ZMachine, operation: string): Promise<string> {
    return 'test_savefile.dat';
  }

  onInputComplete(machine: ZMachine, input: string, termChar?: number): void {
    this.logger.debug(`Test input processor: Input complete: "${input}"`);

    const state = machine.getInputState();
    if (!state) {
      this.logger.error('No input state found!');
      return;
    }

    if (state.textBuffer) {
      const textBuffer = state.textBuffer;
      const memory = machine.memory;

      if (machine.state.version <= 4) {
        const maxLength = memory.getByte(textBuffer);
        for (let i = 0; i < Math.min(input.length, maxLength - 1); i++) {
          memory.setByte(textBuffer + 1 + i, input.charCodeAt(i));
        }
        memory.setByte(textBuffer + 1 + Math.min(input.length, maxLength - 1), 0);
      } else {
        memory.setByte(textBuffer + 1, input.length);
        for (let i = 0; i < Math.min(input.length, 255); i++) {
          memory.setByte(textBuffer + 2 + i, input.charCodeAt(i));
        }
      }

      if (state.parseBuffer) {
        machine.state.tokenizeLine(textBuffer, state.parseBuffer);
      }
    }

    machine.executor.resume();
  }

  onKeyPress(machine: ZMachine, key: string): void {
    this.logger.debug(`Test input processor: Key press: "${key}"`);

    const state = machine.getInputState();
    if (!state) {
      this.logger.error('No input state found!');
      return;
    }

    const keyCode = key.charCodeAt(0);
    machine.state.storeVariable(state.resultVar, keyCode);

    machine.executor.resume();
  }

  onInputTimeout(machine: ZMachine, state: InputState): void {
    this.logger.debug('Test input processor: Input timed out');

    if (state.routine) {
      const routineAddr = machine.memory.unpackRoutineAddress(state.routine);
      machine.state.callRoutine(routineAddr, null);
      machine.executor.resume();
    }
  }
}
