/**
 * Main export file for the rezrov-zmachine library
 */

// Core memory handling
export { toI16, toU16 } from './core/memory/cast16';
export { Memory } from './core/memory/Memory';

// Execution components
export { Executor } from './core/execution/Executor';
export { createStackFrame } from './core/execution/StackFrame';
export type { StackFrame } from './core/execution/StackFrame';
export { SuspendState } from './core/execution/SuspendState';
export { UserStackManager } from './core/execution/UserStack';

// State management
export { GameState } from './interpreter/GameState';
export { ZMachine } from './interpreter/ZMachine';

// Object system
export { GameObject } from './core/objects/GameObject';
export { GameObjectFactory } from './core/objects/GameObjectFactory';

// UI components
export { BufferMode, Color, TextStyle } from './types';
export { BaseInputProcessor } from './ui/input/InputInterface';
export type { InputMode, InputProcessor, InputState } from './ui/input/InputInterface';
export { ResourceStatus, ResourceType } from './ui/multimedia/MultimediaHandler';
export type { MultimediaHandler, PictureData, ResourceInfo } from './ui/multimedia/MultimediaHandler';
export { BaseScreen } from './ui/screen/BaseScreen';
export type { Capabilities, Screen, ScreenSize } from './ui/screen/interfaces';
export { WindowProperty, WindowType } from './ui/screen/interfaces';
export { WindowManager } from './ui/screen/WindowManager';
export type { WindowState, WindowOptions, WindowEventType, WindowEvent, WindowEventHandler } from './ui/screen/WindowManager';

// Font system
export { FontManager, FontType } from './ui/fonts/FontManager';
export { Font3System } from './ui/fonts/Font3System';
export { FONT3_BITMAPS, getFont3Bitmap, hasFont3Bitmap, getAvailableFont3Codes } from './ui/fonts/Font3Bitmaps';

// Parsing components
export { AlphabetTableManager } from './parsers/AlphabetTable';
export { Dictionary } from './parsers/Dictionary';
export { TextParser } from './parsers/TextParser';
export { decodeZString, encodeZString, packZCharacters } from './parsers/ZString';
export type { ZString } from './parsers/ZString';

// Storage components
export { createBrowserStorage, createFileSystemStorage, createMemoryStorage } from './storage/factory';
export { EnhancedDatFormat } from './storage/formats/EnhancedDatFormat';
export type { FormatProvider } from './storage/formats/FormatProvider';
export { QuetzalFormat } from './storage/formats/QuetzalFormat';
export type { SaveInfo, StorageInterface, StorageOptions, StorageStats } from './storage/interfaces';
export { BrowserStorageProvider } from './storage/providers/BrowserStorageProvider';
export { FileSystemProvider } from './storage/providers/FileSystemProvider';
export { MemoryStorageProvider } from './storage/providers/MemoryStorageProvider';
export type { StorageProvider } from './storage/providers/StorageProvider';
export { Storage } from './storage/Storage';

// Constants and utilities
export { Flags1, Flags2, HeaderLocation, Interpreter, KnownGlobals } from './utils/constants';
export { dumpDictionary, dumpHeader, dumpObjectTable, dumpParseBuffer, dumpState, hex } from './utils/debug';
export { LogLevel, Logger } from './utils/log';
export { initRandom, random, randomInt, randomIntFrom0, randomSeed } from './utils/random';

// Types
export { InstructionForm, OperandType } from './types';
export type { Address, ZSCII } from './types';

// Z-Machine version capabilities
export {
  ZMachineVersion,
  getMaxTextBufferLength,
  getVersionCapabilities,
  unpackRoutineAddress,
  unpackStringAddress,
  usesLengthPrefixedText,
  versionSupports,
} from './interpreter/Version';
