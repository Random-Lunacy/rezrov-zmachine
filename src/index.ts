/**
 * Main export file for the rezrov-zmachine library
 */

// Core exports
export { toI16, toU16 } from './core/memory/cast16';
export { Memory } from './core/memory/Memory';

// Execution exports
export { createStackFrame } from './core/execution/StackFrame';
export type { StackFrame } from './core/execution/StackFrame';
export { SuspendState } from './core/execution/SuspendState';
export { GameState } from './interpreter/GameState';
export { ZMachine } from './interpreter/ZMachine';

// Object system exports
export { GameObject } from './core/objects/GameObject';

// UI exports
export { BufferMode, Color, TextStyle } from './types';
export { BaseScreen } from './ui/screen/BaseScreen';
export type { Capabilities, Screen, ScreenSize } from './ui/screen/interfaces';

// Parser exports
export { Dictionary } from './parsers/Dictionary';
export { TextParser } from './parsers/TextParser';
export { decodeZString, encodeZString } from './parsers/ZString';
export type { ZString } from './parsers/ZString';

// Storage exports
export { createBrowserStorage, createFileSystemStorage, createMemoryStorage } from './storage/factory';
export { EnhancedDatFormat } from './storage/formats/EnhancedDatFormat';
export type { FormatProvider } from './storage/formats/FormatProvider';
export { QuetzalFormat } from './storage/formats/QuetzalFormat';
export { BrowserStorageProvider } from './storage/providers/BrowserStorageProvider';
export { FileSystemProvider } from './storage/providers/FileSystemProvider';
export { MemoryStorageProvider } from './storage/providers/MemoryStorageProvider';
export type { StorageProvider } from './storage/providers/StorageProvider';
export { Storage } from './storage/Storage';

// Utility exports
export { HeaderLocation, KnownGlobals, ZVersion } from './utils/constants';
export { dumpDictionary, dumpHeader, dumpObjectTable, dumpParseBuffer, dumpState, hex } from './utils/debug';
export { LogLevel, Logger } from './utils/log';
export { initRandom, random, randomInt, randomSeed } from './utils/random';

// Type exports
export { InstructionForm, OperandType } from './types';
export type { Address, FIXME, ZSCII } from './types';
