import { Executor } from '../core/execution/Executor';
import { serializeStackFrame } from '../core/execution/StackFrame';
import { UserStackManager } from '../core/execution/UserStack';
import { Memory } from '../core/memory/Memory';
import { EnhancedDatFormat } from '../storage/formats/EnhancedDatFormat';
import { FormatProvider } from '../storage/formats/FormatProvider';
import { SaveInfo, StorageInterface } from '../storage/interfaces';
import { MemoryStorageProvider } from '../storage/providers/MemoryStorageProvider';
import { StorageProvider } from '../storage/providers/StorageProvider';
import { Storage } from '../storage/Storage';
import { ZMachineState } from '../types';
import { InputProcessor, InputState } from '../ui/input/InputInterface';
import { BaseMultimediaHandler, MultimediaHandler } from '../ui/multimedia/MultimediaHandler';
import { Capabilities, Screen } from '../ui/screen/interfaces';
import { HeaderLocation, Interpreter } from '../utils/constants';
import { Logger } from '../utils/log';
import { GameState } from './GameState';

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
  private readonly _multimediaHandler: MultimediaHandler;
  private readonly _logger: Logger;
  private readonly _userStackManager: UserStackManager | null = null;
  private _storage: StorageInterface;
  private _undoStack: ZMachineState[] = [];
  private readonly _maxUndoLevels = 10;
  private readonly _originalStory: Buffer;

  /**
   * Creates a new Z-Machine interpreter
   * @param storyBuffer Buffer containing the story file
   * @param screen Screen interface for output
   * @param inputProcessor Input processor for handling user input
   * @param multimediaHandler Multimedia handler for sound and pictures (optional, defaults to BaseMultimediaHandler)
   * @param provider StorageProvider for saving game data. MemoryStorageProvider is used if none is specified
   * @param format FormatProvider for saving game data. EnhancedDatFormat is used if none is specified
   * @param options Optional configuration options
   */
  constructor(
    storyBuffer: Buffer,
    screen: Screen,
    inputProcessor: InputProcessor,
    multimediaHandler?: MultimediaHandler,
    provider?: StorageProvider,
    format?: FormatProvider,
    options?: { logger?: Logger }
  ) {
    this._originalStory = storyBuffer;
    this._memory = new Memory(storyBuffer);
    this._logger = options?.logger || new Logger('ZMachine');
    this._screen = screen;
    this._inputProcessor = inputProcessor;
    this._multimediaHandler = multimediaHandler || new BaseMultimediaHandler({ logger: this._logger });

    // Create a new Storage with provided StorageProvider, FormatProvider, and storyBuffer.
    // Use defaults for the StorageProvider and / or FormatProvider if they are not provided.
    this._storage = new Storage(
      format ?? new EnhancedDatFormat(),
      provider ?? new MemoryStorageProvider(),
      storyBuffer
    );

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
  public get storage(): StorageInterface {
    return this._storage;
  }
  get inputProcessor(): InputProcessor {
    return this._inputProcessor;
  }

  /**
   * Gets the multimedia handler for sound and picture operations
   */
  get multimediaHandler(): MultimediaHandler {
    return this._multimediaHandler;
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
    const version = this._state.version;

    // Set interpreter number and version (required for games like Beyond Zork)
    // Using IBM PC (6) as this is what most modern terminal interpreters emulate
    this._memory.setByte(HeaderLocation.InterpreterNumber, Interpreter.IBM_PC);
    this._memory.setByte(HeaderLocation.InterpreterVersion, 82); // 'R' for Rezrov

    // Set screen dimensions in header
    this._memory.setByte(HeaderLocation.ScreenHeightInLines, rows);
    this._memory.setByte(HeaderLocation.ScreenWidthInChars, cols);

    // For V5+, also set screen dimensions in units and font size
    // In text mode, 1 unit = 1 character, so units = chars
    if (version >= 5) {
      // Screen dimensions in units (for text mode, 1 unit = 1 character)
      this._memory.setWord(HeaderLocation.ScreenWidthInUnits, cols);
      this._memory.setWord(HeaderLocation.ScreenHeightInUnits, rows);

      // Font size in units - for text mode terminals, each character is 1x1 unit
      this._memory.setByte(HeaderLocation.FontWidthInUnits, 1);
      this._memory.setByte(HeaderLocation.FontHeightInUnits, 1);
    }

    // Configure capabilities in header flags
    const screenCapabilities = this._screen.getCapabilities();

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
    // Set the program counter to the initial PC from the header
    this._state.pc = this._memory.getWord(HeaderLocation.InitialPC);

    // Start execution
    this._executor.executeLoop().catch((error) => {
      this._logger.error(`Execution error: ${error}`);
    });
  }

  /**
   * Get the current input state if execution is suspended
   */
  getInputState(): InputState | null {
    return this._executor.suspendedInputState;
  }

  /**
   * Update the status bar (for versions <= 3)
   * This method retrieves the current location, values, and flags,
   */
  updateStatusBar(): void {
    if (this.state.version > 3) return;

    const locationObj = this.state.loadVariable(16);
    let locationName: string | null = null;

    if (locationObj !== 0) {
      const obj = this.state.getObject(locationObj);
      if (!obj) {
        throw new Error(`Invalid location object ${locationObj} in global variable 16`);
      }

      try {
        locationName = obj.name || '';
      } catch (error) {
        this.logger.error(`Error getting name for location object ${locationObj}: ${error}`);
        locationName = '';
      }
    }

    const value1 = this.state.loadVariable(17);
    const value2 = this.state.loadVariable(18);
    const flags1 = this.state.memory.getByte(HeaderLocation.Flags1);
    const isTimeMode = (flags1 & 0x02) !== 0;

    this.screen.updateStatusBar(locationName, value1, value2, isTimeMode);
  }

  /**
   * Save the current game state to storage
   */
  // Save the current state
  async saveGame(): Promise<boolean> {
    try {
      if (!this._storage) {
        throw new Error('No storage provider available');
      }

      const state = this.getState();
      await this._storage.saveSnapshot(state);
      return true;
    } catch (error) {
      this._logger.error(`Failed to save game: ${error}`);
      return false;
    }
  }

  /**
   * Restore a saved game state from storage
   */
  async restoreGame(): Promise<boolean> {
    try {
      if (!this._storage) {
        throw new Error('No storage provider available');
      }

      const state = await this._storage.loadSnapshot();
      this.setState(state);
      return true;
    } catch (error) {
      this._logger.error(`Failed to restore game: ${error}`);
      return false;
    }
  }

  /**
   * Save to an external file (V5+)
   * @param table The table number
   * @param bytes The number of bytes to save
   * @param name The name of the file (optional)
   * @param shouldPrompt Whether to prompt the user for a filename (optional)
   * @returns True if the save was successful
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async saveToTable(table: number, bytes: number, name: number = 0, shouldPrompt: boolean = true): Promise<boolean> {
    try {
      let filename = '';

      // If prompting is enabled, get filename from user
      if (shouldPrompt) {
        filename = await this._inputProcessor.promptForFilename(this, 'save');
        if (!filename) return false;
      }

      // Set storage options
      if (filename) {
        this._storage.setOptions({ filename });
      }

      // Create snapshot and save
      const state = this.getState();
      await this._storage.saveSnapshot(state);

      // Write save metadata to the table if specified
      if (table !== 0 && bytes > 0) {
        // Get metadata about the save file
        const saveInfo = await this._storage.getSaveInfo();
        this.writeMetadataToTable(table, bytes, saveInfo);
      }

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

      // Set storage options
      if (filename) {
        this._storage.setOptions({ filename });
      }

      // Check if save exists
      const saveInfo = await this._storage.getSaveInfo();
      if (!saveInfo.exists) {
        this._logger.warn(`Save file not found: ${saveInfo.path}`);
        return false;
      }

      // Load snapshot
      const state = await this._storage.loadSnapshot();

      // Store filename in specified buffer if requested
      if (name !== 0) {
        this.storeFilenameInMemory(name, filename);
      }

      // Update table with save metadata if requested
      if (table !== 0 && bytes > 0) {
        this.writeMetadataToTable(table, bytes, saveInfo);
      }

      // Restore state
      this.setState(state);

      this._logger.info('Game state restored successfully');
      return true;
    } catch (error) {
      this._logger.error(`Failed to restore from table: ${error}`);
      return false;
    }
  }

  private writeMetadataToTable(table: number, maxBytes: number, saveInfo: SaveInfo): void {
    const buffer = Buffer.alloc(maxBytes);
    let offset = 0;

    // Write magic number and version
    if (offset + 4 <= maxBytes) {
      buffer.writeUInt16BE(0x5a4d, offset); // 'ZM' in ASCII
      offset += 2;
      buffer.writeUInt16BE(this._state.version, offset);
      offset += 2;
    }

    // Write save file format
    if (saveInfo.format && offset + 8 <= maxBytes) {
      const formatStr = saveInfo.format.padEnd(8, ' ').substring(0, 8);
      buffer.write(formatStr, offset, 'ascii');
      offset += 8;
    }

    // Write save description if available
    if (saveInfo.description && offset + saveInfo.description.length + 1 <= maxBytes) {
      const desc = saveInfo.description;
      const descLen = Math.min(desc.length, 255, maxBytes - offset - 1);

      if (descLen > 0) {
        buffer.writeUInt8(descLen, offset);
        offset++;

        buffer.write(desc.substring(0, descLen), offset, 'utf8');
        offset += descLen;
      }
    }

    // Write timestamp if available
    if (saveInfo.lastModified && offset + 4 <= maxBytes) {
      const timestamp = Math.floor(saveInfo.lastModified.getTime() / 1000);
      buffer.writeUInt32BE(timestamp, offset);
      offset += 4;
    }

    // Copy buffer to memory
    for (let i = 0; i < maxBytes; i++) {
      if (i < offset) {
        this._memory.setByte(table + i, buffer[i]);
      } else {
        this._memory.setByte(table + i, 0);
      }
    }
  }

  private storeFilenameInMemory(address: number, filename: string): void {
    const filenameBuffer = Buffer.from(filename);

    // Write length byte
    this._memory.setByte(address, Math.min(filenameBuffer.length, 255));

    // Write filename
    for (let i = 0; i < Math.min(filenameBuffer.length, 255); i++) {
      this._memory.setByte(address + 1 + i, filenameBuffer[i]);
    }

    // Null terminate if there's room
    if (filenameBuffer.length < 255) {
      this._memory.setByte(address + 1 + filenameBuffer.length, 0);
    }
  }

  private getState(): ZMachineState {
    return {
      memory: Buffer.from(this.memory.buffer),
      pc: this.state.pc,
      stack: [...this.state.stack],
      callFrames: this.state.callstack.map((frame) => serializeStackFrame(frame)),
      originalStory: Buffer.from(this.originalStory),
    };
  }

  private setState(state: ZMachineState): void {
    this._state.restoreFromSnapshot(state);
  }

  /**
   * Save the current state to the undo stack
   * As per the Z-Machine specification (section 8.7.3.7),
   * save_undo stores the current state for later restoration
   */
  saveUndo(): boolean {
    try {
      // Create snapshot of current state
      const state = this.getState();

      // Add to undo stack (at the beginning for more efficient access)
      this._undoStack.unshift(state);

      // Trim undo stack if it exceeds maximum size
      if (this._undoStack.length > this._maxUndoLevels) {
        this._undoStack.pop();
      }

      this._logger.debug(`Saved undo state (${this._undoStack.length}/${this._maxUndoLevels})`);
      return true;
    } catch (error) {
      this._logger.error(`Failed to save undo state: ${error}`);
      return false;
    }
  }

  /**
   * Restore the most recent state from the undo stack
   * As per the Z-Machine specification (section 8.7.3.8),
   * restore_undo returns:
   * 0 if restore failed because no undo state was available
   * 2 if restore succeeded
   */
  restoreUndo(): boolean {
    try {
      if (this._undoStack.length === 0) {
        this._logger.warn('No undo states available');
        return false;
      }

      // Get the most recent state from the undo stack
      const state = this._undoStack.shift();

      if (!state) {
        this._logger.error('Failed to retrieve undo state');
        return false;
      }

      // Restore the state
      this.setState(state);

      this._logger.debug(`Restored undo state (${this._undoStack.length} remaining)`);
      return true;
    } catch (error) {
      this._logger.error(`Failed to restore undo state: ${error}`);
      return false;
    }
  }

  /**
   * Restart the Z-machine from the beginning
   */
  restart(): void {
    // Reset the machine state to its initial state
    this._state.pc = this._memory.getWord(HeaderLocation.InitialPC);

    // Clear stacks
    this._state.stack.length = 0;
    this._state.callstack.length = 0;

    // Reset memory to original story (except header)
    const headerSize = 64; // Standard header size
    for (let i = headerSize; i < this._memory.size; i++) {
      if (this._memory.isDynamicMemory(i)) {
        this._memory.buffer[i] = this._originalStory[i];
      }
    }

    // Reset object factory cache
    if (this._state['_objectFactory'] && typeof this._state['_objectFactory'].resetCache === 'function') {
      this._state['_objectFactory'].resetCache();
    }

    // Re-execute from the beginning
    this._executor.executeLoop().catch((error) => {
      this._logger.error(`Error during restart execution: ${error}`);
    });
  }

  /**
   * Quit the Z-Machine
   */
  quit(): void {
    this._executor.quit();
  }
}
