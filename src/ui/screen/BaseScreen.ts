/* eslint-disable @typescript-eslint/no-unused-vars */
import { ZMachine } from '../../interpreter/ZMachine';
import { Logger } from '../../utils/log';
import { InputState } from '../input/InputInterface';
import { Capabilities, Screen, ScreenSize, WindowProperty, WindowType } from './interfaces';
import { BufferMode, Color, TextStyle } from '../../types';

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
  protected windowColors: Map<number, { foreground: number; background: number }> = new Map();
  protected windowFonts: Map<number, number> = new Map();

  /**
   * Constructor for BaseScreen
   * @param id The screen ID
   * @param options Optional options
   */
  constructor(id: string, options?: { logger?: Logger }) {
    this.logger = options?.logger || new Logger(id ?? 'BaseScreen');
    this.id = id;
    this.currentStyles = TextStyle.Roman;

    // Initialize default colors for both windows
    this.windowColors.set(WindowType.Lower, { foreground: Color.Default, background: Color.Default });
    this.windowColors.set(WindowType.Upper, { foreground: Color.Default, background: Color.Default });

    // Initialize default fonts for both windows
    this.windowFonts.set(WindowType.Lower, 1);
    this.windowFonts.set(WindowType.Upper, 1);
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
    // Version is used for future version-specific property handling

    switch (property) {
      case WindowProperty.LineCount:
        if (window === WindowType.Upper) {
          return this.upperWindowHeight;
        } else {
          const screenSize = this.getSize();
          return screenSize.rows - this.upperWindowHeight;
        }

      case WindowProperty.CursorLine:
        return this.cursorPosition.line;

      case WindowProperty.CursorColumn:
        return this.cursorPosition.column;

      case WindowProperty.LeftMargin:
        return 1; // Default left margin

      case WindowProperty.RightMargin:
        return this.getSize().cols; // Default right margin

      case WindowProperty.Font:
        return this.windowFonts.get(window) || 1;

      case WindowProperty.TextStyle:
        return this.currentStyles;

      case WindowProperty.ColorData:
        const colors = this.windowColors.get(window);
        if (!colors) return 0;
        // Pack foreground and background into a single value
        return (colors.foreground << 8) | colors.background;

      case WindowProperty.Width:
        return this.getSize().cols;

      case WindowProperty.Height:
        if (window === WindowType.Upper) {
          return this.upperWindowHeight;
        } else {
          return this.getSize().rows - this.upperWindowHeight;
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
   * Split window with version-aware behavior
   * V3: Upper window is cleared when split occurs
   * V5: Upper window is NOT cleared when split occurs
   */
  splitWindow(machine: ZMachine, lines: number): void {
    const version = machine.state.version;
    const oldHeight = this.upperWindowHeight;

    this.upperWindowHeight = Math.max(0, Math.min(lines, this.getSize().rows - 1));

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

    if (windowId === WindowType.Upper && version <= 3) {
      // V3: Reset cursor to top-left when selecting upper window
      this.cursorPosition = { line: 1, column: 1 };
    }

    this.outputWindowId = windowId;
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
      // Clear entire screen
      this.upperWindowHeight = 0;
      this.outputWindowId = WindowType.Lower;
      this.cursorPosition = { line: 1, column: 1 };
    } else if (version >= 5) {
      // V5: Cursor moves to top-left for any erased window
      this.cursorPosition = { line: 1, column: 1 };
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

    this.logger.debug(`${this.id} clearLine value=${value} (version ${version})`);
  }

  /**
   * Set cursor position with version-aware validation
   * V5: Illegal to move cursor outside current window size
   */
  setCursorPosition(machine: ZMachine, line: number, column: number, windowId: number): void {
    const version = machine.state.version;

    if (windowId !== WindowType.Upper) {
      this.logger.warn(`${this.id} setCursorPosition only works in upper window`);
      return;
    }

    if (version >= 5) {
      // V5: Validate cursor position is within window bounds
      if (line < 1 || line > this.upperWindowHeight || column < 1 || column > this.getSize().cols) {
        this.logger.warn(`${this.id} setCursorPosition: position (${line}, ${column}) outside window bounds`);
        return;
      }
    }

    this.cursorPosition = { line, column };
    this.logger.debug(`${this.id} setCursorPosition line=${line} column=${column} windowId=${windowId} (version ${version})`);
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

    this.currentStyles = style;
    this.logger.debug(`${this.id} setTextStyle style=${style} (version ${version})`);
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

    // Handle Color.Current (-1) by keeping current values
    const newForeground = foreground === -1 ? currentColors.foreground : foreground;
    const newBackground = background === -1 ? currentColors.background : background;

    this.windowColors.set(window, { foreground: newForeground, background: newBackground });

    this.logger.debug(
      `${this.id} setTextColors window=${window} foreground=${foreground} background=${background} (version ${version})`
    );
  }

  enableOutputStream(machine: ZMachine, streamId: number, table: number, width: number): void {
    this.logger.error(
      `not implemented: ${this.id} enableOutputStream streamId=${streamId} table=${table} width=${width}`
    );
  }

  disableOutputStream(machine: ZMachine, streamId: number, table: number, width: number): void {
    this.logger.error(
      `not implemented: ${this.id} disableOutputStream streamId=${streamId} table=${table} width=${width}`
    );
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

    // Return false if font 2 is requested (picture font is undefined)
    if (font === 2) return false;

    // In base implementation, pretend success for other fonts
    const success = font === 1 || font === 3 || font === 4;

    if (success) {
      this.windowFonts.set(this.outputWindowId, font);
    }

    this.logger.debug(`${this.id} setFont ${font} (version ${version})`);
    return success;
  }

  getFontForWindow(machine: ZMachine, window: number): number {
    return this.windowFonts.get(window) || 1;
  }

  setFontForWindow(machine: ZMachine, font: number, window: number): boolean {
    const version = machine.state.version;

    // Return false if font 2 is requested (picture font is undefined)
    if (font === 2) return false;

    // In base implementation, pretend success for other fonts
    const success = font === 1 || font === 3 || font === 4;

    if (success) {
      this.windowFonts.set(window, font);
    }

    this.logger.debug(`${this.id} setFontForWindow ${font} ${window} (version ${version})`);
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

  quit(): void {
    this.logger.debug(`not implemented: ${this.id} quit`);
  }
}
