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
    return { rows: 25, cols: 80 };
  }

  // Other required methods will be implemented here
  getInputFromUser(machine: ZMachine, inputState: InputState): void {}
  getKeyFromUser(machine: ZMachine, inputState: InputState): void {}
  print(machine: ZMachine, str: string): void {}
  updateStatusBar(lhs: string, rhs: string): void {}
  quit(): void {}
}
