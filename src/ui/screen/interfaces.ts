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

  // Default colors for V5+ header bytes 0x2C/0x2D (Z-machine Color enum values)
  defaultForeground?: number;
  defaultBackground?: number;

  // Interpreter number for header byte 0x1E (defaults to Amiga=4 for good color palette support)
  // Some games like Beyond Zork use this to select color palettes.
  // See Interpreter enum in constants.ts for valid values.
  interpreterNumber?: number;
};

/**
 * Window types in Z-machine
 */
export enum WindowType {
  Lower = 0,
  Upper = 1,
}

/**
 * Window properties per Z-machine spec (Table 8.8.3.1 / Section 16)
 * Property numbers match the values used by get_wind_prop / put_wind_prop opcodes.
 */
export enum WindowProperty {
  YCoordinate = 0,
  XCoordinate = 1,
  YSize = 2,
  XSize = 3,
  YCursor = 4,
  XCursor = 5,
  LeftMargin = 6,
  RightMargin = 7,
  NewlineInterrupt = 8,
  InterruptCountdown = 9,
  TextStyle = 10,
  ColorData = 11,
  Font = 12,
  FontSize = 13,
  Attributes = 14,
  LineCount = 15,
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
  getCursorPosition(machine: ZMachine): { line: number; column: number };
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

  // Font 3 specific methods
  isCurrentFontFont3(): boolean;
  getFont3Character(code: number): unknown;
  isFont3Character(code: number): boolean;
  getCurrentFontDimensions(): { width: number; height: number };

  // Status bar and display
  updateStatusBar(locationName: string | null, value1: number, value2: number, isTimeMode: boolean): void;
  updateDisplay(machine: ZMachine): void;

  // Color management
  getWindowTrueForeground(machine: ZMachine, window: number): number;
  getWindowTrueBackground(machine: ZMachine, window: number): number;

  // V6 window management (optional for backward compatibility)
  moveWindow?(machine: ZMachine, windowId: number, y: number, x: number): void;
  resizeWindow?(machine: ZMachine, windowId: number, height: number, width: number): void;
  setWindowStyle?(machine: ZMachine, windowId: number, flags: number, operation: number): void;
  scrollWindow?(machine: ZMachine, windowId: number, lines: number): void;
  setWindowMargins?(machine: ZMachine, left: number, right: number, windowId?: number): void;
  setWindowProperty?(machine: ZMachine, windowId: number, property: number, value: number): void;

  // V6 mouse support (optional for backward compatibility)
  readMouse?(machine: ZMachine, array: number): void;
  setMouseWindow?(machine: ZMachine, windowId: number): void;

  // Lifecycle
  quit(): void;
}
