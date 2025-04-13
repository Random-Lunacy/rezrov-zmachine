import { Screen, Capabilities, ScreenSize } from './interfaces';
import { ZMachine } from '../../interpreter/ZMachine';
import { InputState } from '../input/InputHandler';
import { Logger } from '../../utils/log';

export class BaseScreen implements Screen {
  protected logger: Logger;
  protected id: string;
  protected currentStyles: number;

  constructor(logger: Logger, id: string) {
    this.logger = logger;
    this.id = id;
    this.currentStyles = 0;
  }

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

  // Screen implementation methods will go here

  getSize(): ScreenSize {
    this.logger.debug(`not implemented: ${this.id} getSize`);
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
    this.logger.debug(`${this.id} setTextStyle ${style}`);

    // Handle style activation/deactivation
    if (style === 0) {
      // Clear all styles
      this.currentStyles = 0;
    } else {
      // Set the specified styles
      this.currentStyles = style;
    }

    // Apply the styles according to the priority rules
    this.applyStyles();

    // For V6, update window property 10 to show the actual style combination in use
    if (machine.state.version === 6) {
      this.updateWindowStyleProperty(machine);
    }
  }

  // Helper method to apply styles based on priority
  private applyStyles(): void {
    // If the interpreter can't provide the requested style combination,
    // it should give precedence to styles in this order:
    // Fixed, Italic, Bold, Reverse
    // This implementation would depend on your rendering system
    // TODO: Implement the actual style application logic
  }

  // For V6, update window property 10 with the actual style in use
  private updateWindowStyleProperty(machine: ZMachine): void {
    const currentWindow = machine.screen.getOutputWindow(machine);

    // This would need integration with your window property system
    // setWindowProperty(machine, currentWindow, 10, this.currentStyles);
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
    // Default implementation does nothing
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
