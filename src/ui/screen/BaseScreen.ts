/* eslint-disable @typescript-eslint/no-unused-vars */
import { ZMachine } from '../../interpreter/ZMachine';
import { Logger } from '../../utils/log';
import { InputState } from '../input/InputHandler';
import { Capabilities, Screen, ScreenSize } from './interfaces';

/**
 * BaseScreen class
 * This class provides a base implementation for the Screen interface.
 * It includes default implementations for all methods, which must be overridden
 * by subclasses to provide specific functionality.
 */
export class BaseScreen implements Screen {
  protected logger: Logger;
  protected id: string;
  protected currentStyles: number;

  /**
   * Constructor for BaseScreen
   * @param id The screen ID
   * @param options Optional options
   */
  constructor(id: string, options?: { logger?: Logger }) {
    this.logger = options?.logger || new Logger('BaseScreen');
    this.id = id;
    this.currentStyles = 0;
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

  getWindowProperty(machine: ZMachine, window: number, property: number): number {
    this.logger.debug(`not implemented: ${this.id} getWindowProperty window=${window} property=${property}`);
    return 0;
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

  splitWindow(machine: ZMachine, lines: number): void {
    this.logger.debug(`not implemented: ${this.id} splitWindow lines=${lines}`);
  }

  setOutputWindow(machine: ZMachine, windowId: number): void {
    this.logger.debug(`not implemented: ${this.id} setOutputWindow windowId=${windowId}`);
  }

  getOutputWindow(machine: ZMachine): number {
    this.logger.debug(`not implemented: ${this.id} getOutputWindow`);
    return 0;
  }

  clearWindow(machine: ZMachine, windowId: number): void {
    this.logger.debug(`not implemented: ${this.id} clearWindow windowId=${windowId}`);
  }

  clearLine(machine: ZMachine, value: number): void {
    this.logger.debug(`not implemented: ${this.id} clearLine value=${value}`);
  }

  setCursorPosition(machine: ZMachine, line: number, column: number, windowId: number): void {
    this.logger.debug(
      `not implemented: ${this.id} setCursorPosition line=${line} column=${column} windowId=${windowId}`
    );
  }

  hideCursor(machine: ZMachine, windowId: number): void {
    this.logger.debug(`not implemented: ${this.id} hideCursor windowId=${windowId}`);
  }

  showCursor(machine: ZMachine, windowId: number): void {
    this.logger.debug(`not implemented: ${this.id} showCursor windowId=${windowId}`);
  }

  setBufferMode(machine: ZMachine, mode: number): void {
    this.logger.debug(`not implemented: ${this.id} setBufferMode mode=${mode}`);
  }

  setTextStyle(machine: ZMachine, style: number): void {
    this.logger.debug(`not implemented: ${this.id} setTextStyle style=${style}`);
  }

  setTextColors(machine: ZMachine, window: number, foreground: number, background: number): void {
    this.logger.debug(
      `not implemented: ${this.id} setTextColors window=${window} foreground=${foreground} background=${background}`
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

  updateStatusBar(lhs: string, rhs: string): void {
    this.logger.debug(`not implemented: ${this.id} updateStatusBar lhs=${lhs} rhs=${rhs}`);
  }

  getBufferMode(machine: ZMachine): number {
    this.logger.debug(`${this.id} getBufferMode`);
    return 0; // Default implementation always returns 0 (unbuffered)
  }

  updateDisplay(machine: ZMachine): void {
    this.logger.debug(`${this.id} updateDisplay`);
  }

  getCurrentFont(machine: ZMachine): number {
    this.logger.debug(`${this.id} getCurrentFont`);
    return 1; // Default implementation returns font 1
  }

  setFont(machine: ZMachine, font: number): boolean {
    this.logger.debug(`${this.id} setFont ${font}`);
    // Return false if font 2 is requested (picture font is undefined)
    if (font === 2) return false;
    // In base implementation, pretend success for other fonts
    return font === 1 || font === 3 || font === 4;
  }

  getFontForWindow(machine: ZMachine, window: number): number {
    this.logger.debug(`${this.id} getFontForWindow ${window}`);
    return 1; // Default implementation returns font 1
  }

  setFontForWindow(machine: ZMachine, font: number, window: number): boolean {
    this.logger.debug(`${this.id} setFontForWindow ${font} ${window}`);
    // Return false if font 2 is requested (picture font is undefined)
    if (font === 2) return false;
    // In base implementation, pretend success for other fonts
    return font === 1 || font === 3 || font === 4;
  }

  getWindowTrueForeground(machine: ZMachine, window: number): number {
    this.logger.debug(`${this.id} getWindowTrueForeground ${window}`);
    // Default implementation returns -1 (default color)
    return -1;
  }

  getWindowTrueBackground(machine: ZMachine, window: number): number {
    this.logger.debug(`${this.id} getWindowTrueBackground ${window}`);
    // Default implementation returns -1 (default color)
    return -1;
  }

  quit(): void {
    this.logger.debug(`not implemented: ${this.id} quit`);
  }
}
