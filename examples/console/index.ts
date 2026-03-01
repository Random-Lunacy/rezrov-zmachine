import * as fs from 'fs';
import * as path from 'path';
import {
  BlorbParser,
  dumpDictionary,
  dumpHeader,
  dumpObjectTable,
  Logger,
  LogLevel,
  ZMachine,
} from '../../dist/index.js';
import { StdioInputProcessor } from './StdioInputProcessor.js';
import { StdioScreen } from './StdioScreen.js';
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
} else {
  Logger.setLevel(LogLevel.INFO);
}

// Handle process signals for clean exit
process.on('SIGINT', () => {
  // Restore terminal state on Ctrl+C
  process.stdout.write('\x1b[?25h'); // Show cursor
  process.stdout.write('\x1b[0m'); // Reset colors/styles
  process.exit(0);
});

try {
  // Load the story file
  let storyData = fs.readFileSync(file);
  logger.debug(`Loaded ${storyData.length} bytes from ${file}`);

  let blorbMap: ReturnType<typeof BlorbParser.parse> | null = null;
  let blorbData: Buffer | null = null;

  if (BlorbParser.isBlorb(storyData)) {
    blorbMap = BlorbParser.parse(storyData);
    blorbData = storyData;
    const exec = BlorbParser.getExecData(blorbMap, storyData);
    if (exec) storyData = exec;
  } else {
    const dir = path.dirname(file);
    const base = path.basename(file, path.extname(file));
    const blorbPath = path.join(dir, `${base}.blb`);
    if (fs.existsSync(blorbPath)) {
      const data = fs.readFileSync(blorbPath);
      if (BlorbParser.isBlorb(data)) {
        blorbMap = BlorbParser.parse(data);
        blorbData = data;
        logger.debug(`Found companion Blorb: ${blorbPath}`);
      }
    }
  }

  // Create the screen and input processor
  const interpreterNumber = parsed.interpreter ? INTERPRETER_NAMES[parsed.interpreter] : undefined;
  const screen = new StdioScreen(interpreterNumber);
  const inputProcessor = new StdioInputProcessor();

  // Create the Z-machine
  const machine = new ZMachine(storyData, screen, inputProcessor, undefined, undefined);
  if (blorbMap && blorbData) {
    machine.setBlorb(blorbMap, blorbData);
  }

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
  // Restore terminal state on error
  process.stdout.write('\x1b[?25h'); // Show cursor
  process.stdout.write('\x1b[0m'); // Reset colors/styles
  logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
