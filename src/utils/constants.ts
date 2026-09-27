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
  FileLength = 0x1a, // Length of file (packed, see Z-spec §11.1.6)
  Checksum = 0x1c, // Checksum of file

  InterpreterNumber = 0x1e, // Interpreter number
  InterpreterVersion = 0x1f, // Interpreter version

  ScreenHeightInLines = 0x20, // Screen height in lines
  ScreenWidthInChars = 0x21, // Screen width in characters
  ScreenWidthInUnits = 0x22, // Screen width in units
  ScreenHeightInUnits = 0x24, // Screen height in units

  FontWidthInUnits = 0x26, // Font width in units (V5+)
  FontHeightInUnits = 0x27, // Font height in units (V5+)

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
 * Word indices in the header extension table (spec §11.1.7).
 * Word 0 holds the number of further words; a story may provide fewer than listed here.
 */
export enum HeaderExtension {
  Length = 0, // Number of further words in the table
  MouseX = 1, // X coordinate of the last mouse click (set by interpreter)
  MouseY = 2, // Y coordinate of the last mouse click (set by interpreter)
  UnicodeTable = 3, // Address of the Unicode translation table
  Flags3 = 4, // Flags 3 (bit 0: game wants transparency)
  TrueDefaultForeground = 5, // True default foreground colour
  TrueDefaultBackground = 6, // True default background colour
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
  // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values
  Hours = 1, // Current hour
  // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values
  Minutes = 2, // Current minute
}

/**
 * Flags in Header.Flags1
 */
export enum Flags1 {
  // V1-V3
  StatusLineNotAvailable = 0x10, // Bit 4: Status line NOT available (set by interpreter)
  SplitScreen = 0x20, // Bit 5: Screen can be split
  VariableFont = 0x40, // Bit 6: Variable-width font as default

  // V4+
  Colors = 0x01, // Bit 0: Colors available
  Pictures = 0x02, // Bit 1: Picture display available
  BoldFont = 0x04, // Bit 2: Bold available
  ItalicFont = 0x08, // Bit 3: Italic available
  // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values
  FixedFont = 0x10, // Bit 4: Fixed-width font available
  // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values
  Sound = 0x20, // Bit 5: Sound supported
  // Bit 6: Same as in V1-V3
  TimedInput = 0x80, // Bit 7: Timed keyboard input available
}

/**
 * Flags in Header.Flags2 (a word; bit numbers are within that word, per spec §11.1)
 *
 * The "Wants" bits are set by the game in its story file; the interpreter must clear
 * any it cannot provide so the game falls back to an alternative.
 */
export enum Flags2 {
  Transcribing = 0x01, // Bit 0: Transcripting on/off (game and interpreter)
  ForcedFixedFont = 0x02, // Bit 1: Game forces fixed-pitch printing (V3+)
  RequestScreenRedraw = 0x04, // Bit 2: Interpreter requests a screen redraw (V6)
  WantsPictures = 0x08, // Bit 3: Game wants to use pictures (V5+)
  WantsUndo = 0x10, // Bit 4: Game wants to use save_undo/restore_undo (V5+)
  WantsMouse = 0x20, // Bit 5: Game wants to use a mouse (V5+)
  WantsColors = 0x40, // Bit 6: Game wants to use colours (V5+)
  WantsSound = 0x80, // Bit 7: Game wants to use sound effects (V5+)
  WantsMenus = 0x100, // Bit 8: Game wants to use menus (V6)
  // Bits 9-15 unused
}

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
