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
   * Accounts for upper window height and scroll region in V4+ games.
   */
  protected initializeOutputPosition(): void {
    if (!this.startFromBottom || this.hasReceivedFirstOutput) return;

    const { rows } = this.getSize();
    // Position cursor near bottom of the scroll region (leave room for input line)
    // Use ANSI escape for positioning within scroll region (1-indexed)
    const targetRow = rows - 1; // Near bottom, leave 1 line for input
    process.stdout.write(`\x1b[${targetRow};1H`);
  }

  print(machine: ZMachine, str: string): void {
    // Check if memory stream (stream 3) is active - if so, write to memory only
    if (this.isMemoryStreamActive()) {
      this.writeToMemoryStream(machine, str);
      return; // Don't output to screen when memory stream is active
    }

    // Translate Font 3 characters to Unicode if Font 3 is active
    let textToDisplay = str;
    if (this.isCurrentFontFont3()) {
      textToDisplay = translateFont3Text(str);
    }

    if (this.outputWindowId === 0) {
      // Main window output
      // Initialize bottom-aligned output on first print to main window
      if (!this.hasReceivedFirstOutput && this.startFromBottom) {
        this.initializeOutputPosition();
        this.hasReceivedFirstOutput = true;
      }

      textToDisplay = this.applyStyles(textToDisplay);
      textToDisplay = this.applyColors(textToDisplay);
      process.stdout.write(textToDisplay);
    } else {
      // Upper window - use BaseScreen's buffer management for V4+ games
      const screenWidth = this.getSize().cols;
      this.writeToUpperWindowBuffer(textToDisplay, screenWidth);
      this.renderUpperWindow();
    }
  }

  /**
   * Render the upper window buffer to the terminal.
   * Used by V4+ games that write their own status bar content.
   */
  private renderUpperWindow(): void {
    if (this.upperWindowBuffer.length === 0) return;

    const { rows } = this.getSize();
    const screenWidth = this.getSize().cols;

    // Save cursor position
    process.stdout.write('\x1b7');

    // Temporarily reset scroll region to access upper window area
    process.stdout.write('\x1b[r');

    // Render each line of the upper window
    for (let i = 0; i < this.upperWindowBuffer.length; i++) {
      // Move to the correct line (1-based for ANSI)
      process.stdout.write(`\x1b[${i + 1};1H`);
      // Clear the line
      process.stdout.write('\x1b[K');

      // Get the line content and pad to screen width
      let lineContent = this.upperWindowBuffer[i] || '';
      lineContent = lineContent.padEnd(screenWidth, ' ');

      // Apply inverse video for status bar effect
      process.stdout.write(chalk.inverse(lineContent));
    }

    // Restore scroll region to exclude upper window
    if (this.upperWindowHeight > 0) {
      const topLine = this.upperWindowHeight + 1;
      process.stdout.write(`\x1b[${topLine};${rows}r`);
    }

    // Restore cursor position
    process.stdout.write('\x1b8');
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

  /**
   * Set the terminal scroll region to exclude the upper window.
   * This prevents the status bar from scrolling off screen when lower window content scrolls.
   */
  private setScrollRegion(): void {
    const { rows } = this.getSize();
    if (this.upperWindowHeight > 0) {
      // Set scroll region from line after upper window to bottom of screen (1-indexed)
      const topLine = this.upperWindowHeight + 1;
      process.stdout.write(`\x1b[${topLine};${rows}r`);
      // Position cursor within the scroll region
      process.stdout.write(`\x1b[${topLine};1H`);
    } else {
      // Reset to full screen scrolling
      process.stdout.write('\x1b[r');
    }
  }

  // Implement the rest of the Screen interface methods
  splitWindow(machine: ZMachine, lines: number): void {
    const oldHeight = this.upperWindowHeight;
    super.splitWindow(machine, lines);

    const { rows } = this.getSize();
    const screenWidth = this.getSize().cols;

    // If upper window is newly created or resized
    if (this.upperWindowHeight !== oldHeight) {
      // Save cursor position
      process.stdout.write('\x1b7');

      if (this.upperWindowHeight > 0) {
        // Clear and initialize the upper window area
        for (let i = 0; i < this.upperWindowHeight; i++) {
          process.stdout.write(`\x1b[${i + 1};1H`);
          process.stdout.write('\x1b[K');
          // Fill with spaces in inverse video for status bar appearance
          process.stdout.write(chalk.inverse(''.padEnd(screenWidth, ' ')));
        }

        // Set up scroll region to exclude upper window
        const topLine = this.upperWindowHeight + 1;
        process.stdout.write(`\x1b[${topLine};${rows}r`);

        // Position cursor at start of lower window (within scroll region)
        process.stdout.write(`\x1b[${topLine};1H`);
      } else {
        // Upper window removed - reset to full screen scrolling
        process.stdout.write('\x1b[r');
      }

      // Restore cursor position (but stay within scroll region bounds)
      process.stdout.write('\x1b8');
    }
  }

  clearWindow(machine: ZMachine, windowId: number): void {
    super.clearWindow(machine, windowId);

    const { rows } = this.getSize();
    const screenWidth = this.getSize().cols;

    if (windowId === -1) {
      // Clear all windows - reset scroll region first
      process.stdout.write('\x1b[r');
      process.stdout.cursorTo(0, 0);
      process.stdout.clearScreenDown();
    } else if (windowId === 0) {
      // Clear main window (lower window)
      // Position at start of lower window (within scroll region) and clear
      const startRow = this.upperWindowHeight; // 0-indexed for cursorTo
      process.stdout.cursorTo(0, startRow);
      process.stdout.clearScreenDown();
    } else if (windowId === 1) {
      // Clear upper window
      // Save cursor position
      process.stdout.write('\x1b7');

      // Temporarily reset scroll region to access upper window
      process.stdout.write('\x1b[r');

      // Clear each line of the upper window
      for (let i = 0; i < this.upperWindowHeight; i++) {
        process.stdout.write(`\x1b[${i + 1};1H`);
        process.stdout.write('\x1b[K');
        // Fill with spaces in inverse video to maintain status bar appearance
        process.stdout.write(chalk.inverse(''.padEnd(screenWidth, ' ')));
      }

      // Restore scroll region
      if (this.upperWindowHeight > 0) {
        const topLine = this.upperWindowHeight + 1;
        process.stdout.write(`\x1b[${topLine};${rows}r`);
      }

      // Restore cursor position
      process.stdout.write('\x1b8');
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
    const { rows } = this.getSize();
    const width = this.getSize().cols;

    // Save cursor position
    process.stdout.write('\x1b7');

    // Temporarily reset scroll region to access status bar area
    process.stdout.write('\x1b[r');

    // Move cursor to top-left before writing status bar
    process.stdout.write('\x1b[H');

    // Use BaseScreen's formatStatusBarLine() helper for consistent formatting
    const statusLine = this.formatStatusBarLine(locationName, value1, value2, isTimeMode, width);

    this.logger.debug(`Updating status bar: ${statusLine}`);

    // Write the status line with inverse video (no newline - just overwrite line 1)
    process.stdout.write('\x1b[K' + chalk.inverse(statusLine));

    // Restore scroll region (status bar is always 1 line for V3 show_status)
    process.stdout.write(`\x1b[2;${rows}r`);

    // Restore cursor position
    process.stdout.write('\x1b8');
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
    super.enableOutputStream(machine, streamId, table, width);
  }

  disableOutputStream(machine: ZMachine, streamId: number, table: number, width: number): void {
    super.disableOutputStream(machine, streamId, table, width);
  }

  selectInputStream(machine: ZMachine, streamId: number): void {
    this.logger.debug(`selectInputStream: ${streamId}`);
  }

  quit(): void {
    // Restore terminal state before exiting
    process.stdout.write('\x1b[r'); // Reset scroll region
    process.stdout.write('\x1b[?25h'); // Show cursor
    process.stdout.write('\x1b[0m'); // Reset colors/styles
    process.exit(0);
  }
}
