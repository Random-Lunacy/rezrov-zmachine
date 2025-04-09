/**
 * Constant values used throughout the Z-machine interpreter
 */

/**
 * Locations of header fields in Z-machine memory
 */
export enum HeaderLocation {
  Version = 0x00, // Z-machine version
  Flags1 = 0x01, // Status line type, story split, etc.
  HighMemBase = 0x04, // Base of high memory
  InitialPC = 0x06, // Initial value of program counter
  Dictionary = 0x08, // Address of dictionary
  ObjectTable = 0x0a, // Address of object table
  GlobalVariables = 0x0c, // Address of global variables
  StaticMemBase = 0x0e, // Base of static memory
  Flags2 = 0x10, // Flags 2
  AbbreviationsTable = 0x18, // Address of abbreviations table

  InterpreterNumber = 0x1e, // Interpreter number
  InterpreterVersion = 0x1f, // Interpreter version

  ScreenHeightInLines = 0x20, // Screen height in lines
  ScreenWidthInChars = 0x21, // Screen width in characters
  ScreenWidthInUnits = 0x22, // Screen width in units
  ScreenHeightInUnits = 0x24, // Screen height in units

  RoutinesOffset = 0x28, // Offset to packed routines (V6-V7)
  StaticStringsOffset = 0x2a, // Offset to packed strings (V6-V7)

  DefaultBackgroundColor = 0x2c, // Default background color
  DefaultForegroundColor = 0x2d, // Default foreground color

  TerminatingChars = 0x2e, // Address of terminating characters table
  PixelWidth = 0x30, // Width of one pixel in units

  Revision = 0x32, // Revision number
  AlphabetTable = 0x34, // Address of custom alphabet table (if any)
  HeaderExtTable = 0x36, // Address of header extension table
}

/**
 * Known global variable indices
 */
export enum KnownGlobals {
  Location = 0, // Current location (common to all games)

  // For score games:
  Score = 1, // Current score
  NumTurns = 2, // Number of turns played

  // For time games:
  Hours = 1, // Current hour
  Minutes = 2, // Current minute
}

/**
 * Z-machine version numbers
 */
export enum ZVersion {
  V1 = 1,
  V2 = 2,
  V3 = 3,
  V4 = 4,
  V5 = 5,
  V6 = 6,
  V7 = 7,
  V8 = 8,
}

/**
 * Flags in Header.Flags1
 */
export enum Flags1 {
  // V1-V3
  DisplayStatusLine = 0x10, // Bit 4: Display status line
  SplitScreen = 0x20, // Bit 5: Screen can be split
  VariableFont = 0x40, // Bit 6: Variable-width font as default

  // V4+
  Colors = 0x01, // Bit 0: Colors available
  Pictures = 0x02, // Bit 1: Picture display available
  BoldFont = 0x04, // Bit 2: Bold available
  ItalicFont = 0x08, // Bit 3: Italic available
  FixedFont = 0x10, // Bit 4: Fixed-width font available
  Sound = 0x20, // Bit 5: Sound supported
  // Bit 6: Same as in V1-V3
  TimedInput = 0x80, // Bit 7: Timed keyboard input available
}

/**
 * Flags in Header.Flags2
 */
export enum Flags2 {
  Transcripting = 0x01, // Bit 0: Transcripting on/off
  ForcedFixedFont = 0x02, // Bit 1: Force fixed-width font
  RequestScreenRedraw = 0x04, // Bit 2: Request screen redraw (set by game)
  UseCustomAlphabet = 0x08, // Bit 3: Use pictures
  UsePictures = 0x10, // Bit 4: Use custom alphabet table
  UseSound = 0x20, // Bit 5: Use sound effects
  UseMenu = 0x40, // Bit 6: Use menus (V6)
  // Bits 7-15 undefined or reserved
}

/**
 * Types of chunks in snapshot files
 */
export enum SnapshotChunkType {
  Memory = 1,
  Stack = 2,
  Callstack = 3,
  Registers = 4,
}

/**
 * Default Z-machine alphabet table
 */
export const DEFAULT_ALPHABET_TABLE = [
  /* A0 */ "abcdefghijklmnopqrstuvwxyz",
  /* A1 */ "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  /* A2 */ " \n0123456789.,!?_#'\"/\\-:()",
];

/**
 * Interpreter identifiers
 */
export enum Interpreter {
  DEC_20 = 1,
  Apple_IIe = 2,
  Macintosh = 3,
  Amiga = 4,
  Atari_ST = 5,
  IBM_PC = 6,
  Commodore_128 = 7,
  Commodore_64 = 8,
  Apple_IIc = 9,
  Apple_IIGS = 10,
  Tandy_Color = 11,
}

/**
 * Maximum values for Z-machine
 */
export const MAX_OBJECTS_V3 = 255;
export const MAX_OBJECTS_V4 = 65535;
export const MAX_ATTRIBUTES_V3 = 32;
export const MAX_ATTRIBUTES_V4 = 48;
export const MAX_PROPERTIES_V3 = 31;
export const MAX_PROPERTIES_V4 = 63;
