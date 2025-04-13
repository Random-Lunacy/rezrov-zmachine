import { Screen, Capabilities, ScreenSize } from '../../src/ui/screen/interfaces';
import { ZMachine } from '../../src/interpreter/ZMachine';
import { InputState } from '../../src/ui/input/InputHandler';
import { Logger } from '../../src/utils/log';

export class TestScreen implements Screen {
  private logger: Logger;
  private output: string[] = [];

  constructor(logger: Logger) {
    this.logger = logger;
  }

  getCapabilities(): Capabilities {
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

  print(machine: ZMachine, str: string): void {
    this.output.push(str);
  }

  // Return captured output for testing
  getOutput(): string {
    return this.output.join('');
  }

  // Implement all other required methods with minimal functionality
  getSize(): ScreenSize {
    return { rows: 25, cols: 80 };
  }

  getInputFromUser(): void {}
  getKeyFromUser(): void {}
  splitWindow(): void {}
  setOutputWindow(): void {}
  getOutputWindow(): number { return 0; }
  clearWindow(): void {}
  clearLine(): void {}
  setCursorPosition(): void {}
  hideCursor(): void {}
  showCursor(): void {}
  setBufferMode(): void {}
  setTextStyle(): void {}
  setTextColors(): void {}
  enableOutputStream(): void {}
  disableOutputStream(): void {}
  selectInputStream(): void {}
  updateStatusBar(): void {}
  quit(): void {}
}
