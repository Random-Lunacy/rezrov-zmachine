#!/bin/bash

# Create src directory and its subdirectories
mkdir -p src/{core/{memory,execution,objects,opcodes},interpreter,ui/{screen,input,multimedia},parsers,storage,utils}

# Create types.ts in the root src directory
cat > src/types.ts << 'EOF'
export type Address = number;
export type ZSCII = number;

// Other shared types will go here
EOF

# Create core/memory files
cat > src/core/memory/Memory.ts << 'EOF'
import { Address } from '../../types';

export class Memory {
  private _mem: Buffer;

  constructor(buffer: Buffer) {
    this._mem = buffer;
  }

  getByte(addr: Address): number {
    if (addr < 0 || addr >= this._mem.length) {
      throw new Error(`Memory access out of bounds: ${addr}`);
    }
    return this._mem[addr];
  }

  setByte(addr: Address, b: number): void {
    if (addr < 0 || addr >= this._mem.length) {
      throw new Error(`Memory access out of bounds: ${addr}`);
    }
    this._mem[addr] = b;
  }

  // Additional memory operations will go here
  
  get buffer(): Buffer {
    return this._mem;
  }
}
EOF

cat > src/core/memory/cast16.ts << 'EOF'
const cvt_buffer = new ArrayBuffer(2);
const i16_array = new Int16Array(cvt_buffer);
const u16_array = new Uint16Array(cvt_buffer);

export function toI16(ui16: number): number {
  u16_array[0] = ui16;
  return i16_array[0];
}

export function toU16(i16: number): number {
  i16_array[0] = i16;
  return u16_array[0];
}
EOF

# Create core/execution files
cat > src/core/execution/Executor.ts << 'EOF'
import { Memory } from '../memory/Memory';
import { GameState } from '../../interpreter/GameState';
import { Logger } from '../../utils/log';
import { SuspendState } from './SuspendState';

export class Executor {
  private memory: Memory;
  private state: GameState;
  private logger: Logger;
  private _quit: boolean = false;

  constructor(memory: Memory, state: GameState, logger: Logger) {
    this.memory = memory;
    this.state = state;
    this.logger = logger;
  }

  executeLoop(): void {
    try {
      while (!this._quit) {
        this.executeInstruction();
      }
    } catch (e) {
      if (e instanceof SuspendState) {
        // Handle suspension for user input
      } else {
        this.logger.error(e);
      }
    }
  }

  executeInstruction(): void {
    // Instruction execution logic will go here
  }

  // Additional execution methods will go here
  
  quit(): void {
    this._quit = true;
  }
}
EOF

cat > src/core/execution/CallFrame.ts << 'EOF'
export interface CallFrame {
  method_pc: number;
  return_pc: number;
  return_value_location: number | null;
  locals: Array<number>;
  arg_count: number;
}
EOF

cat > src/core/execution/SuspendState.ts << 'EOF'
export type InputState = {
  // will be false for a "read" instruction, true for a "read_char" instruction
  keyPress: boolean;
  resultVar: number;

  // will only be filled in for keyPress === false
  textBuffer?: number;
  parseBuffer?: number;
  time?: unknown;
  routine?: unknown;
};

export class SuspendState {
  private _state: InputState;
  
  constructor(state: InputState) {
    this._state = state;
  }
  
  get state() {
    return this._state;
  }
}
EOF

# Create core/objects files
cat > src/core/objects/GameObject.ts << 'EOF'
import { Memory } from '../memory/Memory';
import { Address } from '../../types';
import { Logger } from '../../utils/log';

export class GameObject {
  private memory: Memory;
  private logger: Logger;
  private version: number;
  
  readonly objnum: number;
  private objaddr: Address;

  constructor(memory: Memory, logger: Logger, version: number, objnum: number, objectTable: number) {
    this.memory = memory;
    this.logger = logger;
    this.version = version;
    this.objnum = objnum;

    if (version <= 3) {
      this.objaddr = objectTable + 31 * 2 + (objnum - 1) * 9;
    } else {
      this.objaddr = objectTable + 63 * 2 + (objnum - 1) * 14;
    }
  }

  // Object properties and methods will go here
}
EOF

# Create core/opcodes files
cat > src/core/opcodes/base.ts << 'EOF'
import { ZMachine } from '../../interpreter/ZMachine';

export type OpcodeFn = (machine: ZMachine, ...operands: Array<number>) => void;

export type Opcode = { 
  mnemonic: string; 
  impl: OpcodeFn 
};

export function opcode(mnemonic: string, impl: OpcodeFn): Opcode {
  return { mnemonic, impl };
}

export function unimplementedOpcode(mnemonic: string): Opcode {
  return opcode(mnemonic, () => {
    throw new Error(`Unimplemented opcode: ${mnemonic}`);
  });
}
EOF

cat > src/core/opcodes/index.ts << 'EOF'
import { mathOpcodes } from './math';
import { objectOpcodes } from './object';
import { stackOpcodes } from './stack';
import { ioOpcodes } from './io';

export const opcodes = {
  ...mathOpcodes,
  ...objectOpcodes,
  ...stackOpcodes,
  ...ioOpcodes,
};

export * from './base';
EOF

# Create placeholder opcode files
for file in math object stack io; do
  cat > src/core/opcodes/${file}.ts << EOF
import { ZMachine } from '../../interpreter/ZMachine';
import { opcode } from './base';
import { toI16, toU16 } from '../memory/cast16';

// ${file} opcodes will go here

export const ${file}Opcodes = {
  // Opcode implementations will go here
};
EOF
done

# Create interpreter files
cat > src/interpreter/ZMachine.ts << 'EOF'
import { Memory } from '../core/memory/Memory';
import { Executor } from '../core/execution/Executor';
import { GameState } from './GameState';
import { Screen } from '../ui/screen/interfaces';
import { Storage } from '../storage/interfaces';
import { Logger } from '../utils/log';
import { HeaderLocation } from '../utils/constants';

export class ZMachine {
  private memory: Memory;
  private executor: Executor;
  private state: GameState;
  private screen: Screen;
  private storage: Storage;
  private logger: Logger;

  constructor(
    storyBuffer: Buffer,
    logger: Logger,
    screen: Screen,
    storage: Storage
  ) {
    this.memory = new Memory(storyBuffer);
    this.logger = logger;
    this.screen = screen;
    this.storage = storage;
    
    // Initialize state
    const version = this.memory.getByte(HeaderLocation.Version);
    this.state = new GameState(this.memory, version);
    
    // Initialize executor
    this.executor = new Executor(this.memory, this.state, this.logger);
  }

  // Z-machine methods will go here
}
EOF

cat > src/interpreter/GameState.ts << 'EOF'
import { Memory } from '../core/memory/Memory';
import { CallFrame } from '../core/execution/CallFrame';
import { Address } from '../types';
import { GameObject } from '../core/objects/GameObject';

export class GameState {
  private _pc: Address = 0;
  private _stack: Array<number> = [];
  private _callstack: Array<CallFrame> = [];
  private _memory: Memory;
  private _version: number;
  
  // Cached header values
  private _highmem: number = 0;
  private _global_vars: number = 0;
  private _abbrevs: number = 0;
  private _object_table: number = 0;
  private _dict: number = 0;
  
  // Game objects cache
  private _game_objects: Map<number, GameObject> = new Map();
  
  constructor(memory: Memory, version: number) {
    this._memory = memory;
    this._version = version;
    
    // Read header values
    this._readHeaderValues();
  }
  
  private _readHeaderValues(): void {
    // Read important header values
  }
  
  // State management methods will go here
}
EOF

cat > src/interpreter/Version.ts << 'EOF'
export enum ZMachineVersion {
  V1 = 1,
  V2 = 2,
  V3 = 3,
  V4 = 4,
  V5 = 5,
  V6 = 6,
  V7 = 7,
  V8 = 8,
}

export function getVersionCapabilities(version: ZMachineVersion) {
  // Return version-specific capabilities
}
EOF

# Create UI files
cat > src/ui/screen/interfaces.ts << 'EOF'
import { ZMachine } from '../../interpreter/ZMachine';
import { InputState } from '../input/InputHandler';

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
EOF

cat > src/ui/screen/BaseScreen.ts << 'EOF'
import { Screen, Capabilities, ScreenSize } from './interfaces';
import { ZMachine } from '../../interpreter/ZMachine';
import { InputState } from '../input/InputHandler';
import { Logger } from '../../utils/log';

export class BaseScreen implements Screen {
  protected logger: Logger;
  protected id: string;

  constructor(logger: Logger, id: string) {
    this.logger = logger;
    this.id = id;
  }

  getCapabilities(): Capabilities {
    this.logger.debug(`not implemented: ${this.id} getCapabilities`);
    return {
      hasColors: false,
      hasBold: false,
      hasItalic: false,
      hasReverseVideo: false,
      hasFixedPitch: false,
      hasSplitWindow: false,
      hasDisplayStatusBar: false,
      hasPictures: false,
      hasSound: false,
      hasTimedKeyboardInput: false,
    };
  }

  // Screen implementation methods will go here

  getSize(): ScreenSize {
    return { rows: 25, cols: 80 };
  }

  // Other required methods will be implemented here
  getInputFromUser(machine: ZMachine, inputState: InputState): void {}
  getKeyFromUser(machine: ZMachine, inputState: InputState): void {}
  print(machine: ZMachine, str: string): void {}
  updateStatusBar(lhs: string, rhs: string): void {}
  quit(): void {}
}
EOF

cat > src/ui/input/InputHandler.ts << 'EOF'
import { ZMachine } from '../../interpreter/ZMachine';
import { Screen } from '../screen/interfaces';

export type InputState = {
  keyPress: boolean;
  resultVar: number;
  textBuffer?: number;
  parseBuffer?: number;
  time?: unknown;
  routine?: unknown;
};

export class InputHandler {
  private machine: ZMachine;
  private screen: Screen;

  constructor(machine: ZMachine, screen: Screen) {
    this.machine = machine;
    this.screen = screen;
  }

  handleInput(inputState: InputState): void {
    // Input handling logic will go here
  }

  // Additional input handling methods will go here
}
EOF

# Create parsers files
cat > src/parsers/ZString.ts << 'EOF'
import { Memory } from '../core/memory/Memory';
import { ZSCII } from '../types';

export type ZString = Array<ZSCII>;

const alphabet_table = [
  /* A0 */ "abcdefghijklmnopqrstuvwxyz",
  /* A1 */ "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  /* A2 */ " \n0123456789.,!?_#'\"/\\-:()",
];

export function decodeZString(memory: Memory, zstr: ZString, expand: boolean = false): string {
  // Z-string decoding logic will go here
  return "";
}

export function encodeZString(text: string, padding: number = 0x05): ZString {
  // Z-string encoding logic will go here
  return [];
}
EOF

cat > src/parsers/Dictionary.ts << 'EOF'
import { Memory } from '../core/memory/Memory';
import { Address } from '../types';
import { Logger } from '../utils/log';

export class Dictionary {
  private memory: Memory;
  private logger: Logger;
  private dictAddr: Address;
  private separators: Array<number>;

  constructor(memory: Memory, logger: Logger, dictAddr: Address) {
    this.memory = memory;
    this.logger = logger;
    this.dictAddr = dictAddr;
    
    // Read separators from dictionary
    this.separators = this.readSeparators();
  }

  private readSeparators(): Array<number> {
    // Read separator characters from the dictionary
    return [];
  }

  // Dictionary operations will go here
}
EOF

cat > src/parsers/TextParser.ts << 'EOF'
import { Memory } from '../core/memory/Memory';
import { Dictionary } from './Dictionary';
import { Logger } from '../utils/log';

export class TextParser {
  private memory: Memory;
  private dictionary: Dictionary;
  private logger: Logger;

  constructor(memory: Memory, dictionary: Dictionary, logger: Logger) {
    this.memory = memory;
    this.dictionary = dictionary;
    this.logger = logger;
  }

  tokeniseLine(textBuffer: number, parseBuffer: number, dict: number = 0, flag: boolean = false): void {
    // Text parsing implementation will go here
  }

  // Additional parsing methods will go here
}
EOF

# Create storage files
cat > src/storage/interfaces.ts << 'EOF'
export interface Snapshot {
  mem: Buffer;
  stack: Array<number>;
  callstack: Array<any>; // Will be replaced with CallFrame type
  pc: number;
}

export interface Storage {
  saveSnapshot(snapshot: Snapshot): void;
  loadSnapshot(): Snapshot;
}
EOF

cat > src/storage/Snapshot.ts << 'EOF'
import { Snapshot } from './interfaces';
import { CallFrame } from '../core/execution/CallFrame';

enum SnapshotChunkType {
  Memory = 1,
  Stack = 2,
  Callstack = 3,
  Registers = 4,
}

export function createSnapshotBuffer(snapshot: Snapshot): Buffer {
  // Snapshot creation logic will go here
  return Buffer.alloc(0);
}

export function readSnapshotFromBuffer(buffer: Buffer): Snapshot {
  // Snapshot reading logic will go here
  return {
    mem: Buffer.alloc(0),
    stack: [],
    callstack: [],
    pc: 0
  };
}
EOF

# Create utils files
cat > src/utils/log.ts << 'EOF'
export enum LogLevel {
  DEBUG,
  INFO,
  WARN,
  ERROR
}

export class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  debug(msg: string): void {
    if (this.level <= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${msg}`);
    }
  }

  info(msg: string): void {
    if (this.level <= LogLevel.INFO) {
      console.log(`[INFO] ${msg}`);
    }
  }

  warn(msg: string): void {
    if (this.level <= LogLevel.WARN) {
      console.log(`[WARN] ${msg}`);
    }
  }

  error(msg: string): void {
    if (this.level <= LogLevel.ERROR) {
      console.log(`[ERROR] ${msg}`);
    }
  }
}
EOF

cat > src/utils/random.ts << 'EOF'
let rng: () => number;

// Initialize with a default seed
initRandom();

export function initRandom(seed?: string): void {
  if (seed) {
    // Use seeded random number generator
    // Implementation will depend on the library used
  } else {
    // Use Math.random as a fallback
    rng = Math.random;
  }
}

export function randomInt(range: number): number {
  return Math.floor(rng() * range + 1);
}
EOF

cat > src/utils/debug.ts << 'EOF'
import { ZMachine } from '../interpreter/ZMachine';

export function hex(v: number): string {
  return v !== undefined ? v.toString(16) : "";
}

export function dumpHeader(machine: ZMachine): void {
  // Header dumping logic will go here
}

export function dumpObjectTable(machine: ZMachine): void {
  // Object table dumping logic will go here
}

export function dumpDictionary(machine: ZMachine): void {
  // Dictionary dumping logic will go here
}

export function dumpParsebuffer(machine: ZMachine, parsebuffer: number): void {
  // Parse buffer dumping logic will go here
}
EOF

cat > src/utils/constants.ts << 'EOF'
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
EOF

# Create index.ts in the root src directory
cat > src/index.ts << 'EOF'
export { ZMachine } from './interpreter/ZMachine';
export { GameState } from './interpreter/GameState';
export { GameObject } from './core/objects/GameObject';
export { Memory } from './core/memory/Memory';
export { Screen, TextStyle, Color, BufferMode } from './ui/screen/interfaces';
export { BaseScreen } from './ui/screen/BaseScreen';
export { Logger, LogLevel } from './utils/log';

// Additional exports will go here
EOF

# Create package.json
cat > package.json << 'EOF'
{
  "name": "ebozz-restructured",
  "version": "1.0.0",
  "description": "Restructured Z-machine interpreter in TypeScript",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "format": "prettier -w package.json src/**",
    "lint": "eslint src/**"
  },
  "author": "",
  "license": "MIT",
  "devDependencies": {
    "eslint": "^8.38.0",
    "eslint-config-prettier": "^8.8.0",
    "eslint-plugin-prettier": "^4.2.1",
    "prettier": "^2.8.7",
    "typescript": "^5.0.4"
  }
}
EOF

# Create tsconfig.json
cat > tsconfig.json << 'EOF'
{
  "include": ["src/**/*"],
  "compilerOptions": {
    "composite": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2020",
    "sourceMap": true,
    "outDir": "dist",
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
EOF

