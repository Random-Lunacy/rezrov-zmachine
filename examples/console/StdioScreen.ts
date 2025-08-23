/* eslint-disable @typescript-eslint/no-unused-vars */
import chalk from 'chalk';
import { BaseScreen, BufferMode, Capabilities, Color, ScreenSize, TextStyle, ZMachine } from '../../dist/index.js';

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

    // Handle missing location
    const lhs = locationName || '[No Location]';

    // Format right-hand side based on mode
    let rhs: string;
    if (isTimeMode) {
      // Format as 12-hour time with AM/PM
      const hours = value1;
      const minutes = value2;

      // Handle invalid time values
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        rhs = '??:??';
      } else {
        const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
        const ampm = hours < 12 ? 'AM' : 'PM';
        rhs = `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
      }
    } else {
      rhs = `Score: ${value1} Moves: ${value2}`;
    }

    const width = this.getSize().cols;
    const padding = width - lhs.length - rhs.length - 2;

    this.logger.debug(`Updating status bar: ${lhs} | ${rhs} (padding: ${padding})`);

    if (padding >= 0) {
      const statusLine = `${chalk.inverse(lhs + ' '.repeat(padding) + rhs)}`;
      process.stdout.write('\r\x1b[K' + statusLine + '\n');
    } else {
      // Not enough space, truncate left side
      const maxLhsLength = width - rhs.length - 3; // 3 for "..."
      if (maxLhsLength > 0) {
        const truncatedLhs = lhs.substring(0, maxLhsLength) + '...';
        const statusLine = chalk.inverse(`${truncatedLhs}${rhs}`);
        process.stdout.write('\r\x1b[K' + statusLine + '\n');
      } else {
        // RHS is too long, just show what fits
        const statusLine = chalk.inverse(rhs.substring(0, width));
        process.stdout.write('\r\x1b[K' + statusLine + '\n');
      }
    }

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
    process.exit(0);
  }
}
