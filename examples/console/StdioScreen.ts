/* eslint-disable @typescript-eslint/no-unused-vars */
import chalk from 'chalk';
import {
  BaseScreen,
  Capabilities,
  Color,
  ScreenSize,
  TextStyle,
  translateFont3Text,
  ZMachine,
} from '../../dist/index.js';

export class StdioScreen extends BaseScreen {
  private textStyle: number = TextStyle.Roman;

  constructor() {
    super('StdioScreen');
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
    // Use actual terminal dimensions if available, fallback to defaults
    return {
      rows: process.stdout.rows || 25,
      cols: process.stdout.columns || 80,
    };
  }

  /**
   * Initialize output position for bottom-aligned text.
   * Positions cursor near bottom of screen so first content appears at bottom.
   */
  protected initializeOutputPosition(): void {
    if (!this.startFromBottom || this.hasReceivedFirstOutput) return;

    const { rows } = this.getSize();
    // Position cursor near bottom (leave room for input line)
    const targetRow = Math.max(0, rows - 2);
    process.stdout.cursorTo(0, targetRow);
  }

  print(machine: ZMachine, str: string): void {
    // Check if memory stream (stream 3) is active - if so, write to memory only
    if (this.isMemoryStreamActive()) {
      this.writeToMemoryStream(machine, str);
      return; // Don't output to screen when memory stream is active
    }

    if (this.outputWindowId !== 0) {
      return;
    }

    // Initialize bottom-aligned output on first print to main window
    if (!this.hasReceivedFirstOutput && this.startFromBottom) {
      this.initializeOutputPosition();
      this.hasReceivedFirstOutput = true;
    }

    // Translate Font 3 characters to Unicode if Font 3 is active
    let textToDisplay = str;
    if (this.isCurrentFontFont3()) {
      textToDisplay = translateFont3Text(str);
    }

    textToDisplay = this.applyStyles(textToDisplay);
    textToDisplay = this.applyColors(textToDisplay);
    process.stdout.write(textToDisplay);
  }

  applyStyles(str: string): string {
    if (this.currentStyles & TextStyle.ReverseVideo) {
      str = chalk.inverse(str);
    }
    if (this.currentStyles & TextStyle.Bold) {
      str = chalk.bold(str);
    }
    if (this.currentStyles & TextStyle.Italic) {
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

    const colors = this.windowColors.get(this.outputWindowId);
    if (colors && colors.background !== Color.Default) {
      str = chalkedString(str, colors.background, true);
    }
    if (colors && colors.foreground !== Color.Default) {
      str = chalkedString(str, colors.foreground, false);
    }

    return str;
  }

  // Override setTextStyle to update our local textStyle for styling
  setTextStyle(machine: ZMachine, style: number): void {
    super.setTextStyle(machine, style);
    this.textStyle = style; // Keep local copy for styling
  }

  // Override setTextColors to ensure our styling works
  setTextColors(machine: ZMachine, window: number, foreground: number, background: number): void {
    super.setTextColors(machine, window, foreground, background);
  }

  // Implement the rest of the Screen interface methods
  splitWindow(machine: ZMachine, lines: number): void {
    super.splitWindow(machine, lines);
  }

  clearWindow(machine: ZMachine, windowId: number): void {
    super.clearWindow(machine, windowId);

    // Clear screen using Node.js native API (more cross-platform than raw ANSI escapes)
    if (windowId === -1 || windowId === 0) {
      // Clear all windows (-1) or main window (0)
      // Move cursor to top-left, then clear from cursor to end of screen
      process.stdout.cursorTo(0, 0);
      process.stdout.clearScreenDown();
    }
    // Note: Window 1 (upper/status) clearing is not fully supported in this simple console
    // implementation since we don't maintain a separate buffer for it
  }

  clearLine(machine: ZMachine, value: number): void {
    super.clearLine(machine, value);
    // Not fully implemented, would need to track cursor position
    process.stdout.write('\r\x1b[K');
  }

  setCursorPosition(machine: ZMachine, line: number, column: number, windowId: number): void {
    super.setCursorPosition(machine, line, column, windowId);
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

  updateStatusBar(locationName: string | null, value1: number, value2: number, isTimeMode: boolean): void {
    // Save cursor position
    process.stdout.write('\x1b7'); // or '\x1b[s'

    // Move cursor to top-left before writing status bar
    process.stdout.write('\x1b[H');

    // Use BaseScreen's formatStatusBarLine() helper for consistent formatting
    const width = this.getSize().cols;
    const statusLine = this.formatStatusBarLine(locationName, value1, value2, isTimeMode, width);

    this.logger.debug(`Updating status bar: ${statusLine}`);

    // Write the status line with inverse video
    process.stdout.write('\r\x1b[K' + chalk.inverse(statusLine) + '\n');

    // Restore cursor position
    process.stdout.write('\x1b8'); // or '\x1b[u'
  }

  updateDisplay(machine: ZMachine): void {
    super.updateDisplay(machine);
    // Force screen update - usually a no-op in console
  }

  getCurrentFont(machine: ZMachine): number {
    return super.getCurrentFont(machine);
  }

  setFont(machine: ZMachine, font: number): boolean {
    return super.setFont(machine, font);
  }

  getFontForWindow(machine: ZMachine, window: number): number {
    return super.getFontForWindow(machine, window);
  }

  setFontForWindow(machine: ZMachine, font: number, window: number): boolean {
    return super.setFontForWindow(machine, font, window);
  }

  getWindowTrueForeground(machine: ZMachine, window: number): number {
    return super.getWindowTrueForeground(machine, window);
  }

  getWindowTrueBackground(machine: ZMachine, window: number): number {
    return super.getWindowTrueBackground(machine, window);
  }

  getWindowProperty(machine: ZMachine, window: number, property: number): number {
    return super.getWindowProperty(machine, window, property);
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
    // Restore terminal state before exiting
    process.stdout.write('\x1b[?25h'); // Show cursor
    process.stdout.write('\x1b[0m'); // Reset colors/styles
    process.exit(0);
  }
}
