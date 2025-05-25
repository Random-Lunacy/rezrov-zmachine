import { readFileSync } from 'fs';
import { ZMachine } from '../../src/interpreter/ZMachine';
import { InputMode } from '../../src/ui/input/InputInterface';
import { Logger, LogLevel } from '../../src/utils/log';
import { TestInputProcessor } from './TestInputProcessor';
import { TestScreen } from './TestScreen';
import { TestStorage } from './TestStorage';

/**
 * Helper to run a Story file for use in integration tests
 */
export async function runZStory(storyPath: string, expectedOutputs?: string[], timeout = 5000): Promise<string> {
  const logger = new Logger('runZStory');
  Logger.setLevel(LogLevel.DEBUG);

  // Load the test story
  logger.debug(`Loading ${storyPath}`);
  const testStory = readFileSync(storyPath);
  const screen = new TestScreen(logger);
  const inputProcessor = new TestInputProcessor(logger, true);
  const storage = new TestStorage(testStory);

  // Create the Z-machine
  logger.debug('Creating ZMachine');
  const machine = new ZMachine(testStory, screen, inputProcessor, undefined, undefined, { logger });

  // Execute the program
  logger.debug(`Starting execution of ${storyPath}`);
  machine.execute();

  // Wait for the program to complete execution
  await new Promise<void>((resolve) => {
    const checkInterval = setInterval(() => {
      // Get current output
      const currentOutput = screen.getOutput();
      logger.debug(`Output received: ${currentOutput}`);

      // Check if execution finished or all expected outputs are seen
      const outputComplete =
        screen.isExecutionFinished() ||
        (expectedOutputs && expectedOutputs.every((text) => currentOutput.includes(text)));

      if (outputComplete) {
        const inputState = machine.getInputState();
        if (inputState) {
          // If we're waiting for input at the end, simulate appropriate input
          if (inputState.mode === InputMode.CHAR || inputState.mode === InputMode.TIMED_CHAR) {
            inputProcessor.onKeyPress(machine, '\r');
          } else {
            inputProcessor.onInputComplete(machine, '');
          }
        }

        // Clear the interval and resolve after a short delay
        clearInterval(checkInterval);
        setTimeout(() => resolve(), 100);
      }
    }, 100);

    // Safety timeout to prevent hanging tests
    setTimeout(() => {
      clearInterval(checkInterval);
      resolve();
    }, timeout);
  });

  return screen.getOutput();
}
