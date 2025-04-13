/**
 * Common type definitions for the Z-machine interpreter
 */

// Memory address in the Z-machine
export type Address = number;

// Z-machine character code
export type ZSCII = number;

/**
 * Represents the state required to resume execution after user input
 */
export interface InputState {
  /**
   * If true, waiting for a single keypress (read_char instruction)
   * If false, waiting for a line of text (read instruction)
   */
  keyPress: boolean;

  /**
   * Variable number where the result will be stored
   */
  resultVar: number;

  /**
   * For read operations (keyPress=false):
   * Address of the text buffer where input will be stored
   */
  textBuffer?: number;

  /**
   * For read operations (keyPress=false):
   * Address of the parse buffer where tokenized input will be stored
   */
  parseBuffer?: number;

  /**
   * For timed input operations:
   * Time limit for input in tenths of a second, or 0 for no limit
   */
  time?: number;

  /**
   * For timed input operations:
   * Routine to call if the time limit expires
   */
  routine?: number;
}

/**
 * Represents a color in the Z-machine
 */
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

/**
 * Represents text styles in the Z-machine
 */
export enum TextStyle {
  Roman = 0,
  ReverseVideo = 1,
  Bold = 2,
  Italic = 4,
  FixedPitch = 8,
}

/**
 * Represents text buffering modes
 */
export enum BufferMode {
  NotBuffered = 0,
  Buffered = 1,
}

/**
 * Represents Z-machine operation forms
 */
export enum InstructionForm {
  Long = 0,
  Short = 1,
  Variable = 2,
  Extended = 3,
}

/**
 * Represents Z-machine operand types
 */
export enum OperandType {
  Large = 0, // Large constant (0 to 65535) - 2 bytes
  Small = 1, // Small constant (0 to 255) - 1 byte
  Variable = 2, // Variable - 1 byte
  Omitted = 3, // Omitted altogether - 0 bytes
}

/**
 * A type to represent any value that's not yet implemented
 * but needs to be typed in the system
 */
export type FIXME = unknown;
