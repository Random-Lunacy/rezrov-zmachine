import { ZMachine } from '../../src/interpreter/ZMachine';
import { InputState } from '../../src/ui/input/InputInterface';
import { Capabilities, Screen, ScreenSize } from '../../src/ui/screen/interfaces';
import { Logger } from '../../src/utils/log';

/**
 * Screen implementation for use in integrations tests
 */
export class TestScreen implements Screen {
  private logger: Logger;
  private output: string[] = [];
  private executionFinished: boolean = false;

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

    // Check if output contains completion markers
    const fullOutput = this.getOutput();
    if (fullOutput.includes('All tests completed')) {
      this.executionFinished = true;
    }
  }

  getOutput(): string {
    return this.output.join('');
  }

  isExecutionFinished(): boolean {
    return this.executionFinished;
  }

  getSize(): ScreenSize {
    return { rows: 25, cols: 80 };
  }

  getInputFromUser(machine: ZMachine, inputState: InputState): void {}
  getKeyFromUser(machine: ZMachine, inputState: InputState): void {}
  splitWindow(machine: ZMachine, lines: number): void {}
  setOutputWindow(machine: ZMachine, windowId: number): void {}
  getOutputWindow(machine: ZMachine): number {
    return 0;
  }
  clearWindow(machine: ZMachine, windowId: number): void {}
  clearLine(machine: ZMachine, value: number): void {}
  setCursorPosition(machine: ZMachine, line: number, column: number, windowId: number): void {}
  hideCursor(machine: ZMachine, windowId: number): void {}
  showCursor(machine: ZMachine, windowId: number): void {}
  setBufferMode(machine: ZMachine, mode: number): void {}
  setTextStyle(machine: ZMachine, style: number): void {}
  setTextColors(machine: ZMachine, window: number, foreground: number, background: number): void {}
  enableOutputStream(machine: ZMachine, streamId: number, table: number, width: number): void {}
  disableOutputStream(machine: ZMachine, streamId: number, table: number, width: number): void {}
  selectInputStream(machine: ZMachine, streamId: number): void {}
  updateStatusBar(lhs: string, rhs: string): void {}
  getBufferMode(machine: ZMachine): number {
    return 0;
  }
  updateDisplay(machine: ZMachine): void {}
  getCurrentFont(machine: ZMachine): number {
    return 1;
  }
  setFont(machine: ZMachine, font: number): boolean {
    return font === 1;
  }
  getFontForWindow(machine: ZMachine, window: number): number {
    return 1;
  }
  setFontForWindow(machine: ZMachine, font: number, window: number): boolean {
    return font === 1;
  }
  getWindowTrueForeground(machine: ZMachine, window: number): number {
    return -1;
  }
  getWindowTrueBackground(machine: ZMachine, window: number): number {
    return -1;
  }
  getWindowProperty(machine: ZMachine, window: number, property: number): number {
    return 0;
  }
  quit(): void {}
}
