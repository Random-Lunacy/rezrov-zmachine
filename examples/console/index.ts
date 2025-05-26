import * as fs from 'fs';
import { dumpDictionary, dumpHeader, dumpObjectTable, Logger, LogLevel, ZMachine } from '../../dist/index.js';
import { StdioInputProcessor } from './StdioInputProcessor.js';
import { StdioScreen } from './StdioScreen.js';
import { parseArguments } from './utils.js';

const parsed = parseArguments();
const file = parsed.argv.remain[0];

if (!file) {
  // eslint-disable-next-line no-console
  console.error('Must specify path to z-machine story file');
  process.exit(1);
}

// Set up logger
const logger = new Logger('Console');
if (parsed.debug) {
  Logger.setLevel(LogLevel.DEBUG);
} else {
  Logger.setLevel(LogLevel.INFO);
}

try {
  // Load the story file
  const storyData = fs.readFileSync(file);
  logger.debug(`Loaded ${storyData.length} bytes from ${file}`);

  // Create the screen and input processor
  const screen = new StdioScreen();
  const inputProcessor = new StdioInputProcessor();

  // Create the Z-machine
  const machine = new ZMachine(storyData, screen, inputProcessor, undefined, undefined);

  // Show debugging info if requested
  if (parsed.header) {
    dumpHeader(machine);
  }

  if (parsed.objectTree) {
    dumpObjectTable(machine);
  }

  if (parsed.dict) {
    dumpDictionary(machine);
  }

  // Run the machine unless the --noExec flag is set
  if (!parsed.noExec) {
    machine.screen.clearWindow(machine, -1); // Clear the screen
    machine.screen.print(machine, '\n\n');
    machine.execute();
  }
} catch (error) {
  logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
