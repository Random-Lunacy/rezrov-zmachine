/**
 * Main export file for the rezrov-zmachine library
 */

// Core exports
export { Memory } from "./core/memory/Memory";
export { toI16, toU16 } from "./core/memory/cast16";

// Execution exports
export { ZMachine } from "./interpreter/ZMachine";
export { GameState } from "./interpreter/GameState";
export { StackFrame, createStackFrame } from "./core/execution/StackFrame";
export { SuspendState } from "./core/execution/SuspendState";

// Object system exports
export { GameObject } from "./core/objects/GameObject";

// UI exports
export { Screen, Capabilities, ScreenSize } from "./ui/screen/interfaces";
export { TextStyle, Color, BufferMode } from "./types";
export { BaseScreen } from "./ui/screen/BaseScreen";

// Parser exports
export { decodeZString, encodeZString, ZString } from "./parsers/ZString";
export { Dictionary } from "./parsers/Dictionary";
export { TextParser } from "./parsers/TextParser";

// Storage exports
export { Snapshot, Storage } from "./storage/interfaces";
export { createSnapshotBuffer, readSnapshotFromBuffer } from "./storage/Snapshot";

// Utility exports
export { Logger, LogLevel } from "./utils/log";
export {
  initRandom,
  randomSeed,
  randomInt,
  random
} from "./utils/random";
export {
  dumpHeader,
  dumpObjectTable,
  dumpDictionary,
  dumpParseBuffer,
  dumpState,
  hex
} from "./utils/debug";
export {
  HeaderLocation,
  KnownGlobals,
  ZVersion
} from "./utils/constants";

// Type exports
export {
  Address,
  ZSCII,
  InputState,
  InstructionForm,
  OperandType,
  FIXME
} from "./types";
