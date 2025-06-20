/**
 * This file contains the interfaces for the screen module.
 * It defines the Screen interface and the various types and enums used in the screen module.
 */
import { ZMachine } from '../../interpreter/ZMachine';
import { Color } from '../../types';
import { InputState } from '../input/InputInterface';

export function colorToString(c: Color): string {
  switch (c) {
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
    default:
      return '';
  }
}

export type ScreenSize = {
  rows: number;
  cols: number;
};

export type Capabilities = {
  hasColors: boolean;
  hasBold: boolean;
  hasItalic: boolean;
  hasReverseVideo: boolean;
  hasFixedPitch: boolean;

  hasSplitWindow: boolean;
  hasDisplayStatusBar: boolean;
  hasPictures: boolean;
  hasSound: boolean;
  hasTimedKeyboardInput: boolean;
};

/**
 * Interface for the screen module
 */
export interface Screen {
  getWindowProperty(machine: ZMachine, window: number, property: number): number;
  getCapabilities(): Capabilities;
  getInputFromUser(machine: ZMachine, inputState: InputState): void;
  getKeyFromUser(machine: ZMachine, inputState: InputState): void;
  print(machine: ZMachine, str: string): void;
  splitWindow(machine: ZMachine, lines: number): void;
  setOutputWindow(machine: ZMachine, windowId: number): void;
  getOutputWindow(machine: ZMachine): number;
  clearWindow(machine: ZMachine, windowId: number): void;
  clearLine(machine: ZMachine, value: number): void;
  setCursorPosition(machine: ZMachine, line: number, column: number, windowId: number): void;
  hideCursor(machine: ZMachine, windowId: number): void;
  showCursor(machine: ZMachine, windowId: number): void;
  setBufferMode(machine: ZMachine, mode: number): void;
  setTextStyle(machine: ZMachine, style: number): void;
  setTextColors(machine: ZMachine, window: number, foreground: number, background: number): void;
  enableOutputStream(machine: ZMachine, streamId: number, table: number, width: number): void;
  disableOutputStream(machine: ZMachine, streamId: number, table: number, width: number): void;
  selectInputStream(machine: ZMachine, streamId: number): void;
  getSize(): ScreenSize;
  updateStatusBar(locationName: string | null, value1: number, value2: number, isTimeMode: boolean): void;
  getBufferMode(machine: ZMachine): number;
  updateDisplay(machine: ZMachine): void;
  getCurrentFont(machine: ZMachine): number;
  setFont(machine: ZMachine, font: number): boolean;
  getFontForWindow(machine: ZMachine, window: number): number;
  setFontForWindow(machine: ZMachine, font: number, window: number): boolean;
  getWindowTrueForeground(machine: ZMachine, window: number): number;
  getWindowTrueBackground(machine: ZMachine, window: number): number;
  quit(): void;
}
