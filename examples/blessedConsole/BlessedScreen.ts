/* eslint-disable @typescript-eslint/no-unused-vars */
import * as blessed from 'blessed';
import {
  BaseScreen,
  Capabilities,
  Color,
  ScreenSize,
  TextStyle,
  translateFont3Text,
  ZMachine,
} from '../../dist/index.js';

export class BlessedScreen extends BaseScreen {
  private screen: blessed.Widgets.Screen;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private statusWindow: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mainWindow: any;
  private textStyle: number = TextStyle.Roman;

  // Callback to update Z-machine header when screen dimensions change
  private onResizeCallback: ((cols: number, rows: number) => void) | null = null;
  private lastReportedCols: number = 0;
  private lastReportedRows: number = 0;

  // Mouse state for Beyond Zork support
  private mouseEnabled: boolean = true;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private lastMouseButton: number = 0;
  private mouseClickCallback: ((x: number, y: number, button: number) => void) | null = null;

  // Raw content buffer for main window - needed because blessed's getContent() returns
  // rendered text without tags, so we can't append new tagged content to it
  private mainWindowContent: string = '';

  constructor() {
    super('BlessedScreen', { logger: undefined });

    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Z-Machine',
      mouse: true, // Enable mouse support for Beyond Zork
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
      wrap: false, // Don't wrap text - clip at edge instead
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

    // Set up mouse event handling for Beyond Zork map support
    this.setupMouseHandling();

    // Listen for resize events to update Z-machine header when dimensions change
    // Listen for terminal resize events
    // Try both blessed's resize event and Node's stdout resize
    const handleResize = () => {
      const cols = this.screen.width as number;
      const rows = this.screen.height as number;

      // Only trigger if dimensions are valid and changed
      if (cols > 10 && rows > 5 && (cols !== this.lastReportedCols || rows !== this.lastReportedRows)) {
        this.lastReportedCols = cols;
        this.lastReportedRows = rows;
        if (this.onResizeCallback) {
          this.onResizeCallback(cols, rows);
        }

        // Resize and redraw the status bar to match new width
        this.resizeStatusBar(cols);
      }
    };

    this.screen.on('resize', handleResize);
    process.stdout.on('resize', handleResize);

    this.screen.render();
  }

  /**
   * Set a callback to be called when screen dimensions become available or change.
   * Used to update Z-machine header with correct screen dimensions.
   */
  setResizeCallback(callback: (cols: number, rows: number) => void): void {
    this.onResizeCallback = callback;

    // If dimensions are already valid, call immediately
    const cols = this.screen.width as number;
    const rows = this.screen.height as number;
    if (cols > 10 && rows > 5) {
      this.lastReportedCols = cols;
      this.lastReportedRows = rows;
      callback(cols, rows);
    }
  }

  /**
   * Set up mouse event handling for clickable elements
   * Beyond Zork uses mouse clicks on the map for navigation
   */
  private setupMouseHandling(): void {
    // Handle mouse clicks on the main window
    this.mainWindow.on('click', (data: { x: number; y: number; button: string }) => {
      if (!this.mouseEnabled) return;

      // Convert blessed coordinates to 1-based Z-machine coordinates
      // Account for window position
      const x = data.x + 1;
      const y = data.y - (this.mainWindow.top as number) + 1;
      const button = data.button === 'left' ? 1 : data.button === 'right' ? 2 : data.button === 'middle' ? 3 : 0;

      this.lastMouseX = x;
      this.lastMouseY = y;
      this.lastMouseButton = button;

      this.logger.debug(`Mouse click: x=${x}, y=${y}, button=${button}`);

      // Call the callback if set
      if (this.mouseClickCallback) {
        this.mouseClickCallback(x, y, button);
      }
    });

    // Handle mouse clicks on the status window (upper window)
    this.statusWindow.on('click', (data: { x: number; y: number; button: string }) => {
      if (!this.mouseEnabled) return;

      const x = data.x + 1;
      const y = data.y + 1;
      const button = data.button === 'left' ? 1 : data.button === 'right' ? 2 : data.button === 'middle' ? 3 : 0;

      this.lastMouseX = x;
      this.lastMouseY = y;
      this.lastMouseButton = button;

      this.logger.debug(`Mouse click (status): x=${x}, y=${y}, button=${button}`);

      if (this.mouseClickCallback) {
        this.mouseClickCallback(x, y, button);
      }
    });
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
    const blessedCols = this.screen.width as number;
    const blessedRows = this.screen.height as number;

    // Blessed reports 1x1 during early initialization before it determines
    // actual terminal dimensions. Use sensible defaults in that case to avoid
    // breaking cursor positioning and text formatting.
    const cols = blessedCols > 10 ? blessedCols : 80;
    const rows = blessedRows > 5 ? blessedRows : 25;

    // If blessed now reports valid dimensions that differ from what we last reported,
    // trigger the resize callback to update the Z-machine header
    if (blessedCols > 10 && blessedRows > 5) {
      if (blessedCols !== this.lastReportedCols || blessedRows !== this.lastReportedRows) {
        this.lastReportedCols = blessedCols;
        this.lastReportedRows = blessedRows;
        if (this.onResizeCallback) {
          this.onResizeCallback(blessedCols, blessedRows);
        }
      }
    }

    return { rows, cols };
  }

  /**
   * Initialize output position for bottom-aligned text.
   * Pre-fills the main window with empty lines so first content appears at bottom.
   */
  protected initializeOutputPosition(): void {
    if (!this.startFromBottom || this.hasReceivedFirstOutput) return;

    const { rows } = this.getSize();
    const statusHeight = this.statusWindow.height as number;
    const visibleHeight = rows - statusHeight;

    // Pre-fill with newlines so first content appears at bottom
    this.mainWindowContent = '\n'.repeat(Math.max(0, visibleHeight - 1));
    this.mainWindow.setContent(this.mainWindowContent);
    this.mainWindow.setScrollPerc(100);
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
      // Initialize bottom-aligned output on first print to main window
      if (!this.hasReceivedFirstOutput && this.startFromBottom) {
        this.initializeOutputPosition();
        this.hasReceivedFirstOutput = true;
      }

      // Main window - append and scroll
      const styledText = this.applyStylesAndColors(textToDisplay);
      // Use our raw content buffer instead of getContent() which strips tags
      this.mainWindowContent += styledText;
      this.mainWindow.setContent(this.mainWindowContent);
      this.mainWindow.setScrollPerc(100);
    } else {
      // Upper window - use BaseScreen's buffer management
      const screenWidth = this.getSize().cols;
      const combinedContent = this.writeToUpperWindowBuffer(textToDisplay, screenWidth);
      const styledText = this.applyStylesAndColors(combinedContent);
      this.statusWindow.setContent(styledText);
    }

    this.screen.render();
  }

  private applyStylesAndColors(str: string): string {
    let result = str;

    // Apply text styles using blessed tags (or ANSI escapes where blessed doesn't support)
    if (this.currentStyles & TextStyle.Bold) {
      result = `{bold}${result}{/bold}`;
    }
    if (this.currentStyles & TextStyle.Italic) {
      // Blessed doesn't support italic - use underline as visual emphasis fallback
      result = `{underline}${result}{/underline}`;
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
    // Standard Z-machine colors (0-15)
    switch (color) {
      case Color.Current:
        return null; // Keep current color
      case Color.Default:
        return null; // Use default color
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
    }

    // Z-machine true colors (values > 15)
    // Encoded as 15-bit RGB: 0bBBBBB_GGGGG_RRRRR
    if (color > 15) {
      return this.trueColorToHex(color);
    }

    // Reserved colors 11-15 (not yet standardized)
    this.logger.debug(`Reserved color ${color}, using default`);
    return null;
  }

  /**
   * Resize the status bar buffer to match new screen width and redraw.
   * Called when terminal is resized to immediately update the display.
   */
  private resizeStatusBar(newWidth: number): void {
    const resizedContent = this.resizeUpperWindowBuffer(newWidth);
    if (resizedContent === null) return;

    // Redraw the status window with resized buffer
    const styledText = this.applyStylesAndColors(resizedContent);
    this.statusWindow.setContent(styledText);
    this.screen.render();
  }

  // Override setTextStyle to update our local textStyle for styling
  setTextStyle(machine: ZMachine, style: number): void {
    super.setTextStyle(machine, style);
    this.textStyle = style; // Keep local copy for styling
  }

  // Override setTextColors to ensure our styling works
  setTextColors(machine: ZMachine, window: number, foreground: number, background: number): void {
    super.setTextColors(machine, window, foreground, background);

    // Get the resolved colors from windowColors (handles Color.Current properly)
    const resolvedColors = this.windowColors.get(window);
    if (!resolvedColors) return;

    // Apply colors to the window immediately
    const targetWindow = window === 0 ? this.mainWindow : this.statusWindow;
    const fgColor = this.mapZMachineColor(resolvedColors.foreground);
    const bgColor = this.mapZMachineColor(resolvedColors.background);

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
    super.clearWindow(machine, windowId); // BaseScreen clears upperWindowBuffer

    this.logger.debug(`BlessedScreen.clearWindow called with windowId=${windowId}`);

    if (windowId === 0 || windowId === -1) {
      this.logger.debug(`Clearing main window (current content length: ${this.mainWindow.getContent().length})`);
      // Clear both the content buffer and blessed content
      this.mainWindowContent = '';
      this.mainWindow.setContent('');
      this.mainWindow.setScrollPerc(0);
      this.logger.debug(`Main window after clear (content length: ${this.mainWindow.getContent().length})`);
    }
    if (windowId === 1 || windowId === -1) {
      this.statusWindow.setContent('');
    }
    this.screen.render();
  }

  // Override clearLine to use BaseScreen's v5 logic
  clearLine(machine: ZMachine, value: number): void {
    super.clearLine(machine, value);

    if (this.outputWindowId === 0) {
      // Main window - use our raw content buffer
      const lines = this.mainWindowContent.split('\n');
      if (lines.length > 0) {
        lines[lines.length - 1] = '';
        this.mainWindowContent = lines.join('\n');
        this.mainWindow.setContent(this.mainWindowContent);
        this.screen.render();
      }
    } else {
      // Upper window - use getContent() as before
      const content = this.statusWindow.getContent();
      const lines = content.split('\n');
      if (lines.length > 0) {
        lines[lines.length - 1] = '';
        this.statusWindow.setContent(lines.join('\n'));
        this.screen.render();
      }
    }
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
    const width = this.getSize().cols;
    const statusLine = this.formatStatusBarLine(locationName, value1, value2, isTimeMode, width);
    this.statusWindow.setContent(statusLine);
    this.screen.render();
  }

  updateDisplay(machine: ZMachine): void {
    super.updateDisplay(machine);
    this.screen.render();
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
    process.stdout.write('\x1b[0m'); // Reset colors
    process.stdout.write('\x1b[2J'); // Clear screen

    process.exit(0);
  }

  // Expose the blessed screen for use by input processor
  getBlessedScreen(): blessed.Widgets.Screen {
    return this.screen;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getMainWindow(): any {
    return this.mainWindow;
  }

  /**
   * Get the current main window content buffer.
   * Used by BlessedInputProcessor to synchronize input display with the content buffer.
   */
  getMainWindowContent(): string {
    return this.mainWindowContent;
  }

  /**
   * Set the main window content buffer and update the display.
   * Used by BlessedInputProcessor to synchronize input display with the content buffer.
   */
  setMainWindowContent(content: string): void {
    this.mainWindowContent = content;
    this.mainWindow.setContent(this.mainWindowContent);
  }

  /**
   * Get the last recorded mouse position and button
   * Used by read_mouse opcode
   */
  getMouseState(): { x: number; y: number; button: number } {
    return {
      x: this.lastMouseX,
      y: this.lastMouseY,
      button: this.lastMouseButton,
    };
  }

  /**
   * Set a callback to be called when a mouse click occurs
   * Used by Beyond Zork for map navigation
   */
  setMouseClickCallback(callback: ((x: number, y: number, button: number) => void) | null): void {
    this.mouseClickCallback = callback;
  }

  /**
   * Enable or disable mouse handling
   */
  setMouseEnabled(enabled: boolean): void {
    this.mouseEnabled = enabled;
  }

  /**
   * Check if mouse handling is enabled
   */
  isMouseEnabled(): boolean {
    return this.mouseEnabled;
  }

  /**
   * Get the status window for multi-window support
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getStatusWindow(): any {
    return this.statusWindow;
  }
}
