import { ZMachine } from "../../interpreter/ZMachine";
import { InputState } from "../input/InputHandler";

export enum TextStyle {
  Roman = 0,
  ReverseVideo = 1,
  Bold = 2,
  Italic = 4,
  FixedPitch = 8,
}

export enum Color {
  Current = 0,
  Default = 1,
  Black = 2,
  Red = 3,
  Green = 4,
  Yellow = 5,
  Blue = 6,
  Magenta = 7,
  Cyan = 8,
  White = 9,
  Gray = 10,
}

export enum BufferMode {
  NotBuffered = 0,
  Buffered = 1,
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

export interface Screen {
  getCapabilities(): Capabilities;
  getInputFromUser(machine: ZMachine, inputState: InputState): void;
  getKeyFromUser(machine: ZMachine, inputState: InputState): void;
  print(machine: ZMachine, str: string): void;

  // Other methods will go here

  getSize(): ScreenSize;
  updateStatusBar(lhs: string, rhs: string): void;
  quit(): void;
}
