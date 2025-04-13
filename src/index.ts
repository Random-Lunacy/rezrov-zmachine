/**
 * Main export file for the rezrov-zmachine library
 */

// Core exports
export { toI16, toU16 } from './core/memory/cast16';
export { Memory } from './core/memory/Memory';

// Execution exports
export { StackFrame, createStackFrame } from './core/execution/StackFrame';
export { SuspendState } from './core/execution/SuspendState';
export { GameState } from './interpreter/GameState';
export { ZMachine } from './interpreter/ZMachine';

// Object system exports
export { GameObject } from './core/objects/GameObject';

// UI exports
export { BufferMode, Color, TextStyle } from './types';
export { BaseScreen } from './ui/screen/BaseScreen';
export { Capabilities, Screen, ScreenSize } from './ui/screen/interfaces';

// Parser exports
export { Dictionary } from './parsers/Dictionary';
export { TextParser } from './parsers/TextParser';
export { ZString, decodeZString, encodeZString } from './parsers/ZString';

// Storage exports
export { Snapshot, Storage } from './storage/interfaces';
export { createSnapshotBuffer, readSnapshotFromBuffer } from './storage/Snapshot';

// Utility exports
export { HeaderLocation, KnownGlobals, ZVersion } from './utils/constants';
export { dumpDictionary, dumpHeader, dumpObjectTable, dumpParseBuffer, dumpState, hex } from './utils/debug';
export { LogLevel, Logger } from './utils/log';
export { initRandom, random, randomInt, randomSeed } from './utils/random';

// Type exports
export { Address, FIXME, InputState, InstructionForm, OperandType, ZSCII } from './types';
