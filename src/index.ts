/**
 * Main export file for the rezrov-zmachine library
 */

// Core memory handling
export { toI16, toU16 } from './core/memory/cast16';
export { Memory } from './core/memory/Memory';

// Interpreter internals are exported as types only: ZMachine exposes them (`executor`, `state`,
// `getUserStackManager()`) so they can be named in annotations, but they are not constructible API.
export type { Executor } from './core/execution/Executor';
export type { StackFrame } from './core/execution/StackFrame';
export type { UserStackManager } from './core/execution/UserStack';
export type { GameState } from './interpreter/GameState';
export { ZMachine } from './interpreter/ZMachine';

// Object system
export { GameObject } from './core/objects/GameObject';
export { GameObjectFactory } from './core/objects/GameObjectFactory';

// UI components
export { BufferMode, Color, TextStyle } from './types';
export { BaseInputProcessor, InputMode } from './ui/input/InputInterface';
export type { InputProcessor, InputState, MouseClick } from './ui/input/InputInterface';
export {
  BlorbMultimediaHandler,
  type BlorbMultimediaHandlerOptions,
  type PictureEraserCallback,
  type PictureRendererCallback,
  type SoundPlayerCallback,
} from './ui/multimedia/BlorbMultimediaHandler';
export { ResourceStatus, ResourceType } from './ui/multimedia/MultimediaHandler';
export type { MultimediaHandler, PictureData, ResourceInfo } from './ui/multimedia/MultimediaHandler';
export { BaseScreen } from './ui/screen/BaseScreen';
export { WindowProperty, WindowType } from './ui/screen/interfaces';
export type { Capabilities, Screen, ScreenSize } from './ui/screen/interfaces';
export { WindowEventType, WindowManager } from './ui/screen/WindowManager';
export type { WindowEvent, WindowEventHandler, WindowOptions, WindowState } from './ui/screen/WindowManager';

// Font system
export { translateFont3Text } from './ui/fonts/Font3Unicode';
export { FontType } from './ui/fonts/FontManager';
export type { FontManager } from './ui/fonts/FontManager';

// Parsing components
export { AlphabetTableManager } from './parsers/AlphabetTable';
export { Dictionary } from './parsers/Dictionary';
export { TextParser } from './parsers/TextParser';
export { decodeZString, encodeZString, packZCharacters } from './parsers/ZString';
export type { ZString } from './parsers/ZString';

// Resource handling (Blorb)
export { BlorbChunkType, BlorbMetadataType, BlorbUsage } from './resources/BlorbData';
export type { BlorbChunk, BlorbMap, BlorbResource } from './resources/BlorbData';
export { BlorbParser } from './resources/BlorbParser';
export { PALETTE_ENTRY_SIZE, findPaletteChunk, isPng, readPalette, replacePalette } from './resources/PngPalette';

// Storage components
export { createBrowserStorage, createMemoryStorage } from './storage/factory';
export { EnhancedDatFormat } from './storage/formats/EnhancedDatFormat';
export type { FormatProvider } from './storage/formats/FormatProvider';
export { QuetzalFormat } from './storage/formats/QuetzalFormat';
export type { SaveInfo, StorageInterface, StorageOptions, StorageStats } from './storage/interfaces';
export { BrowserStorageProvider } from './storage/providers/BrowserStorageProvider';
export { MemoryStorageProvider } from './storage/providers/MemoryStorageProvider';
export type { StorageProvider } from './storage/providers/StorageProvider';
export { Storage } from './storage/Storage';

// Constants and utilities
export {
  Flags1,
  Flags2,
  HeaderExtension,
  HeaderLocation,
  Interpreter,
  KnownGlobals,
  MouseClickCode,
} from './utils/constants';
export { dumpDictionary, dumpHeader, dumpObjectTable, dumpParseBuffer, dumpState, hex } from './utils/debug';
export { LogLevel, Logger } from './utils/log';
export type { LogSink } from './utils/log';

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
