/* eslint-disable @typescript-eslint/no-unused-vars */
import { ZMachine } from '../../interpreter/ZMachine';
import { BufferMode, Color, TextStyle } from '../../types';
import { Logger } from '../../utils/log';
import { FontManager, FontType } from '../fonts';
import { InputState } from '../input/InputInterface';
import { Capabilities, Screen, ScreenSize, WindowProperty, WindowType } from './interfaces';
import { WindowManager } from './WindowManager';

/**
 * BaseScreen class
 * This class provides a base implementation for the Screen interface.
 * It includes version-aware implementations for v3 and v5 story files,
 * with proper window management, text styling, and cursor positioning.
 */
export class BaseScreen implements Screen {
  protected logger: Logger;
  protected id: string;
  protected currentStyles: number;
  protected outputWindowId: number = WindowType.Lower;
  protected bufferMode: number = BufferMode.Buffered;
  protected upperWindowHeight: number = 0;
  protected cursorPosition: { line: number; column: number } = { line: 1, column: 1 };
  protected windowCursors: Map<number, { line: number; column: number }> = new Map();
  protected windowColors: Map<number, { foreground: number; background: number }> = new Map();
  protected windowFonts: Map<number, number> = new Map();
  protected fontManager: FontManager;
  protected windowManager: WindowManager;

  // Output stream 3 (memory stream) state - can be nested up to 16 levels
  protected memoryStreamStack: Array<{ table: number; width: number }> = [];

  // Upper window buffer for V5+ games that write directly using cursor positioning
  // Stores characters at specific positions, one string per line
  protected upperWindowBuffer: string[] = [];

  // Parallel style buffer: stores the active TextStyle bitmask per character position
  protected upperWindowStyleBuffer: number[][] = [];

  // Bottom-aligned output configuration
  // When true, initial output starts at bottom of screen and scrolls up
  protected startFromBottom: boolean = true;
  protected hasReceivedFirstOutput: boolean = false;

  /**
   * Constructor for BaseScreen
   * @param id The screen ID
   * @param options Optional options
   */
  constructor(id: string, options?: { logger?: Logger; startFromBottom?: boolean }) {
    this.logger = options?.logger || new Logger(id ?? 'BaseScreen');
    this.id = id;
    this.currentStyles = TextStyle.Roman;
    this.fontManager = FontManager.getInstance();
    this.windowManager = new WindowManager(this.logger);
    this.startFromBottom = options?.startFromBottom ?? true;

    // Initialize default colors for both windows
    this.windowColors.set(WindowType.Lower, { foreground: Color.Default, background: Color.Default });
    this.windowColors.set(WindowType.Upper, { foreground: Color.Default, background: Color.Default });

    // Initialize default fonts for both windows
    this.windowFonts.set(WindowType.Lower, 1);
    this.windowFonts.set(WindowType.Upper, 1);

    // Initialize per-window cursor positions (1-based, matching Infocom behavior)
    this.windowCursors.set(WindowType.Lower, { line: 1, column: 1 });
    this.windowCursors.set(WindowType.Upper, { line: 1, column: 1 });
  }

  /**
   * Get the capabilities of the screen
   * @returns The capabilities
   */
  getCapabilities(): Capabilities {
    this.logger.debug(`not implemented: ${this.id} getCapabilities`);
    return {
      hasColors: false,
      hasBold: false,
      hasItalic: false,
      hasReverseVideo: false,
      hasFixedPitch: false,
      hasSplitWindow: false,
      hasDisplayStatusBar: false,
      hasPictures: false,
      hasSound: false,
      hasTimedKeyboardInput: false,
    };
  }

  /**
   * Get window property with version-aware behavior
   */
  getWindowProperty(machine: ZMachine, window: number, property: number): number {
    // Use BaseScreen's own tracked state as the source of truth.
    // The WindowManager's state can be stale (e.g., cursor position is only updated
    // in BaseScreen.cursorPosition, not in WindowManager's window state).
    const screenSize = this.getSize();
    switch (property) {
      case WindowProperty.YCoordinate:
        // y-coordinate of top of window (1-based)
        if (window === WindowType.Upper) {
          return 1;
        } else {
          return this.upperWindowHeight + 1;
        }

      case WindowProperty.XCoordinate:
        // x-coordinate of left of window (1-based)
        return 1;

      case WindowProperty.YSize:
        // Height of window in units
        if (window === WindowType.Upper) {
          return this.upperWindowHeight;
        } else {
          return screenSize.rows - this.upperWindowHeight;
        }

      case WindowProperty.XSize:
        // Width of window in units
        return screenSize.cols;

      case WindowProperty.YCursor:
        return this.cursorPosition.line;

      case WindowProperty.XCursor:
        return this.cursorPosition.column;

      case WindowProperty.LeftMargin:
        return 0; // Margin size (0 = no margin)

      case WindowProperty.RightMargin:
        return 0; // Margin size (0 = no margin)

      case WindowProperty.TextStyle:
        return this.currentStyles;

      case WindowProperty.ColorData: {
        const colors = this.windowColors.get(window);
        if (!colors) return 0;
        // Pack foreground and background into a single value
        return (colors.foreground << 8) | colors.background;
      }

      case WindowProperty.Font:
        return this.windowFonts.get(window) || 1;

      case WindowProperty.FontSize:
        // Font size: height in top byte, width in bottom byte
        return (1 << 8) | 1;

      case WindowProperty.Attributes:
        return 0;

      case WindowProperty.LineCount:
        if (window === WindowType.Upper) {
          return this.upperWindowHeight;
        } else {
          return screenSize.rows - this.upperWindowHeight;
        }

      default:
        this.logger.debug(`not implemented: ${this.id} getWindowProperty window=${window} property=${property}`);
        return 0;
    }
  }

  getSize(): ScreenSize {
    this.logger.debug(`not implemented: ${this.id} getSize`);
    // Default size for the screen
    return { rows: 25, cols: 80 };
  }

  getInputFromUser(machine: ZMachine, inputState: InputState): void {
    this.logger.debug(`not implemented: ${this.id} getInputFromUser`);
  }

  getKeyFromUser(machine: ZMachine, inputState: InputState): void {
    this.logger.debug(`not implemented: ${this.id} getKeyFromUser`);
  }

  print(machine: ZMachine, str: string): void {
    this.logger.debug(`not implemented: ${this.id} print`);
  }

  /**
   * Initialize output position for bottom-aligned text.
   * Called on first output when startFromBottom is enabled.
   * Subclasses should override to implement platform-specific positioning.
   */
  protected initializeOutputPosition(): void {
    // Default implementation - subclasses override for specific behavior
  }

  /**
   * Split window with version-aware behavior
   * V3: Upper window is cleared when split occurs
   * V5: Upper window is NOT cleared when split occurs
   */
  splitWindow(machine: ZMachine, lines: number): void {
    const version = machine.state.version;
    const oldHeight = this.upperWindowHeight;

    // V5+ allows the upper window to cover the full screen (for title pages, etc.)
    this.upperWindowHeight = Math.max(0, Math.min(lines, this.getSize().rows));

    // Use WindowManager for advanced window management
    this.windowManager.splitWindow(this.upperWindowHeight);

    if (version <= 3) {
      // V3: Clear upper window when split occurs
      if (this.upperWindowHeight > 0 && oldHeight === 0) {
        this.clearWindow(machine, WindowType.Upper);
      }
    }
    // V5: Upper window is not cleared on split

    this.logger.debug(`${this.id} splitWindow lines=${lines} (version ${version})`);
  }

  setOutputWindow(machine: ZMachine, windowId: number): void {
    const version = machine.state.version;

    // Save current window's cursor position before switching
    // (matches Infocom interpreter behavior: ZSCRN saves OLD0X/OLD0Y per window)
    this.windowCursors.set(this.outputWindowId, { ...this.cursorPosition });

    if (windowId === WindowType.Upper && version <= 3) {
      // V3: Reset cursor to top-left when selecting upper window
      this.cursorPosition = { line: 1, column: 1 };
    } else {
      // V4+: Restore target window's saved cursor position
      const savedCursor = this.windowCursors.get(windowId);
      if (savedCursor) {
        this.cursorPosition = { ...savedCursor };
      }
    }

    this.outputWindowId = windowId;

    // Sync fontManager to the target window's font so isCurrentFontFont3() is correct
    const windowFont = this.windowFonts.get(windowId) || 1;
    this.fontManager.setCurrentFont(windowFont as FontType);

    // Use WindowManager for advanced window management
    this.windowManager.setOutputWindow(windowId);

    this.logger.debug(`${this.id} setOutputWindow windowId=${windowId} (version ${version})`);
  }

  getOutputWindow(_machine: ZMachine): number {
    return this.outputWindowId;
  }

  /**
   * Clear window with version-aware behavior
   * V5: Cursor moves to top-left for any erased window
   */
  clearWindow(machine: ZMachine, windowId: number): void {
    const version = machine.state.version;

    if (windowId === -1) {
      // Per spec: unsplit screen, clear all, select lower window, cursor to top-left
      this.upperWindowHeight = 0;
      this.outputWindowId = WindowType.Lower;
      this.cursorPosition = { line: 1, column: 1 };
      this.windowCursors.set(WindowType.Lower, { line: 1, column: 1 });
      this.windowCursors.set(WindowType.Upper, { line: 1, column: 1 });
      this.upperWindowBuffer = [];
      this.upperWindowStyleBuffer = [];
      // Reset for bottom-aligned output on next print
      this.hasReceivedFirstOutput = false;
    } else if (windowId === -2) {
      // Per spec: clear all windows but don't unsplit, don't change active window
      this.upperWindowBuffer = [];
      this.upperWindowStyleBuffer = [];
      this.cursorPosition = { line: 1, column: 1 };
      this.windowCursors.set(WindowType.Lower, { line: 1, column: 1 });
      this.windowCursors.set(WindowType.Upper, { line: 1, column: 1 });
      this.hasReceivedFirstOutput = false;
    } else if (windowId === WindowType.Upper) {
      this.upperWindowBuffer = [];
      this.upperWindowStyleBuffer = [];
      if (version >= 5) {
        this.cursorPosition = { line: 1, column: 1 };
      }
    } else if (windowId === WindowType.Lower) {
      // V5: Cursor moves to top-left for the erased window.
      // The lower window cursor is managed by the terminal (blessed appends text),
      // so we do NOT reset cursorPosition here - that tracks the upper window cursor.
      // Reset for bottom-aligned output on next print
      this.hasReceivedFirstOutput = false;
    }

    this.logger.debug(`${this.id} clearWindow windowId=${windowId} (version ${version})`);
  }

  /**
   * Clear line (V5+ only)
   * Upper window only: Erases from cursor to right edge
   */
  clearLine(machine: ZMachine, value: number): void {
    const version = machine.state.version;

    if (version < 5) {
      this.logger.warn(`${this.id} clearLine not supported in version ${version}`);
      return;
    }

    if (this.outputWindowId !== WindowType.Upper) {
      this.logger.warn(`${this.id} clearLine only works in upper window`);
      return;
    }

    // Clear from cursor column to right edge of the current line in the buffer
    const lineIdx = this.cursorPosition.line - 1;
    const colIdx = this.cursorPosition.column - 1;
    const screenWidth = this.getSize().cols;

    if (lineIdx >= 0 && lineIdx < this.upperWindowBuffer.length) {
      let line = this.upperWindowBuffer[lineIdx];
      // Pad if needed, then overwrite from colIdx to end with spaces
      while (line.length < screenWidth) {
        line += ' ';
      }
      this.upperWindowBuffer[lineIdx] = line.substring(0, colIdx) + ' '.repeat(screenWidth - colIdx);

      // Clear styles for those positions
      if (lineIdx < this.upperWindowStyleBuffer.length) {
        const styleLine = this.upperWindowStyleBuffer[lineIdx];
        for (let i = colIdx; i < screenWidth && i < styleLine.length; i++) {
          styleLine[i] = TextStyle.Roman;
        }
      }
    }

    this.logger.debug(`${this.id} clearLine value=${value} (version ${version})`);
  }

  /**
   * Set cursor position in the upper window.
   * Per spec 8.7.2, set_cursor always targets the upper window in V4/V5.
   * Real Infocom games (e.g., Beyond Zork) use screen-absolute coordinates that
   * may exceed the current upper window height, so we only validate basic sanity.
   */
  setCursorPosition(machine: ZMachine, line: number, column: number, windowId: number): void {
    const version = machine.state.version;

    if (windowId !== WindowType.Upper) {
      this.logger.warn(`${this.id} setCursorPosition only works in upper window`);
      return;
    }

    // Basic sanity: coordinates must be positive
    if (line < 1 || column < 1) {
      this.logger.warn(`${this.id} setCursorPosition: invalid position (${line}, ${column})`);
      return;
    }

    this.cursorPosition = { line, column };
    this.logger.debug(
      `${this.id} setCursorPosition line=${line} column=${column} windowId=${windowId} (version ${version})`
    );
  }

  getCursorPosition(_machine: ZMachine): { line: number; column: number } {
    return { line: this.cursorPosition.line, column: this.cursorPosition.column };
  }

  hideCursor(machine: ZMachine, windowId: number): void {
    this.logger.debug(`not implemented: ${this.id} hideCursor windowId=${windowId}`);
  }

  showCursor(machine: ZMachine, windowId: number): void {
    this.logger.debug(`not implemented: ${this.id} showCursor windowId=${windowId}`);
  }

  setBufferMode(machine: ZMachine, mode: number): void {
    this.bufferMode = mode;
    this.logger.debug(`${this.id} setBufferMode mode=${mode}`);
  }

  getBufferMode(machine: ZMachine): number {
    return this.bufferMode;
  }

  /**
   * Set text style (V4/V5 feature)
   */
  setTextStyle(machine: ZMachine, style: number): void {
    const version = machine.state.version;

    if (version < 4) {
      this.logger.warn(`${this.id} setTextStyle not supported in version ${version}`);
      return;
    }

    // Per spec: style 0 resets to Roman (clears all styles).
    // Non-zero styles are additive - OR the bits into the current style.
    if (style === 0) {
      this.currentStyles = 0;
    } else {
      this.currentStyles |= style;
    }
    this.logger.debug(`${this.id} setTextStyle style=${style} -> currentStyles=${this.currentStyles} (version ${version})`);
  }

  /**
   * Set text colors with version-aware behavior
   */
  setTextColors(machine: ZMachine, window: number, foreground: number, background: number): void {
    const version = machine.state.version;

    if (version < 5) {
      this.logger.warn(`${this.id} setTextColors not supported in version ${version}`);
      return;
    }

    const currentColors = this.windowColors.get(window) || { foreground: Color.Default, background: Color.Default };

    // Handle Color.Current (0) by keeping current values
    // Color.Default (1) is stored as-is and resolved at render time
    const newForeground = foreground === Color.Current ? currentColors.foreground : foreground;
    const newBackground = background === Color.Current ? currentColors.background : background;

    this.windowColors.set(window, { foreground: newForeground, background: newBackground });

    this.logger.debug(
      `${this.id} setTextColors window=${window} foreground=${foreground} background=${background} (version ${version})`
    );
  }

  enableOutputStream(machine: ZMachine, streamId: number, table: number, width: number): void {
    this.logger.debug(`${this.id} enableOutputStream streamId=${streamId} table=${table} width=${width}`);

    if (streamId === 3) {
      // Memory stream - push table address onto stack
      // Initialize the length word to 0
      machine.memory.setWord(table, 0);
      this.memoryStreamStack.push({ table, width });
      this.logger.debug(`Memory stream enabled, stack depth: ${this.memoryStreamStack.length}`);
    }
    // Other streams (1, 2, 4) are handled by subclasses or ignored
  }

  disableOutputStream(machine: ZMachine, streamId: number, table: number, width: number): void {
    this.logger.debug(`${this.id} disableOutputStream streamId=${streamId}`);

    if (streamId === 3) {
      // Memory stream - pop from stack
      if (this.memoryStreamStack.length > 0) {
        this.memoryStreamStack.pop();
        this.logger.debug(`Memory stream disabled, stack depth: ${this.memoryStreamStack.length}`);
      } else {
        this.logger.warn('Attempted to disable memory stream when none was active');
      }
    }
    // Other streams handled by subclasses or ignored
  }

  /**
   * Check if memory stream (stream 3) is currently active
   */
  isMemoryStreamActive(): boolean {
    return this.memoryStreamStack.length > 0;
  }

  /**
   * Write text to the active memory stream table
   * Called by print when stream 3 is active
   */
  protected writeToMemoryStream(machine: ZMachine, text: string): void {
    if (this.memoryStreamStack.length === 0) return;

    const { table } = this.memoryStreamStack[this.memoryStreamStack.length - 1];

    // Get current length from table
    let currentLength = machine.memory.getWord(table);

    // Write each character as a ZSCII byte
    for (let i = 0; i < text.length; i++) {
      let charCode = text.charCodeAt(i);
      // Convert JavaScript newline (LF=10) to ZSCII newline (CR=13).
      // Games like Beyond Zork capture text via stream 3 and later scan for
      // ZSCII 13 to find line breaks (e.g., JUSTIFY-DBOX).
      if (charCode === 10) {
        charCode = 13;
      }
      // Write character at offset: table + 2 (skip length word) + currentLength
      machine.memory.setByte(table + 2 + currentLength, charCode);
      currentLength++;
    }

    // Update the length word
    machine.memory.setWord(table, currentLength);
  }

  /**
   * Write text to the upper window buffer at current cursor position.
   * Handles buffer expansion, text insertion, and cursor advancement.
   * Returns the combined buffer content for rendering by subclasses.
   *
   * @param text The text to write
   * @param screenWidth The current screen width for padding
   * @returns The combined buffer content as a single string with newlines
   */
  protected writeToUpperWindowBuffer(text: string, screenWidth: number): string {
    // Per spec 8.7.2.1: In the upper window, cursor moves right on each character.
    // If it hits the right edge, it does not go further (text is lost).
    // A newline moves cursor to left margin of the next line down.
    for (const char of text) {
      if (char === '\n') {
        // Newline: move to start of next line
        this.cursorPosition.line++;
        this.cursorPosition.column = 1;
        continue;
      }

      const lineIdx = this.cursorPosition.line - 1;
      const colIdx = this.cursorPosition.column - 1;

      // Don't write past right edge of screen
      if (colIdx >= screenWidth) {
        continue;
      }

      // Ensure we have enough lines in the text buffer
      while (this.upperWindowBuffer.length <= lineIdx) {
        this.upperWindowBuffer.push(''.padEnd(screenWidth, ' '));
      }

      // Ensure we have enough lines in the style buffer
      while (this.upperWindowStyleBuffer.length <= lineIdx) {
        this.upperWindowStyleBuffer.push(new Array(screenWidth).fill(TextStyle.Roman));
      }

      // Pad style buffer line if needed
      const styleLine = this.upperWindowStyleBuffer[lineIdx];
      while (styleLine.length < screenWidth) {
        styleLine.push(TextStyle.Roman);
      }

      // Get the current line and pad if needed
      let currentLine = this.upperWindowBuffer[lineIdx];
      while (currentLine.length < screenWidth) {
        currentLine += ' ';
      }

      // Write character at cursor position, overwriting existing character
      currentLine = currentLine.substring(0, colIdx) + char + currentLine.substring(colIdx + 1);
      this.upperWindowBuffer[lineIdx] = currentLine.substring(0, screenWidth);

      // Record the active style for this character position
      this.upperWindowStyleBuffer[lineIdx][colIdx] = this.currentStyles;

      // Advance cursor right (clamp at right edge)
      this.cursorPosition.column = Math.min(this.cursorPosition.column + 1, screenWidth + 1);
    }

    // Return combined content for rendering
    return this.upperWindowBuffer.join('\n');
  }

  /**
   * Resize the upper window buffer to match new screen width.
   * Call this when the screen is resized.
   *
   * @param newWidth The new screen width
   * @returns The resized buffer content, or null if buffer was empty
   */
  protected resizeUpperWindowBuffer(newWidth: number): string | null {
    if (this.upperWindowBuffer.length === 0) return null;

    // Resize each line in the text buffer
    this.upperWindowBuffer = this.upperWindowBuffer.map((line) => {
      if (line.length < newWidth) {
        return line.padEnd(newWidth, ' ');
      } else if (line.length > newWidth) {
        return line.substring(0, newWidth);
      }
      return line;
    });

    // Resize each line in the style buffer
    this.upperWindowStyleBuffer = this.upperWindowStyleBuffer.map((styleLine) => {
      if (styleLine.length < newWidth) {
        const padded = [...styleLine];
        while (padded.length < newWidth) {
          padded.push(TextStyle.Roman);
        }
        return padded;
      } else if (styleLine.length > newWidth) {
        return styleLine.slice(0, newWidth);
      }
      return styleLine;
    });

    return this.upperWindowBuffer.join('\n');
  }

  /**
   * Get the current upper window buffer content.
   * Useful for subclasses that need to re-render after style changes.
   */
  protected getUpperWindowBufferContent(): string {
    return this.upperWindowBuffer.join('\n');
  }

  /**
   * Format a V3-style status bar line.
   * Returns the formatted string; subclasses handle rendering.
   *
   * @param locationName The location name (left side)
   * @param value1 Score or hours
   * @param value2 Moves or minutes
   * @param isTimeMode Whether to format as time (true) or score/moves (false)
   * @param width The screen width
   * @returns The formatted status bar string
   */
  formatStatusBarLine(
    locationName: string | null,
    value1: number,
    value2: number,
    isTimeMode: boolean,
    width: number
  ): string {
    // Handle missing location
    const lhs = locationName || '';

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

    // Pad between left and right sides
    const padding = Math.max(0, width - lhs.length - rhs.length);
    return lhs + ' '.repeat(padding) + rhs;
  }

  /**
   * Convert a Z-machine 15-bit true color to RGB components.
   * Z-machine format: 0bBBBBB_GGGGG_RRRRR (5 bits each for B, G, R)
   *
   * @param trueColor The 15-bit true color value
   * @returns Object with r, g, b values (0-255 each)
   */
  trueColorToRgb(trueColor: number): { r: number; g: number; b: number } {
    // Extract 5-bit color components and scale to 8-bit (0-255)
    const r = (trueColor & 0x1f) * 8;
    const g = ((trueColor >> 5) & 0x1f) * 8;
    const b = ((trueColor >> 10) & 0x1f) * 8;
    return { r, g, b };
  }

  /**
   * Convert a Z-machine 15-bit true color to a hex color string.
   *
   * @param trueColor The 15-bit true color value
   * @returns Hex color string like '#rrggbb'
   */
  trueColorToHex(trueColor: number): string {
    const { r, g, b } = this.trueColorToRgb(trueColor);
    const toHex = (n: number): string => n.toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  selectInputStream(machine: ZMachine, streamId: number): void {
    this.logger.error(`not implemented: ${this.id} selectInputStream streamId=${streamId}`);
  }

  updateStatusBar(locationName: string | null, value1: number, value2: number, isTimeMode: boolean): void {
    this.logger.debug(
      `not implemented: ${this.id} updateStatusBar locationName=${locationName} value1=${value1} value2=${value2} isTimeMode=${isTimeMode}`
    );
  }

  updateDisplay(machine: ZMachine): void {
    this.logger.debug(`${this.id} updateDisplay`);
  }

  getCurrentFont(machine: ZMachine): number {
    return this.windowFonts.get(this.outputWindowId) || 1;
  }

  setFont(machine: ZMachine, font: number): boolean {
    const version = machine.state.version;

    // Use font manager to check if font is supported
    const success = this.fontManager.isFontSupported(font as FontType);

    if (success) {
      this.windowFonts.set(this.outputWindowId, font);
      // Update font manager's current font
      this.fontManager.setCurrentFont(font as FontType);
    }

    this.logger.debug(`${this.id} setFont ${font} (version ${version}) - supported: ${success}`);
    return success;
  }

  getFontForWindow(machine: ZMachine, window: number): number {
    return this.windowFonts.get(window) || 1;
  }

  setFontForWindow(machine: ZMachine, font: number, window: number): boolean {
    const version = machine.state.version;

    // Use font manager to check if font is supported
    const success = this.fontManager.isFontSupported(font as FontType);

    if (success) {
      this.windowFonts.set(window, font);
      // If this is the current output window, update font manager
      if (window === this.outputWindowId) {
        this.fontManager.setCurrentFont(font as FontType);
      }
    }

    this.logger.debug(`${this.id} setFontForWindow ${font} ${window} (version ${version}) - supported: ${success}`);
    return success;
  }

  getWindowTrueForeground(machine: ZMachine, window: number): number {
    const colors = this.windowColors.get(window);
    return colors ? colors.foreground : -1;
  }

  getWindowTrueBackground(machine: ZMachine, window: number): number {
    const colors = this.windowColors.get(window);
    return colors ? colors.background : -1;
  }

  /**
   * Check if the current font is Font 3 (character graphics)
   */
  isCurrentFontFont3(): boolean {
    return this.fontManager.getCurrentFont() === FontType.CharacterGraphics;
  }

  /**
   * Get Font 3 character information for the current font
   */
  getFont3Character(code: number) {
    if (!this.isCurrentFontFont3()) {
      return undefined;
    }
    return this.fontManager.getFont3Character(code);
  }

  /**
   * Check if a character code is a Font 3 character
   */
  isFont3Character(code: number): boolean {
    if (!this.isCurrentFontFont3()) {
      return false;
    }
    return this.fontManager.isFont3Character(code);
  }

  /**
   * Get current font dimensions
   */
  getCurrentFontDimensions(): { width: number; height: number } {
    return this.fontManager.getCurrentFontDimensions();
  }

  quit(): void {
    this.logger.debug(`not implemented: ${this.id} quit`);
  }
}
