import { Screen, Capabilities, ScreenSize } from "./interfaces";
import { ZMachine } from "../../interpreter/ZMachine";
import { InputState } from "../input/InputHandler";
import { Logger } from "../../utils/log";

export class BaseScreen implements Screen {
  protected logger: Logger;
  protected id: string;

  constructor(logger: Logger, id: string) {
    this.logger = logger;
    this.id = id;
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
    this.logger.debug(
      `not implemented: ${this.id} setOutputWindow windowId=${windowId}`
    );
  }

  getOutputWindow(machine: ZMachine): number {
    this.logger.debug(`not implemented: ${this.id} getOutputWindow`);
    return 0;
  }

  clearWindow(machine: ZMachine, windowId: number): void {
    this.logger.debug(
      `not implemented: ${this.id} clearWindow windowId=${windowId}`
    );
  }

  clearLine(machine: ZMachine, value: number): void {
    this.logger.debug(`not implemented: ${this.id} clearLine value=${value}`);
  }

  setCursorPosition(
    machine: ZMachine,
    line: number,
    column: number,
    windowId: number
  ): void {
    this.logger.debug(
      `not implemented: ${this.id} setCursorPosition line=${line} column=${column} windowId=${windowId}`
    );
  }

  hideCursor(machine: ZMachine, windowId: number): void {
    this.logger.debug(
      `not implemented: ${this.id} hideCursor windowId=${windowId}`
    );
  }

  showCursor(machine: ZMachine, windowId: number): void {
    this.logger.debug(
      `not implemented: ${this.id} showCursor windowId=${windowId}`
    );
  }

  setBufferMode(machine: ZMachine, mode: number): void {
    this.logger.debug(`not implemented: ${this.id} setBufferMode mode=${mode}`);
  }

  setTextStyle(machine: ZMachine, style: number): void {
    this.logger.debug(
      `not implemented: ${this.id} setTextStyle style=${style}`
    );
  }

  setTextColors(
    machine: ZMachine,
    window: number,
    foreground: number,
    background: number
  ): void {
    this.logger.debug(
      `not implemented: ${this.id} setTextColors window=${window} foreground=${foreground} background=${background}`
    );
  }

  enableOutputStream(
    machine: ZMachine,
    streamId: number,
    table: number,
    width: number
  ): void {
    this.logger.error(
      `not implemented: ${this.id} enableOutputStream streamId=${streamId} table=${table} width=${width}`
    );
  }

  disableOutputStream(
    machine: ZMachine,
    streamId: number,
    table: number,
    width: number
  ): void {
    this.logger.error(
      `not implemented: ${this.id} disableOutputStream streamId=${streamId} table=${table} width=${width}`
    );
  }

  selectInputStream(machine: ZMachine, streamId: number): void {
    this.logger.error(
      `not implemented: ${this.id} selectInputStream streamId=${streamId}`
    );
  }

  updateStatusBar(lhs: string, rhs: string): void {
    this.logger.debug(
      `not implemented: ${this.id} updateStatusBar lhs=${lhs} rhs=${rhs}`
    );
  }

  quit(): void {
    this.logger.debug(`not implemented: ${this.id} quit`);
  }
}
