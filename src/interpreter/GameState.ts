import { createStackFrame, deserializeStackFrame, serializeStackFrame, StackFrame } from '../core/execution/StackFrame';
import { Memory } from '../core/memory/Memory';
import { GameObject } from '../core/objects/GameObject';
import { GameObjectFactory } from '../core/objects/GameObjectFactory';
import { TextParser } from '../parsers/TextParser';
import { Address, ZMachineState } from '../types';
import { HeaderLocation } from '../utils/constants';
import { hex } from '../utils/debug';
import { Logger } from '../utils/log';

/**
 * Represents the complete state of a Z-machine game
 */
export class GameState {
  private _pc: Address = 0;
  private _stack: Array<number> = [];
  private _callstack: Array<StackFrame> = [];
  private readonly _memory: Memory;
  private readonly _version: number;

  // Cached header values
  private _highMem: number = 0;
  private _globalVars: number = 0;
  private _abbrevs: number = 0;
  private _objectTable: number = 0;
  private _dict: number = 0;
  private _routinesOffset: number = 0;
  private _stringsOffset: number = 0;

  // Game objects factory
  private readonly _objectFactory: GameObjectFactory;

  // Parser
  private _textParser: TextParser | null = null;

  // Logger for output and debugging
  private readonly logger: Logger;

  /**
   * Create a new game state
   * @param memory Memory instance
   * @param logger Optional logger instance
   */
  constructor(memory: Memory, options?: { logger?: Logger }) {
    this._memory = memory;
    this.logger = options?.logger || new Logger('GameState');
    this._version = this._memory.getByte(HeaderLocation.Version);

    // Read header values
    this._readHeaderValues();

    // Initialize object factory
    this._objectFactory = new GameObjectFactory(this._memory, this._version, this._objectTable, options);
  }

  /**
   * Read and cache header values
   */
  private _readHeaderValues(): void {
    this._highMem = this._memory.getWord(HeaderLocation.HighMemBase);
    this._globalVars = this._memory.getWord(HeaderLocation.GlobalVariables);
    this._abbrevs = this._memory.getWord(HeaderLocation.AbbreviationsTable);
    this._objectTable = this._memory.getWord(HeaderLocation.ObjectTable);
    this._dict = this._memory.getWord(HeaderLocation.Dictionary);

    if (this._version === 6 || this._version === 7) {
      this._routinesOffset = this._memory.getWord(HeaderLocation.RoutinesOffset);
      this._stringsOffset = this._memory.getWord(HeaderLocation.StaticStringsOffset);
    }

    this.logger.debug(`Z-machine version: ${this._version}`);
    this.logger.debug(`Global variables address: 0x${this._globalVars.toString(16)}`);
    this.logger.debug(`Object table address: 0x${this._objectTable.toString(16)}`);
    this.logger.debug(`Dictionary address: 0x${this._dict.toString(16)}`);
  }

  /**
   * Get the program counter
   */
  get pc(): Address {
    return this._pc;
  }

  /**
   * Set the program counter
   */
  set pc(value: Address) {
    this._pc = value;
  }

  /**
   * Get the Z-machine version
   */
  get version(): number {
    return this._version;
  }

  /**
   * Get the memory interface
   */
  get memory(): Memory {
    return this._memory;
  }

  /**
   * Get the stack
   */
  get stack(): Array<number> {
    return this._stack;
  }

  /**
   * Get the call stack
   */
  get callstack(): Array<StackFrame> {
    return this._callstack;
  }

  /**
   * Get the global variables address
   */
  get globalVariablesAddress(): number {
    return this._globalVars;
  }

  /**
   * Get the abbreviations table address
   */
  get abbreviationsTableAddress(): number {
    return this._abbrevs;
  }

  /**
   * Get the object table address
   */
  get objectTableAddress(): number {
    return this._objectTable;
  }

  /**
   * Get the dictionary address
   */
  get dictionaryAddress(): number {
    return this._dict;
  }

  public get highMem(): number {
    return this._highMem;
  }

  public get routinesOffset(): number {
    return this._routinesOffset;
  }

  public get stringsOffset(): number {
    return this._stringsOffset;
  }

  /**
   * Push a value onto the stack
   * @param value Value to push
   */
  pushStack(value: number): void {
    if (value === undefined || value === null) {
      throw new Error('Invalid value for stack push');
    }
    this._stack.push(value);
    this.logger.debug(`Pushed ${value} (0x${value.toString(16)}) onto stack`);
  }

  /**
   * Pop a value from the stack
   * @returns The popped value
   */
  popStack(): number {
    if (this._stack.length === 0) {
      this.logger.warn('Attempted to pop from empty stack; returning 0');
      return 0;
    }

    const value = this._stack.pop()!;
    this.logger.debug(`Popped ${value} (0x${value.toString(16)}) from stack`);
    return value;
  }

  /**
   * Peek at the top value on the stack without removing it
   * @returns The top value
   */
  peekStack(): number {
    if (this._stack.length === 0) {
      throw new Error('Cannot peek an empty stack');
    }
    return this._stack[this._stack.length - 1];
  }

  /**
   * Load a value from a variable
   * @param variable Variable number (0 = stack, 1-15 = local, 16+ = global)
   * @param peekTop Whether to peek at the stack instead of popping for variable 0
   * @returns The variable's value
   */
  loadVariable(variable: number, peekTop: boolean = false): number {
    if (variable === 0) {
      return peekTop ? this.peekStack() : this.popStack();
    }

    if (variable < 16) {
      // Local variable
      if (this._callstack.length === 0) {
        throw new Error('No active call frame for local variable access');
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

  /**
   * Store a value in a variable
   * @param variable Variable number (0 = stack, 1-15 = local, 16+ = global)
   * @param value Value to store
   * @param replaceTop Whether to replace the top stack value instead of pushing for variable 0
   */
  storeVariable(variable: number, value: number, replaceTop: boolean = false): void {
    if (variable === 0) {
      if (replaceTop && this._stack.length > 0) {
        this.popStack();
      }
      this.pushStack(value);
      return;
    }

    if (variable < 16) {
      // Local variable
      if (this._callstack.length === 0) {
        throw new Error('No active call frame for local variable store');
      }

      const frame = this._callstack[this._callstack.length - 1];
      if (variable > frame.locals.length) {
        throw new Error(`Local variable ${variable} out of range. Only ${frame.locals.length} locals available.`);
      }

      frame.locals[variable - 1] = value;
      this.logger.debug(`Stored ${value} (0x${hex(value)}) in L${hex(variable)}`);
    } else {
      // Global variable
      const addr = this._globalVars + 2 * (variable - 16);
      this._memory.setWord(addr, value);
      this.logger.debug(`Stored ${value} (0x${hex(value)}) in G${hex(variable - 16)}`);
    }
  }

  /**
   * Call a routine
   * @param routineAddress Address of the routine to call
   * @param returnVar Variable to store the result in, or null if no result expected
   * @param args Arguments to pass to the routine
   */
  callRoutine(routineAddress: Address, returnVar: number | null, ...args: number[]): void {
    // Handle 0 address as a special case
    if (routineAddress === 0) {
      if (returnVar !== null) {
        this.storeVariable(returnVar, 0);
      }
      return;
    }

    // Read the number of locals
    const numLocals = this._memory.getByte(routineAddress);
    let currentAddress = routineAddress + 1;

    this.logger.debug(
      `Calling routine at 0x${routineAddress.toString(16)} with ${args.length} args, ${numLocals} locals`
    );

    // Initialize locals array
    const locals = new Uint16Array(numLocals);

    if (this._version >= 5) {
      // In version 5+, locals default to 0
      // No need to initialize, Uint16Array already has zeros
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
      this._pc, // Return PC
      this._stack.length, // Previous stack pointer
      numLocals, // Number of locals
      returnVar !== null, // Whether this call expects a result
      returnVar || 0, // Variable to store result in
      args.length, // Argument count
      routineAddress // Routine address for debugging
    );

    // Copy locals to the frame
    for (let i = 0; i < numLocals; i++) {
      frame.locals[i] = locals[i];
    }

    // Push frame and update PC
    this._callstack.push(frame);
    this._pc = currentAddress;
  }

  /**
   * Return from a routine
   * @param value Value to return
   */
  returnFromRoutine(value: number): void {
    if (this._callstack.length === 0) {
      throw new Error('Cannot return - callstack is empty');
    }

    const frame = this._callstack.pop()!;
    this.logger.debug(`Returning from routine with value ${value} (0x${value.toString(16)})`);

    // Store return value if needed
    if (frame.resultVariable !== null) {
      this.storeVariable(frame.resultVariable, value);
    }

    // Restore PC
    this._pc = frame.returnPC;
  }

  /**
   * Get the number of arguments passed to the current routine
   */
  getArgumentCount(): number {
    if (this._callstack.length === 0) {
      return 0;
    }
    return this._callstack[this._callstack.length - 1].argumentCount;
  }

  /**
   * Get a game object by its number
   * @param objNum Object number
   * @returns The game object or null
   */
  getObject(objNum: number): GameObject | null {
    return this._objectFactory.getObject(objNum);
  }

  /**
   * Find all root objects (objects with no parent)
   * @returns Array of root objects
   */
  getRootObjects(): GameObject[] {
    return this._objectFactory.findRootObjects();
  }

  /**
   * Create a snapshot of the current game state
   * @returns ZMachineState object
   */
  createSnapshot(): ZMachineState {
    return {
      memory: Buffer.from(this._memory.buffer),
      pc: this._pc,
      stack: [...this._stack],
      callFrames: this._callstack.map((frame) => serializeStackFrame(frame)),
      originalStory: Buffer.from(this._memory.buffer), // You might want to get this from elsewhere
    };
  }

  /**
   * Restore the game state from a snapshot
   * @param snapshot ZMachineState to restore from
   */
  restoreFromSnapshot(state: ZMachineState): void {
    // Reset object cache to ensure clean state
    this._objectFactory.resetCache();

    // Restore program counter
    this._pc = state.pc;

    // Restore stack
    this._stack = [...state.stack];

    // Restore call stack (converting serialized frames back to StackFrame objects)
    this._callstack = state.callFrames.map((frame) => deserializeStackFrame(frame));

    // Restore memory
    const newBuffer = Buffer.from(state.memory);
    for (let i = 0; i < newBuffer.length; i++) {
      this._memory.buffer[i] = newBuffer[i];
    }

    // Re-read header values to ensure consistency
    this._readHeaderValues();

    this.logger.info('Game state restored from ZMachineState');
  }

  /**
   * Read a byte from memory at the current PC and advance PC
   */
  readByte(): number {
    const value = this._memory.getByte(this._pc);
    this._pc++;
    return value;
  }

  /**
   * Read a word from memory at the current PC and advance PC
   */
  readWord(): number {
    const value = this._memory.getWord(this._pc);
    this._pc += 2;
    return value;
  }

  /**
   * Read a Z-string from memory at the current PC and advance PC
   */
  readZString(): Array<number> {
    const startPC = this._pc;
    const zString = this._memory.getZString(this._pc);

    // Count actual words read by scanning until high bit is found
    let wordCount = 0;
    let addr = startPC;
    while (true) {
      const word = this._memory.getWord(addr);
      wordCount++;
      addr += 2;
      if ((word & 0x8000) !== 0) break;
    }

    this._pc += wordCount * 2;
    return zString;
  }

  /**
   * Read a branch offset
   * @returns [offset, branchOnFalse]
   *
   * The offset is the number of bytes to branch, and branchOnFalse indicates whether to branch on false
   */
  readBranchOffset(): [number, boolean] {
    const branchData = this.readByte();
    const off1 = branchData & 0x3f;
    let offset: number;

    if ((branchData & 0x40) === 0x40) {
      offset = off1;
    } else {
      const off2 = this.readByte();
      offset = (off1 << 8) | off2;
      if (offset & 0x2000) {
        offset |= 0xc000;
      }
    }

    // Branch conditions: 0 in bit 7 means "branch on true"
    return [offset, (branchData & 0x80) === 0x00];
  }

  /**
   * Process a branch instruction
   * @param cond Branch condition
   * @param branchOnFalse Whether to branch on false instead of true
   * @param offset Branch offset
   */
  doBranch(cond: boolean, branchOnFalse: boolean, offset: number): void {
    if ((cond && !branchOnFalse) || (!cond && branchOnFalse)) {
      if (offset === 0) {
        this.logger.debug('Returning false from branch');
        this.returnFromRoutine(0);
      } else if (offset === 1) {
        this.logger.debug('Returning true from branch');
        this.returnFromRoutine(1);
      } else {
        // Convert to signed 16-bit value
        const signedOffset = offset > 32767 ? offset - 65536 : offset;
        const targetPC = this.pc + signedOffset - 2;
        this.pc = targetPC;
        if (this.pc < 0 || this.pc > this.memory.size) {
          throw new Error(`Branch out of bounds: ${this.pc}`);
        }
        this.logger.debug(`Taking branch to 0x${this.pc.toString(16)}`);
      }
    }
  }

  /**
   * Tokenize a line of text
   * @param textBuffer Address of text buffer
   * @param parseBuffer Address of parse buffer
   * @param dict Dictionary address (0 for default)
   * @param flag If true, only recognized words are included in parse buffer
   */
  tokenizeLine(textBuffer: number, parseBuffer: number, dict: number = 0, flag: boolean = false): void {
    if (!this._textParser) {
      // Lazy-initialize the text parser
      this._textParser = new TextParser(this._memory);
    }

    this._textParser.tokenizeLine(textBuffer, parseBuffer, dict || this._dict, flag);
  }

  /**
   * Update the status bar (for versions <= 3)
   */
  updateStatusBar(): void {
    // This will be implemented in the ZMachine class
  }
}
