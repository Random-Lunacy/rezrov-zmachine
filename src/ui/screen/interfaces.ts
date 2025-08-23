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
 * Window types in Z-machine
 */
export enum WindowType {
  Lower = 0,
  Upper = 1,
}



/**
 * Window properties that can be queried
 */
export enum WindowProperty {
  LineCount = 0,
  CursorLine = 1,
  CursorColumn = 2,
  LeftMargin = 3,
  RightMargin = 4,
  Font = 5,
  TextStyle = 6,
  ColorData = 7,
  Width = 8,
  Height = 9,
}

/**
 * Interface for the screen module
 */
export interface Screen {
  // Basic screen information
  getWindowProperty(machine: ZMachine, window: number, property: number): number;
  getCapabilities(): Capabilities;
  getSize(): ScreenSize;

  // Input handling
  getInputFromUser(machine: ZMachine, inputState: InputState): void;
  getKeyFromUser(machine: ZMachine, inputState: InputState): void;

  // Text output
  print(machine: ZMachine, str: string): void;
  setTextStyle(machine: ZMachine, style: number): void;
  setTextColors(machine: ZMachine, window: number, foreground: number, background: number): void;

  // Window management
  splitWindow(machine: ZMachine, lines: number): void;
  setOutputWindow(machine: ZMachine, windowId: number): void;
  getOutputWindow(machine: ZMachine): number;
  clearWindow(machine: ZMachine, windowId: number): void;
  clearLine(machine: ZMachine, value: number): void;

  // Cursor control
  setCursorPosition(machine: ZMachine, line: number, column: number, windowId: number): void;
  hideCursor(machine: ZMachine, windowId: number): void;
  showCursor(machine: ZMachine, windowId: number): void;

  // Buffer and stream management
  setBufferMode(machine: ZMachine, mode: number): void;
  getBufferMode(machine: ZMachine): number;
  enableOutputStream(machine: ZMachine, streamId: number, table: number, width: number): void;
  disableOutputStream(machine: ZMachine, streamId: number, table: number, width: number): void;
  selectInputStream(machine: ZMachine, streamId: number): void;

  // Font management
  getCurrentFont(machine: ZMachine): number;
  setFont(machine: ZMachine, font: number): boolean;
  getFontForWindow(machine: ZMachine, window: number): number;
  setFontForWindow(machine: ZMachine, font: number, window: number): boolean;

  // Status bar and display
  updateStatusBar(locationName: string | null, value1: number, value2: number, isTimeMode: boolean): void;
  updateDisplay(machine: ZMachine): void;

  // Color management
  getWindowTrueForeground(machine: ZMachine, window: number): number;
  getWindowTrueBackground(machine: ZMachine, window: number): number;

  // Lifecycle
  quit(): void;
}
