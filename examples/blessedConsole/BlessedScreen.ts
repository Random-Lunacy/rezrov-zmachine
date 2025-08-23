/* eslint-disable @typescript-eslint/no-unused-vars */
import * as blessed from 'blessed';
import { BaseScreen, BufferMode, Capabilities, Color, ScreenSize, TextStyle, ZMachine } from '../../dist/index.js';

export class BlessedScreen extends BaseScreen {
  private screen: blessed.Widgets.Screen;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private statusWindow: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mainWindow: any;
  private textStyle: number = TextStyle.Roman;

  constructor() {
    super('BlessedScreen', { logger: undefined });

    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Z-Machine',
      cursor: {
        artificial: true,
        shape: 'line',
        blink: true,
        color: 'default',
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

    // Handle exit on Ctrl+C
    this.screen.program.key(['C-c'], () => {
      this.quit();
      return false; // Prevent further processing
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
    const targetWindow = this.outputWindowId === 0 ? this.mainWindow : this.statusWindow;

    // Apply text styling and colors
    const styledText = this.applyStylesAndColors(str);

    if (this.outputWindowId === 0) {
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
    if (this.currentStyles & TextStyle.Bold) {
      result = `{bold}${result}{/bold}`;
    }
    if (this.currentStyles & TextStyle.Italic) {
      result = `{italic}${result}{/italic}`;
    }
    if (this.currentStyles & TextStyle.ReverseVideo) {
      result = `{inverse}${result}{/inverse}`;
    }

    // Apply colors
    const windowColors = this.windowColors.get(this.outputWindowId);
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

  // Override setTextStyle to update our local textStyle for styling
  setTextStyle(machine: ZMachine, style: number): void {
    super.setTextStyle(machine, style);
    this.textStyle = style; // Keep local copy for styling
  }

  // Override setTextColors to ensure our styling works
  setTextColors(machine: ZMachine, window: number, foreground: number, background: number): void {
    super.setTextColors(machine, window, foreground, background);

    // Apply colors to the window immediately
    const targetWindow = window === 0 ? this.mainWindow : this.statusWindow;
    const fgColor = this.mapZMachineColor(foreground);
    const bgColor = this.mapZMachineColor(background);

    if (fgColor || bgColor) {
      targetWindow.style.fg = fgColor || targetWindow.style.fg;
      targetWindow.style.bg = bgColor || targetWindow.style.bg;
      this.screen.render();
    }
  }

  // Override splitWindow to use BaseScreen's v5 logic and update blessed windows
  splitWindow(machine: ZMachine, lines: number): void {
    super.splitWindow(machine, lines);

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

  // Override clearWindow to use BaseScreen's v5 logic and update blessed windows
  clearWindow(machine: ZMachine, windowId: number): void {
    super.clearWindow(machine, windowId);

    if (windowId === 0 || windowId === -1) {
      this.mainWindow.setContent('');
    }
    if (windowId === 1 || windowId === -1) {
      this.statusWindow.setContent('');
    }
    this.screen.render();
  }

  // Override clearLine to use BaseScreen's v5 logic
  clearLine(machine: ZMachine, value: number): void {
    super.clearLine(machine, value);

    const targetWindow = this.outputWindowId === 0 ? this.mainWindow : this.statusWindow;
    // Clear current line - simplified implementation
    const content = targetWindow.getContent();
    const lines = content.split('\n');
    if (lines.length > 0) {
      lines[lines.length - 1] = '';
      targetWindow.setContent(lines.join('\n'));
      this.screen.render();
    }
  }

  // Override setCursorPosition to use BaseScreen's v5 logic
  setCursorPosition(machine: ZMachine, line: number, column: number, windowId: number): void {
    super.setCursorPosition(machine, line, column, windowId);
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

  updateStatusBar(locationName: string | null, value1: number, value2: number, isTimeMode: boolean): void {
    // Handle missing location
    const lhs = locationName || '[No Location]'; // Or whatever placeholder you prefer

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
      // Format as score/moves (negative scores allowed)
      rhs = `Score: ${value1} Moves: ${value2}`;
    }

    // Use existing layout logic
    const width = this.getSize().cols;
    const padding = Math.max(0, width - lhs.length - rhs.length);
    const statusLine = lhs + ' '.repeat(padding) + rhs;
    this.statusWindow.setContent(statusLine);
    this.screen.render();
  }

  updateDisplay(machine: ZMachine): void {
    super.updateDisplay(machine);
    this.screen.render();
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
    // Use BaseScreen's implementation for most properties
    const baseValue = super.getWindowProperty(machine, window, property);
    if (baseValue !== 0) {
      return baseValue;
    }

    // Fall back to blessed-specific implementations for some properties
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
    // Restore terminal cursor state before destroying
    this.screen.cursor.shape = 'line';
    this.screen.cursor.blink = true;
    this.screen.cursor.artificial = false;

    // Destroy the blessed screen
    this.screen.destroy();

    // Restore terminal to normal mode
    process.stdout.write('\x1b[?25h'); // Show cursor
    process.stdout.write('\x1b[0m');    // Reset colors
    process.stdout.write('\x1b[2J');    // Clear screen

    process.exit(0);
  }

  // Expose the blessed screen for use by input processor
  getBlessedScreen(): blessed.Widgets.Screen {
    return this.screen;
  }

  getMainWindow(): any {
    return this.mainWindow;
  }
}
