export enum HeaderLocation {
  Version = 0x00,
  Flags1 = 0x01,
  HighMemBase = 0x04,
  InitialPC = 0x06,
  Dictionary = 0x08,
  ObjectTable = 0x0a,
  GlobalVariables = 0x0c,
  StaticMemBase = 0x0e,
  Flags2 = 0x10,
  AbbreviationsTable = 0x18,

  InterpreterNumber = 0x1e,
  InterpreterVersion = 0x1f,

  ScreenHeightInLines = 0x20,
  ScreenWidthInChars = 0x21,
  ScreenWidthInUnits = 0x22,
  ScreenHeightInUnits = 0x24,

  RoutinesOffset = 0x28,
  StaticStringsOffset = 0x2a,
}

export enum KnownGlobals {
  Location = 0,
  // for score games:
  Score = 1,
  NumTurns = 2,
  // for time games:
  Hours = 1,
  Minutes = 2,
}
