/* eslint-disable @typescript-eslint/no-unused-vars */
import * as blessed from 'blessed';
import * as fs from 'fs';
import nopt from 'nopt';
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

class BlessedScreen extends BaseScreen {
  private screen: blessed.Widgets.Screen;
  private statusWindow: blessed.Widgets.Box; // Window 1 - status bar
  private mainWindow: blessed.Widgets.Box; // Window 0 - main text
  private currentWindow: number = 0;
  private textStyle: number = TextStyle.Roman;
  private bufferMode: number = BufferMode.Buffered;
  private colors: Record<number, { foreground: number; background: number }>;
  private cursorPosition: { line: number; column: number } = { line: 1, column: 1 };

  constructor() {
    super('BlessedScreen', { logger: undefined });

    this.colors = {
      0: { foreground: Color.Default, background: Color.Default },
      1: { foreground: Color.Default, background: Color.Default },
    };

    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Z-Machine',
      cursor: {
        artificial: true,
        shape: 'line',
        blink: true,
        color: null,
      },
    });

    // Status bar (Window 1) - fixed at top
    this.statusWindow = blessed.box({
      top: 0,
      left: 0,
      width: '100%',
      height: 1,
      content: '',
      style: {
        fg: 'black',
        bg: 'white',
      },
      tags: true,
    });

    // Main window (Window 0) - scrolling content
    this.mainWindow = blessed.box({
      top: 1,
      left: 0,
      width: '100%',
      height: '100%-1',
      content: '',
      scrollable: true,
      alwaysScroll: true,
      tags: true,
      style: {
        fg: 'white',
        bg: 'black',
      },
    });

    this.screen.append(this.statusWindow);
    this.screen.append(this.mainWindow);

    // Handle exit keys
    this.screen.key(['escape', 'C-c'], () => {
      this.quit();
    });

    this.screen.render();
  }

  getCapabilities(): Capabilities {
    return {
      hasColors: true,
      hasBold: true,
      hasItalic: true,
      hasReverseVideo: true,
      hasFixedPitch: true,
      hasSplitWindow: true,
      hasDisplayStatusBar: true,
      hasPictures: false,
      hasSound: false,
      hasTimedKeyboardInput: true,
    };
  }

  getSize(): ScreenSize {
    return {
      rows: this.screen.height as number,
      cols: this.screen.width as number,
    };
  }

  print(machine: ZMachine, str: string): void {
    const targetWindow = this.currentWindow === 0 ? this.mainWindow : this.statusWindow;

    // Apply text styling and colors
    const styledText = this.applyStylesAndColors(str);

    if (this.currentWindow === 0) {
      // Main window - append and scroll
      const currentContent = targetWindow.getContent();
      targetWindow.setContent(currentContent + styledText);
      targetWindow.setScrollPerc(100);
    } else {
      // Status window - replace content (typical for status lines)
      targetWindow.setContent(styledText);
    }

    this.screen.render();
  }

  private applyStylesAndColors(str: string): string {
    let result = str;

    // Apply text styles using blessed tags
    if (this.textStyle & TextStyle.Bold) {
      result = `{bold}${result}{/bold}`;
    }
    if (this.textStyle & TextStyle.Italic) {
      result = `{italic}${result}{/italic}`;
    }
    if (this.textStyle & TextStyle.ReverseVideo) {
      result = `{inverse}${result}{/inverse}`;
    }

    // Apply colors
    const windowColors = this.colors[this.currentWindow];
    if (windowColors) {
      const fgColor = this.mapZMachineColor(windowColors.foreground);
      const bgColor = this.mapZMachineColor(windowColors.background);

      if (fgColor && bgColor) {
        result = `{${fgColor}-fg}{${bgColor}-bg}${result}{/}`;
      } else if (fgColor) {
        result = `{${fgColor}-fg}${result}{/}`;
      } else if (bgColor) {
        result = `{${bgColor}-bg}${result}{/}`;
      }
    }

    return result;
  }

  private mapZMachineColor(color: number): string | null {
    switch (color) {
      case Color.Black:
        return 'black';
      case Color.Red:
        return 'red';
      case Color.Green:
        return 'green';
      case Color.Yellow:
        return 'yellow';
      case Color.Blue:
        return 'blue';
      case Color.Magenta:
        return 'magenta';
      case Color.Cyan:
        return 'cyan';
      case Color.White:
        return 'white';
      case Color.Gray:
        return 'gray';
      case Color.Default:
        return null;
      default:
        this.logger.warn(`Unrecognized color: ${color}`);
        return null;
    }
  }

  setOutputWindow(machine: ZMachine, windowId: number): void {
    this.currentWindow = windowId;
  }

  getOutputWindow(machine: ZMachine): number {
    return this.currentWindow;
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

    // Apply colors to the window immediately
    const targetWindow = windowId === 0 ? this.mainWindow : this.statusWindow;
    const fgColor = this.mapZMachineColor(foreground);
    const bgColor = this.mapZMachineColor(background);

    if (fgColor || bgColor) {
      targetWindow.style.fg = fgColor || targetWindow.style.fg;
      targetWindow.style.bg = bgColor || targetWindow.style.bg;
      this.screen.render();
    }
  }

  splitWindow(machine: ZMachine, lines: number): void {
    if (lines === 0) {
      // Unsplit - status window invisible
      this.statusWindow.height = 0;
      this.mainWindow.top = 0;
      this.mainWindow.height = '100%';
    } else {
      // Split - status window visible
      this.statusWindow.height = lines;
      this.mainWindow.top = lines;
      this.mainWindow.height = `100%-${lines}`;
    }
    this.screen.render();
  }

  clearWindow(machine: ZMachine, windowId: number): void {
    if (windowId === 0 || windowId === -1) {
      this.mainWindow.setContent('');
    }
    if (windowId === 1 || windowId === -1) {
      this.statusWindow.setContent('');
    }
    this.screen.render();
  }

  clearLine(machine: ZMachine, value: number): void {
    const targetWindow = this.currentWindow === 0 ? this.mainWindow : this.statusWindow;
    // Clear current line - simplified implementation
    const content = targetWindow.getContent();
    const lines = content.split('\n');
    if (lines.length > 0) {
      lines[lines.length - 1] = '';
      targetWindow.setContent(lines.join('\n'));
      this.screen.render();
    }
  }

  setCursorPosition(machine: ZMachine, line: number, column: number, windowId: number): void {
    this.cursorPosition = { line, column };
    // blessed handles cursor positioning internally for most cases
    this.logger.debug(`setCursorPosition: ${line}, ${column}, window: ${windowId}`);
  }

  hideCursor(machine: ZMachine, windowId: number): void {
    this.screen.cursor.shape = 'line';
    this.screen.cursor.blink = false;
    this.screen.render();
  }

  showCursor(machine: ZMachine, windowId: number): void {
    this.screen.cursor.shape = 'line';
    this.screen.cursor.blink = true;
    this.screen.render();
  }

  updateStatusBar(lhs: string, rhs: string): void {
    const width = this.getSize().cols;
    const padding = Math.max(0, width - lhs.length - rhs.length);
    const statusLine = lhs + ' '.repeat(padding) + rhs;
    this.statusWindow.setContent(statusLine);
    this.screen.render();
  }

  updateDisplay(machine: ZMachine): void {
    this.screen.render();
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
    switch (property) {
      case 0: // Y cursor position
        return this.cursorPosition.line;
      case 1: // X cursor position
        return this.cursorPosition.column;
      case 2: // Y size
        return window === 0 ? (this.mainWindow.height as number) : (this.statusWindow.height as number);
      case 3: // X size
        return this.getSize().cols;
      default:
        return 0;
    }
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
    this.screen.destroy();
    process.exit(0);
  }
}

class BlessedInputProcessor extends BaseInputProcessor {
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
  const screen = new BlessedScreen();
  const inputProcessor = new BlessedInputProcessor((screen as any).screen);

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
    machine.execute();
  }
} catch (error) {
  logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
