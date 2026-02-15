import * as fs from 'fs';
import {
  dumpDictionary,
  dumpHeader,
  dumpObjectTable,
  HeaderLocation,
  Logger,
  LogLevel,
  ZMachine,
} from '../../dist/index.js';
import { BlessedInputProcessor } from './BlessedInputProcessor.js';
import { BlessedScreen } from './BlessedScreen.js';
import { INTERPRETER_NAMES, parseArguments } from './utils.js';

const parsed = parseArguments();
const file = parsed.argv.remain[0];

if (!file) {
  // eslint-disable-next-line no-console
  console.error('Must specify path to z-machine story file');
  // eslint-disable-next-line no-console
  console.error('Usage: node index.js [options] <story-file>');
  // eslint-disable-next-line no-console
  console.error('Options:');
  // eslint-disable-next-line no-console
  console.error('  -d, --debug                Enable debug logging');
  // eslint-disable-next-line no-console
  console.error('  -i, --interpreter <name>   Set interpreter type (default: amiga)');
  // eslint-disable-next-line no-console
  console.error(`                             Valid: ${Object.keys(INTERPRETER_NAMES).join(', ')}`);
  // eslint-disable-next-line no-console
  console.error('  -h, --header               Dump story file header');
  // eslint-disable-next-line no-console
  console.error('  -o, --objectTree           Dump object table');
  // eslint-disable-next-line no-console
  console.error('  -t, --dict                 Dump dictionary');
  // eslint-disable-next-line no-console
  console.error('  -n, --noExec               Show info without running');
  process.exit(1);
}

// Set up logger
const logger = new Logger('Console');
if (parsed.debug) {
  Logger.setLevel(LogLevel.DEBUG);
  // For blessedConsole, log to file instead of console since blessed takes over the terminal
  Logger.setLogToConsole(false);
  Logger.setLogToFile(true, 'zmachine-debug.log');
} else {
  Logger.setLevel(LogLevel.INFO);
}

// Create the screen and input processor
// Resolve interpreter number from CLI arg (default handled by ZMachine via Capabilities)
const interpreterNumber = parsed.interpreter ? INTERPRETER_NAMES[parsed.interpreter] : undefined;
const screen = new BlessedScreen(interpreterNumber);
const inputProcessor = new BlessedInputProcessor(screen);

// Set up cleanup on process exit
process.on('exit', () => {
  inputProcessor.cleanup();
});

process.on('SIGINT', () => {
  inputProcessor.cleanup();
  process.exit(0);
});

try {
  // Load the story file
  const storyData = fs.readFileSync(file);
  logger.debug(`Loaded ${storyData.length} bytes from ${file}`);

  // Create the Z-machine
  const machine = new ZMachine(storyData, screen, inputProcessor, undefined, undefined);

  // Set up callback to update Z-machine header when blessed knows actual screen dimensions
  screen.setResizeCallback((cols: number, rows: number) => {
    const version = machine.state.version;

    machine.memory.setByte(HeaderLocation.ScreenHeightInLines, rows);
    machine.memory.setByte(HeaderLocation.ScreenWidthInChars, cols);

    if (version >= 5) {
      machine.memory.setWord(HeaderLocation.ScreenWidthInUnits, cols);
      machine.memory.setWord(HeaderLocation.ScreenHeightInUnits, rows);
    }

    logger.debug(`Updated screen dimensions in header: ${cols}x${rows}`);
  });

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
    // Delay execution briefly to let blessed determine terminal dimensions.
    // This ensures the game reads correct screen width during initialization.
    setTimeout(() => {
      // Update header with current dimensions before game starts
      const { rows, cols } = screen.getSize();
      const version = machine.state.version;

      machine.memory.setByte(HeaderLocation.ScreenHeightInLines, rows);
      machine.memory.setByte(HeaderLocation.ScreenWidthInChars, cols);

      if (version >= 5) {
        machine.memory.setWord(HeaderLocation.ScreenWidthInUnits, cols);
        machine.memory.setWord(HeaderLocation.ScreenHeightInUnits, rows);
      }

      logger.debug(`Starting game with screen dimensions: ${cols}x${rows}`);
      machine.execute();
    }, 50); // Small delay for blessed to initialize
  }
} catch (error) {
  logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  // Clean up input processor before exiting
  inputProcessor.cleanup();
  process.exit(1);
}
