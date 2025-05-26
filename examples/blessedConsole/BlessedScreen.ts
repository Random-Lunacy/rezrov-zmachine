/* eslint-disable @typescript-eslint/no-unused-vars */
import * as blessed from 'blessed';
import { BaseScreen, BufferMode, Capabilities, Color, ScreenSize, TextStyle, ZMachine } from '../../dist/index.js';

export class BlessedScreen extends BaseScreen {
  private screen: blessed.Widgets.Screen;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private statusWindow: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mainWindow: any;
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
    const targetWindow = this.currentWindow === 0 ? this.mainWindow : this.statusWindow;

    // Skip common input prompts - we have a dedicated input box
    if (this.shouldSkipPrompt(str)) {
      return;
    }

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

  private shouldSkipPrompt(str: string): boolean {
    // Trim whitespace and check for common prompts
    const trimmed = str.trim();

    // Common Z-Machine prompts
    if (trimmed === '>') return true;
    if (trimmed === '> ') return true;
    if (trimmed === '\n>') return true;
    if (trimmed === '\n> ') return true;

    // Handle prompts that might have leading/trailing whitespace or newlines
    if (/^\s*>\s*$/.test(str)) return true;

    return false;
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

  // Expose the blessed screen for use by input processor
  getBlessedScreen(): blessed.Widgets.Screen {
    return this.screen;
  }
}
