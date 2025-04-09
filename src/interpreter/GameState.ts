import { Memory } from "../core/memory/Memory";
import { StackFrame, createStackFrame } from "../core/execution/StackFrame";
import { Address } from "../types";
import { GameObject } from "../core/objects/GameObject";
import { HeaderLocation } from "../utils/constants";
import { Snapshot } from "../storage/interfaces";

export class GameState {
  private _pc: Address = 0;
  private _stack: Array<number> = [];
  private _callstack: Array<StackFrame> = [];
  private _memory: Memory;
  private _version: number;

  // Cached header values
  private _highmem: number = 0;
  private _globalVars: number = 0;
  private _abbrevs: number = 0;
  private _objectTable: number = 0;
  private _dict: number = 0;
  private _routinesOffset: number = 0;
  private _stringsOffset: number = 0;

  // Game objects cache
  private _gameObjects: Map<number, GameObject> = new Map();

  constructor(memory: Memory, version: number) {
    this._memory = memory;
    this._version = version;

    // Read header values
    this._readHeaderValues();
  }

  private _readHeaderValues(): void {
    this._highmem = this._memory.getWord(HeaderLocation.HighMemBase);
    this._globalVars = this._memory.getWord(HeaderLocation.GlobalVariables);
    this._abbrevs = this._memory.getWord(HeaderLocation.AbbreviationsTable);
    this._objectTable = this._memory.getWord(HeaderLocation.ObjectTable);
    this._dict = this._memory.getWord(HeaderLocation.Dictionary);

    if (this._version === 6 || this._version === 7) {
      this._routinesOffset = this._memory.getWord(HeaderLocation.RoutinesOffset);
      this._stringsOffset = this._memory.getWord(HeaderLocation.StaticStringsOffset);
    }
  }

  get pc(): Address {
    return this._pc;
  }

  set pc(value: Address) {
    this._pc = value;
  }

  get version(): number {
    return this._version;
  }

  get memory(): Memory {
    return this._memory;
  }

  get stack(): Array<number> {
    return this._stack;
  }

  get callstack(): Array<StackFrame> {
    return this._callstack;
  }

  get globalVariablesAddress(): number {
    return this._globalVars;
  }

  get abbreviationsTableAddress(): number {
    return this._abbrevs;
  }

  get objectTableAddress(): number {
    return this._objectTable;
  }

  get dictionaryAddress(): number {
    return this._dict;
  }

  pushStack(value: number): void {
    if (value === undefined || value === null) {
      throw new Error("Invalid value for stack push");
    }
    this._stack.push(value);
  }

  popStack(): number {
    const value = this._stack.pop();
    if (value === undefined) {
      return 0;
    }
    return value;
  }

  peekStack(): number {
    if (this._stack.length === 0) {
      throw new Error("Cannot peek an empty stack");
    }
    return this._stack[this._stack.length - 1];
  }

  loadVariable(variable: number, peekTop: boolean = false): number {
    if (variable === 0) {
      return peekTop ? this.peekStack() : this.popStack();
    }

    if (variable < 16) {
      // Local variable
      if (this._callstack.length === 0) {
        throw new Error("No active call frame for local variable access");
      }

      const frame = this._callstack[this._callstack.length - 1];
      if (variable > frame.locals.length) {
        throw new Error(`Local variable ${variable} out of range. Only ${frame.locals.length} locals available.`);
      }

      return frame.locals[variable - 1];
    } else {
      // Global variable
      return this._memory.getWord(this._globalVars + 2 * (variable - 16));
    }
  }

  storeVariable(variable: number, value: number, replaceTop: boolean = false): void {
    if (variable === 0) {
      if (replaceTop) {
        this.popStack();
      }
      this.pushStack(value);
      return;
    }

    if (variable < 16) {
      // Local variable
      if (this._callstack.length === 0) {
        throw new Error("No active call frame for local variable store");
      }

      const frame = this._callstack[this._callstack.length - 1];
      if (variable > frame.locals.length) {
        throw new Error(`Local variable ${variable} out of range. Only ${frame.locals.length} locals available.`);
      }

      frame.locals[variable - 1] = value;
    } else {
      // Global variable
      this._memory.setWord(this._globalVars + 2 * (variable - 16), value);
    }
  }

  callRoutine(routineAddress: Address, returnVar: number | null, ...args: number[]): void {
    // Read the number of locals
    const numLocals = this._memory.getByte(routineAddress);
    let currentAddress = routineAddress + 1;

    // Initialize locals array
    const locals = new Uint16Array(15);

    if (this._version >= 5) {
      // In version 5+, locals default to 0
      for (let i = 0; i < numLocals; i++) {
        locals[i] = 0;
      }
    } else {
      // In earlier versions, locals are initialized from values after the count
      for (let i = 0; i < numLocals; i++) {
        locals[i] = this._memory.getWord(currentAddress);
        currentAddress += 2;
      }
    }

    // Arguments override the first locals
    const argCount = Math.min(args.length, numLocals);
    for (let i = 0; i < argCount; i++) {
      locals[i] = args[i];
    }

    // Create stack frame
    const frame = createStackFrame(
      this._pc,              // Return PC
      this._stack.length,    // Previous stack pointer
      numLocals,             // Number of locals
      returnVar !== null,    // Whether this call expects a result
      returnVar || 0,        // Variable to store result in
      args.length,           // Argument count
      routineAddress         // Routine address for debugging
    );

    // Update locals in the created frame
    for (let i = 0; i < numLocals; i++) {
      frame.locals[i] = locals[i];
    }

    // Push frame and update PC
    this._callstack.push(frame);
    this._pc = currentAddress;
  }

  returnFromRoutine(value: number): void {
    if (this._callstack.length === 0) {
      throw new Error("Cannot return - callstack is empty");
    }

    const frame = this._callstack.pop();

    // Store return value if needed
    if (frame.storesResult) {
      this.storeVariable(frame.resultVariable, value);
    }

    // Restore PC
    this._pc = frame.returnPC;
  }

  getArgumentCount(): number {
    if (this._callstack.length === 0) {
      return 0;
    }
    return this._callstack[this._callstack.length - 1].argumentCount;
  }

  getObject(objNum: number): GameObject | null {
    if (objNum === 0) {
      return null;
    }

    // Validate object number
    if ((this._version <= 3 && objNum > 255) || (this._version >= 4 && objNum > 65535)) {
      throw new Error(`Invalid object number: ${objNum}`);
    }

    // Return cached object or create new one
    let obj = this._gameObjects.get(objNum);
    if (!obj) {
      obj = new GameObject(this, objNum);
      this._gameObjects.set(objNum, obj);
    }

    return obj;
  }

  unpackRoutineAddress(packedAddr: Address): Address {
    if (this._version <= 3) {
      return 2 * packedAddr;
    } else if (this._version <= 5) {
      return 4 * packedAddr;
    } else if (this._version <= 7) {
      return 4 * packedAddr + this._routinesOffset;
    } else if (this._version === 8) {
      return 8 * packedAddr;
    } else {
      throw new Error(`Unknown version: ${this._version}`);
    }
  }

  unpackStringAddress(packedAddr: Address): Address {
    if (this._version <= 3) {
      return 2 * packedAddr;
    } else if (this._version <= 5) {
      return 4 * packedAddr;
    } else if (this._version <= 7) {
      return 4 * packedAddr + this._stringsOffset;
    } else if (this._version === 8) {
      return 8 * packedAddr;
    } else {
      throw new Error(`Unknown version: ${this._version}`);
    }
  }

  createSnapshot(): Snapshot {
    return {
      mem: Buffer.from(this._memory.buffer),
      stack: [...this._stack],
      callstack: [...this._callstack],
      pc: this._pc
    };
  }

  restoreFromSnapshot(snapshot: Snapshot): void {
    // Restore PC
    this._pc = snapshot.pc;

    // Restore stack
    this._stack = [...snapshot.stack];

    // Restore callstack
    this._callstack = [...snapshot.callstack];

    // Restore memory (no need to re-read header values as they should be the same)
    // If headers need to be re-read, call this._readHeaderValues() after restoring memory
  }


  /**
   * Process a branch instruction
   * @param cond Branch condition
   * @param condfalse Whether to branch on false instead of true
   * @param offset Branch offset
   */
  doBranch(cond: boolean, condfalse: boolean, offset: number): void {
    this.logger.debug(`     Branch condition: ${cond}, invert: ${!condfalse}, offset: ${offset}`);

    // Branch if (condition is true and !condfalse) or (condition is false and condfalse)
    if ((cond && !condfalse) || (!cond && condfalse)) {
      if (offset === 0) {
        this.logger.debug("     Returning false");
        this.returnFromRoutine(0);
      } else if (offset === 1) {
        this.logger.debug("     Returning true");
        this.returnFromRoutine(1);
      } else {
        this.pc = this.pc + offset - 2;
        if (this.pc < 0 || this.pc > this.memory.size) {
          throw new Error(`Branch out of bounds: ${this.pc}`);
        }
        this.logger.debug(`     Taking branch to ${this.pc.toString(16)}!`);
      }
    }
  }

  /**
   * Read a branch offset
   * @returns [offset, condfalse]
   */
  readBranchOffset(): [number, boolean] {
    const branchData = this.readByte();
    let off1 = branchData & 0x3f;
    let offset: number;

    if ((branchData & 0x40) === 0x40) {
      // 1 byte offset
      offset = off1;
    } else {
      // 2 byte offset - propagate sign bit
      if ((off1 & 0x20) !== 0) {
        off1 |= 0xc0;
      }
      offset = (off1 << 8) | this.readByte();
    }

    // Branch conditions: 0 in bit 7 means "branch on true"
    return [offset, (branchData & 0x80) === 0x00];
  }
}
