/* eslint-disable @typescript-eslint/no-unused-vars */
import chalk from 'chalk';
import * as fs from 'fs';
import nopt from 'nopt';
import * as readline from 'readline-sync';
import {
  BaseInputProcessor,
  BaseScreen,
  BufferMode,
  Capabilities,
  Color,
  dumpDictionary,
  dumpHeader,
  dumpObjectTable,
  InputState,
  Logger,
  LogLevel,
  ScreenSize,
  TextStyle,
  ZMachine,
} from '../../dist/index.js';

const knownOpts = {
  debug: Boolean,
  noExec: Boolean,
  header: Boolean,
  objectTree: Boolean,
  dict: Boolean,
};

const shorthandOpts = {
  d: ['--debug'],
  n: ['--noExec'],
  h: ['--header'],
  o: ['--objectTree'],
  t: ['--dict'],
  dump: ['--header', '--objectTree', '--dict', '-n'],
};

const parsed = nopt(knownOpts, shorthandOpts, process.argv, 2);
const file = parsed.argv.remain[0];

class StdioScreen extends BaseScreen {
  private textStyle: number = TextStyle.Roman;
  private outputWindowId: number = 0;
  private bufferMode: number = BufferMode.Buffered;
  private colors: Record<number, { foreground: number; background: number }>;

  constructor() {
    super('StdioScreen', { logger: undefined });
    this.colors = {
      0: {
        foreground: Color.Default,
        background: Color.Default,
      },
    };
  }

  getCapabilities(): Capabilities {
    return {
      hasColors: true,
      hasBold: true,
      hasItalic: true,
      hasReverseVideo: true,
      hasFixedPitch: true,
      hasSplitWindow: false,
      hasDisplayStatusBar: true,
      hasPictures: false,
      hasSound: false,
      hasTimedKeyboardInput: true,
    };
  }

  getSize(): ScreenSize {
    return { rows: 25, cols: 80 };
  }

  print(machine: ZMachine, str: string): void {
    if (this.outputWindowId !== 0) {
      return;
    }

    str = this.applyStyles(str);
    str = this.applyColors(str);
    process.stdout.write(str);
  }

  applyStyles(str: string): string {
    if (this.textStyle & TextStyle.ReverseVideo) {
      str = chalk.inverse(str);
    }
    if (this.textStyle & TextStyle.Bold) {
      str = chalk.bold(str);
    }
    if (this.textStyle & TextStyle.Italic) {
      str = chalk.italic(str);
    }
    return str;
  }

  applyColors(str: string): string {
    const chalkedString = (str: string, color: number, bg: boolean): string => {
      switch (color) {
        case Color.Black:
          return bg ? chalk.bgBlack(str) : chalk.black(str);
        case Color.Red:
          return bg ? chalk.bgRed(str) : chalk.red(str);
        case Color.Green:
          return bg ? chalk.bgGreen(str) : chalk.green(str);
        case Color.Yellow:
          return bg ? chalk.bgYellow(str) : chalk.yellow(str);
        case Color.Blue:
          return bg ? chalk.bgBlue(str) : chalk.blue(str);
        case Color.Magenta:
          return bg ? chalk.bgMagenta(str) : chalk.magenta(str);
        case Color.Cyan:
          return bg ? chalk.bgCyan(str) : chalk.cyan(str);
        case Color.White:
          return bg ? chalk.bgWhite(str) : chalk.white(str);
        case Color.Gray:
          return bg ? chalk.bgBlackBright(str) : chalk.gray(str);
        default:
          this.logger.warn(`Unrecognized color: ${color}`);
          return str;
      }
    };

    if (this.colors[this.outputWindowId].background !== Color.Default) {
      str = chalkedString(str, this.colors[this.outputWindowId].background, true);
    }
    if (this.colors[this.outputWindowId].foreground !== Color.Default) {
      str = chalkedString(str, this.colors[this.outputWindowId].foreground, false);
    }

    return str;
  }

  setOutputWindow(machine: ZMachine, windowId: number): void {
    this.outputWindowId = windowId;
  }

  getOutputWindow(_machine: ZMachine): number {
    return this.outputWindowId;
  }

  setBufferMode(machine: ZMachine, mode: number): void {
    this.bufferMode = mode;
  }

  getBufferMode(machine: ZMachine): number {
    return this.bufferMode;
  }

  setTextStyle(machine: ZMachine, style: number): void {
    this.textStyle = style;
  }

  setTextColors(machine: ZMachine, windowId: number, foreground: number, background: number): void {
    const newColors = { foreground, background };
    if (newColors.foreground === Color.Current) {
      newColors.foreground = this.colors[windowId]?.foreground || Color.Default;
    }
    if (newColors.background === Color.Current) {
      newColors.background = this.colors[windowId]?.background || Color.Default;
    }
    this.colors[windowId] = newColors;
  }

  // Implement the rest of the Screen interface methods
  splitWindow(machine: ZMachine, lines: number): void {
    this.logger.debug(`splitWindow (not implemented): ${lines}`);
  }

  clearWindow(machine: ZMachine, windowId: number): void {
    if (windowId === -1) {
      // Clear all windows
      // eslint-disable-next-line no-console
      console.clear();
    } else if (windowId === this.outputWindowId) {
      // eslint-disable-next-line no-console
      console.clear();
    }
  }

  clearLine(machine: ZMachine, value: number): void {
    // Not fully implemented, would need to track cursor position
    process.stdout.write('\r\x1b[K');
  }

  setCursorPosition(machine: ZMachine, line: number, column: number, windowId: number): void {
    // This requires ANSI escape sequences for positioning
    // Not fully implemented here
    this.logger.debug(`setCursorPosition: ${line}, ${column}, window: ${windowId}`);
  }

  hideCursor(machine: ZMachine, windowId: number): void {
    process.stdout.write('\x1b[?25l');
  }

  showCursor(machine: ZMachine, windowId: number): void {
    process.stdout.write('\x1b[?25h');
  }

  updateStatusBar(lhs: string, rhs: string): void {
    // Simple status bar implementation
    const width = this.getSize().cols;
    const padding = width - lhs.length - rhs.length - 2;

    if (padding >= 0) {
      const statusLine = `${chalk.inverse(lhs + ' '.repeat(padding) + rhs)}`;
      process.stdout.write('\r\x1b[K' + statusLine + '\n');
    } else {
      // Not enough space, truncate
      const statusLine = chalk.inverse(`${lhs.substring(0, width - rhs.length - 3)}...${rhs}`);
      process.stdout.write('\r\x1b[K' + statusLine + '\n');
    }
  }

  updateDisplay(machine: ZMachine): void {
    // Force screen update - usually a no-op in console
  }

  getCurrentFont(machine: ZMachine): number {
    return 1; // Default font
  }

  setFont(machine: ZMachine, font: number): boolean {
    return font === 1; // Only support default font
  }

  getFontForWindow(machine: ZMachine, window: number): number {
    return 1;
  }

  setFontForWindow(machine: ZMachine, font: number, window: number): boolean {
    return font === 1;
  }

  getWindowTrueForeground(machine: ZMachine, window: number): number {
    return -1; // Not supported
  }

  getWindowTrueBackground(machine: ZMachine, window: number): number {
    return -1; // Not supported
  }

  getWindowProperty(machine: ZMachine, window: number, property: number): number {
    return 0; // Not fully implemented
  }

  enableOutputStream(machine: ZMachine, streamId: number, table: number, width: number): void {
    this.logger.debug(`enableOutputStream: ${streamId}, ${table}, ${width}`);
  }

  disableOutputStream(machine: ZMachine, streamId: number, table: number, width: number): void {
    this.logger.debug(`disableOutputStream: ${streamId}`);
  }

  selectInputStream(machine: ZMachine, streamId: number): void {
    this.logger.debug(`selectInputStream: ${streamId}`);
  }

  quit(): void {
    process.exit(0);
  }
}

class StdioInputProcessor extends BaseInputProcessor {
  private logger: Logger;

  constructor(options?: { logger?: Logger }) {
    super();
    this.logger = options?.logger || new Logger('StdioInputProcessor');
    this.loadTerminatingCharacters = this.loadTerminatingCharacters.bind(this);
  }

  protected doStartTextInput(machine: ZMachine, state: InputState): void {
    this.logger.debug('Starting text input');

    // Load custom terminating characters if available
    this.loadTerminatingCharacters(machine);

    // Set up timed input if needed
    if (state.time && state.time > 0 && state.routine) {
      this.handleTimedInput(machine, state);
    }

    // Show a prompt
    process.stdout.write('> ');

    // Get input asynchronously to avoid blocking
    this.getInputAsync(machine, state);
  }

  protected doStartCharInput(machine: ZMachine, state: InputState): void {
    this.logger.debug('Starting char input');

    // Set up timed input if needed
    if (state.time && state.time > 0 && state.routine) {
      this.handleTimedInput(machine, state);
    }

    try {
      const key = readline.keyIn('', { hideEchoBack: true });
      this.onKeyPress(machine, key);
    } catch (error) {
      this.logger.error(`Error getting key press: ${error}`);
      machine.executor.resume();
    }
  }

  private getInputAsync(machine: ZMachine, state: InputState): void {
    // This is a simple implementation using readline-sync
    // In a real app, you might use readline or other async input methods
    try {
      const input = readline.question('');
      this.onInputComplete(machine, input);
    } catch (error) {
      this.logger.error(`Error getting input: ${error}`);
      machine.executor.resume();
    }
  }

  async promptForFilename(machine: ZMachine, operation: string): Promise<string> {
    process.stdout.write(`Enter filename for ${operation}: `);
    return readline.question('');
  }
}

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
  logger.info(`Loaded ${storyData.length} bytes from ${file}`);

  // Create the screen and input processor
  const screen = new StdioScreen();
  const inputProcessor = new StdioInputProcessor();

  // Create the Z-machine
  const machine = new ZMachine(storyData, screen, inputProcessor, undefined, undefined, { logger });

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
    machine.execute();
  }
} catch (error) {
  logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
