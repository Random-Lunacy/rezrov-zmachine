import { Executor } from '../core/execution/Executor';
import { UserStackManager } from '../core/execution/UserStack';
import { Memory } from '../core/memory/Memory';
import { createMemoryStorage } from '../storage/factory';
import { Snapshot } from '../storage/interfaces';
import { Storage } from '../storage/Storage';
import { ZMachineState } from '../types';
import { InputProcessor, InputState } from '../ui/input/InputInterface';
import { Capabilities, Screen } from '../ui/screen/interfaces';
import { HeaderLocation } from '../utils/constants';
import { Logger } from '../utils/log';
import { GameState } from './GameState';
import { ZMachineVersion } from './Version';

/**
 * Main Z-Machine interpreter class
 * This class serves as the main interface to the Z-Machine interpreter
 */
export class ZMachine {
  private readonly _memory: Memory;
  private readonly _executor: Executor;
  private readonly _state: GameState;
  private readonly _screen: Screen;
  private readonly _inputProcessor: InputProcessor;
  private readonly _logger: Logger;
  private readonly _userStackManager: UserStackManager | null = null;
  private _storage: Storage;
  private _undoStack: Snapshot[] = [];
  private readonly _maxUndoLevels = 10;
  private readonly _originalStory: Buffer;

  /**
   * Creates a new Z-Machine interpreter
   * @param storyBuffer Buffer containing the story file
   * @param screen Screen interface for output
   * @param storage Storage interface for save/restore
   * @param inputProcessor Input processor for handling user input
   * @param options Optional configuration options
   */
  constructor(
    storyBuffer: Buffer,
    screen: Screen,
    inputProcessor: InputProcessor,
    storage?: Storage,
    options?: { logger?: Logger }
  ) {
    this._originalStory = storyBuffer;
    this._memory = new Memory(storyBuffer);
    this._logger = options?.logger || new Logger('ZMachine');
    this._screen = screen;
    this._inputProcessor = inputProcessor;

    // Use provided storage or create default memory storage
    this._storage = storage || createMemoryStorage(storyBuffer);

    // Initialize state
    this._state = new GameState(this._memory);

    // Initialize executor
    this._executor = new Executor(this);

    // Configure screen capabilities
    this.configureScreenCapabilities();

    // Initialize UserStackManager for Version 6
    if (this._state.version === 6) {
      this._userStackManager = new UserStackManager(this._memory);
    }
  }

  public get memory(): Memory {
    return this._memory;
  }
  public get executor(): Executor {
    return this._executor;
  }
  public get state(): GameState {
    return this._state;
  }
  public get screen(): Screen {
    return this._screen;
  }
  public get storage(): Storage {
    return this._storage;
  }
  get inputProcessor(): InputProcessor {
    return this._inputProcessor;
  }
  public get logger(): Logger {
    return this._logger;
  }
  public get originalStory(): Buffer {
    return this._originalStory;
  }

  /**
   * Gets the UserStackManager for Version 6 operations
   */
  getUserStackManager(): UserStackManager {
    if (!this._userStackManager) {
      throw new Error('User stacks are only available in Version 6');
    }
    return this._userStackManager;
  }

  /**
   * Configure screen capabilities based on the Z-Machine version
   */
  private configureScreenCapabilities(): void {
    const { rows, cols } = this._screen.getSize();

    // Set screen dimensions in header
    this._memory.setByte(HeaderLocation.ScreenHeightInLines, rows);
    this._memory.setByte(HeaderLocation.ScreenWidthInChars, cols);

    // Configure capabilities in header flags
    const screenCapabilities = this._screen.getCapabilities();
    const version = this._state.version;

    let flags1 = this._memory.getByte(HeaderLocation.Flags1);

    if (version <= 3) {
      flags1 = this.configureFlagsForVersion3(flags1, screenCapabilities);
    } else {
      flags1 = this.configureFlagsForVersion4Plus(flags1, screenCapabilities);
    }

    this._memory.setByte(HeaderLocation.Flags1, flags1);
  }

  /**
   * Configure flags for Z-Machine versions 1-3
   * @param flags1 The current flags
   * @param screenCapabilities The screen capabilities
   * @returns The updated flags
   */
  private configureFlagsForVersion3(flags1: number, screenCapabilities: Capabilities): number {
    // Clear bits 4, 5, 6 before setting them
    flags1 &= 0b10001111;

    if (screenCapabilities.hasDisplayStatusBar) {
      flags1 |= 0b00010000; // bit 4
    }

    if (screenCapabilities.hasSplitWindow) {
      flags1 |= 0b00100000; // bit 5
    }

    // Bit 6 determines variable width font (default)
    // Leave cleared for now
    return flags1;
  }

  /**
   * Configure flags for Z-Machine versions 4 and above
   * @param flags1 The current flags
   * @param screenCapabilities The screen capabilities
   * @returns The updated flags
   */
  private configureFlagsForVersion4Plus(flags1: number, screenCapabilities: Capabilities): number {
    // Clear all bits except bit 6
    flags1 &= 0b01000000;

    if (screenCapabilities.hasColors) {
      flags1 |= 0b00000001; // bit 0
    }

    if (screenCapabilities.hasPictures) {
      flags1 |= 0b00000010; // bit 1
    }

    if (screenCapabilities.hasBold) {
      flags1 |= 0b00000100; // bit 2
    }

    if (screenCapabilities.hasItalic) {
      flags1 |= 0b00001000; // bit 3
    }

    if (screenCapabilities.hasFixedPitch) {
      flags1 |= 0b00010000; // bit 4
    }

    if (screenCapabilities.hasSound) {
      flags1 |= 0b00100000; // bit 5
    }

    if (screenCapabilities.hasTimedKeyboardInput) {
      flags1 |= 0b10000000; // bit 7
    }

    return flags1;
  }

  /**
   * Start executing the story file
   */
  execute(): void {
    // Set initial PC from the header
    this._state.pc = this._memory.getWord(HeaderLocation.InitialPC);

    // Start the execution loop
    this._executor.executeLoop();
  }

  /**
   * Get the current input state if execution is suspended
   */
  getInputState(): InputState | null {
    return this._executor.suspendedInputState;
  }

  /**
   * Save the current game state to storage
   */
  // Save the current state
  async saveGame(): Promise<void> {
    if (!this.storage) {
      throw new Error('No storage provider available');
    }

    const state = this.getState();
    await this.storage.saveSnapshot(state);
  }

  /**
   * Restore a saved game state from storage
   */
  async restoreGame(): Promise<void> {
    if (!this.storage) {
      throw new Error('No storage provider available');
    }

    const state = await this.storage.loadSnapshot();
    this.setState(state);
  }

  /**
   * Save to an external file (V5+)
   * @param table The table number
   * @param bytes The number of bytes to save
   * @param name The name of the file (optional)
   * @param shouldPrompt Whether to prompt the user for a filename (optional)
   * @returns True if the save was successful
   */
  async saveToTable(table: number, bytes: number, name: number = 0, shouldPrompt: boolean = true): Promise<boolean> {
    try {
      let filename = '';

      // If prompting is enabled, get filename from user
      if (shouldPrompt) {
        filename = await this._inputProcessor.promptForFilename(this, 'save');
        if (!filename) return false;
      }

      // Save with custom filename if provided
      if (filename) {
        this._storage.setOptions({ filename });
      }

      await this._storage.saveSnapshot(this.getState());
      return true;
    } catch (error) {
      this._logger.error(`Failed to save to table: ${error}`);
      return false;
    }
  }

  /**
   * Restores a game state from a memory table (Version 5+ only)
   *
   * @param table Memory address of the data table
   * @param bytes Size of the data in bytes
   * @param name Memory address to store the filename (0 if not used)
   * @param shouldPrompt Whether to prompt the user for a filename
   * @returns True if restore was successful
   */
  async restoreFromTable(
    table: number,
    bytes: number,
    name: number = 0,
    shouldPrompt: boolean = true
  ): Promise<boolean> {
    try {
      // Version check - this is only for V5+
      if (this._state.version < 5) {
        this._logger.error('restoreFromTable only available in Version 5+');
        return false;
      }

      let filename = '';

      // If prompting is enabled, get filename from user
      if (shouldPrompt) {
        filename = await this._inputProcessor.promptForFilename(this, 'restore');
        if (!filename) {
          this._logger.debug('User canceled file selection');
          return false;
        }
      }

      // Configure storage with the selected filename if provided
      if (filename) {
        this._storage.setOptions({ filename });
      }

      // Check if the save exists
      const saveInfo = await this._storage.getSaveInfo();
      if (!saveInfo.exists) {
        this._logger.warn(`Save file not found: ${saveInfo.path}`);
        return false;
      }

      // Load the snapshot
      const snapshot: ZMachineState = await this._storage.loadSnapshot();

      // If name parameter is provided, store the loaded filename in memory
      if (name !== 0) {
        const filenameBuffer = Buffer.from(filename);

        // Store the length first (if using Z-machine text format)
        this._memory.setByte(name, Math.min(filenameBuffer.length, 255));

        // Then store the actual characters
        for (let i = 0; i < Math.min(filenameBuffer.length, 255); i++) {
          this._memory.setByte(name + 1 + i, filenameBuffer[i]);
        }

        // Add null terminator if needed
        if (filenameBuffer.length < 255) {
          this._memory.setByte(name + 1 + filenameBuffer.length, 0);
        }
      }

      // If table and bytes parameters are provided, copy the save data to the table
      // This is used when the game wants to inspect/validate the save before restoring
      if (table !== 0 && bytes > 0) {
        // Create a buffer of the requested size
        const dataBuffer = Buffer.alloc(bytes);

        // Serialize the snapshot to the buffer
        // TODO: simplified - needs actual implementation
        // This would need to use a format the game understands
        // We could potentially use a new format: createQuetzalTableData(snapshot, bytes)
        const serializedData = this.serializeSnapshotForTable(this.getState(), bytes);
        serializedData.copy(dataBuffer, 0, 0, Math.min(serializedData.length, bytes));

        // Copy to game memory
        for (let i = 0; i < bytes; i++) {
          this._memory.setByte(table + i, i < serializedData.length ? serializedData[i] : 0);
        }
      }

      // Actually restore the game state
      this._state.restoreFromSnapshot(snapshot);

      this._logger.info('Game state restored successfully');
      return true;
    } catch (error) {
      this._logger.error(`Failed to restore from table: ${error}`);
      return false;
    }
  }

  /**
   * Helper method to serialize a snapshot for a memory table
   * This would need a specific implementation based on what format the game expects
   */
  private serializeSnapshotForTable(snapshot: Snapshot, maxBytes: number): Buffer {
    // TODO: This is a placeholder - actual implementation would depend on what format
    // the game expects in the table

    // For example, we might create a simplified format with:
    // - 2 bytes: format identifier (e.g., 0x1234)
    // - 2 bytes: version number
    // - 4 bytes: PC value
    // - 2 bytes: stack size
    // - remainder: stack and memory delta

    const buffer = Buffer.alloc(maxBytes);
    let offset = 0;

    // Format identifier
    if (offset + 2 <= maxBytes) {
      buffer.writeUInt16BE(0x1234, offset);
      offset += 2;
    }

    // Version
    if (offset + 2 <= maxBytes) {
      buffer.writeUInt16BE(this._state.version, offset);
      offset += 2;
    }

    // PC
    if (offset + 4 <= maxBytes) {
      buffer.writeUInt32BE(snapshot.pc, offset);
      offset += 4;
    }

    // Stack size
    if (offset + 2 <= maxBytes) {
      buffer.writeUInt16BE(snapshot.stack.length, offset);
      offset += 2;
    }

    // Stack data
    for (let i = 0; i < snapshot.stack.length && offset + 2 <= maxBytes; i++) {
      buffer.writeUInt16BE(snapshot.stack[i], offset);
      offset += 2;
    }

    // We could include more data as needed

    return buffer;
  }

  /**
   * Get the Z-Machine version
   * @returns The Z-Machine version
   */
  getVersion(): ZMachineVersion {
    return this._state.version;
  }

  /**
   * Save the current state for undo
   * @returns True if the save was successful
   */
  saveUndo(): boolean {
    try {
      // Create a snapshot
      const snapshot = this._state.createSnapshot();

      // Add to undo stack, keeping only the last N states
      this._undoStack.push(snapshot);
      if (this._undoStack.length > this._maxUndoLevels) {
        this._undoStack.shift();
      }

      return true;
    } catch (error) {
      this._logger.error(`Failed to save undo state: ${error}`);
      return false;
    }
  }

  /**
   * Restore the last saved state
   * @returns True if the restore was successful
   */
  restoreUndo(): boolean {
    try {
      if (this._undoStack.length === 0) {
        this._logger.warn('No undo states available');
        return false;
      }

      // Pop the last state and restore it
      const snapshot = this._undoStack.pop();
      if (snapshot) {
        this._state.restoreFromSnapshot(snapshot);
      } else {
        this._logger.warn('No undo states available to restore');
        return false;
      }

      return true;
    } catch (error) {
      this._logger.error(`Failed to restore undo state: ${error}`);
      return false;
    }
  }

  /**
   * Updates the status line for V1-V3 games
   * Displays location name on the left and score/moves or time on the right
   */
  updateStatusLine(): void {
    // Skip for version 4+ games which handle status differently
    if (this._state.version > 3) {
      return;
    }

    // Get memory and required data
    const memory = this._state.memory;
    const globalVarsBase = this._state.globalVariablesAddress;

    // First global variable is always the current location
    const locationVar = 0;
    const locationObjNum = memory.getWord(globalVarsBase + 2 * locationVar);
    const locationObj = this._state.getObject(locationObjNum);

    // Determine if it's a score game or time game
    // It's a score game if version < 3 or bit 1 of Flags1 is clear
    const isScoreGame = this._state.version < 3 || (memory.getByte(HeaderLocation.Flags1) & 0x02) === 0;

    // Content for left side of status bar is always the location name
    const lhs = locationObj?.name || 'Unknown location';

    // Content for right side depends on game type
    let rhs: string;

    if (isScoreGame) {
      // Score and moves are in globals 1 and 2
      const score = memory.getWord(globalVarsBase + 2 * 1);
      const moves = memory.getWord(globalVarsBase + 2 * 2);
      rhs = `Score: ${score}   Moves: ${moves}`;
    } else {
      // Time (hours and minutes) are in globals 1 and 2
      const hours = memory.getWord(globalVarsBase + 2 * 1);
      const minutes = memory.getWord(globalVarsBase + 2 * 2);
      // Ensure minutes is displayed with leading zero if needed
      const paddedMinutes = minutes.toString().padStart(2, '0');
      rhs = `Time: ${hours}:${paddedMinutes}`;
    }

    // Pass to the screen implementation to actually display
    this._screen.updateStatusBar(lhs, rhs);

    this._logger.debug(`Updated status bar: [${lhs}] [${rhs}]`);
  }

  /**
   * Restart the game from the beginning
   */
  restart(): boolean {
    throw new Error('Method not implemented.');
  }

  /**
   * Method to handle timed input
   * @param time The time in tenths of seconds
   * @param routine The routine to call
   */
  handleTimedInput(time: number, routine: number): void {
    if (time <= 0 || routine <= 0) {
      return; // No timer active
    }

    // Setup timeout
    setTimeout(() => {
      // If we're still waiting for input
      if (this._executor.isSuspended) {
        // Call the routine
        const routineAddr = this._memory.unpackRoutineAddress(routine);
        this._state.callRoutine(routineAddr, null);

        // Resume execution
        this._executor.resume();
      }
    }, time * 100); // Z-machine time is in 1/10 seconds
  }

  // Get the current state for saving
  private getState(): ZMachineState {
    return {
      memory: this.memory.buffer,
      pc: this.state.pc,
      stack: this.state.stack.slice(),
      callFrames: this.state.callstack.map((frame) => ({
        ...frame,
        discardResult: frame.discardResult || false,
        storeVariable: frame.storeVariable || null,
        argumentMask: frame.argumentMask || 0,
        stack: frame.stack || [],
      })),
      originalStory: this.originalStory,
    };
  }

  // Apply a loaded state
  private setState(state: ZMachineState): void {
    this.memory.setBuffer(state.memory);
    this.state.pc = state.pc;
    this.state.callStack = state.stack.slice();
    this.stack.callFrames = state.callFrames.map((frame) => ({ ...frame }));
  }

  /**
   * Quit the Z-Machine
   */
  quit(): void {
    this._executor.quit();
  }
}
