import { Executor } from '../core/execution/Executor';
import { serializeStackFrame } from '../core/execution/StackFrame';
import { UserStackManager } from '../core/execution/UserStack';
import { Memory } from '../core/memory/Memory';
import type { BlorbMap } from '../resources/BlorbData';
import { EnhancedDatFormat } from '../storage/formats/EnhancedDatFormat';
import { FormatProvider } from '../storage/formats/FormatProvider';
import { StorageInterface } from '../storage/interfaces';
import { MemoryStorageProvider } from '../storage/providers/MemoryStorageProvider';
import { StorageProvider } from '../storage/providers/StorageProvider';
import { Storage } from '../storage/Storage';
import { Color, ZMachineState } from '../types';
import { InputProcessor, InputState } from '../ui/input/InputInterface';
import { BlorbMultimediaHandler } from '../ui/multimedia/BlorbMultimediaHandler';
import { BaseMultimediaHandler, MultimediaHandler } from '../ui/multimedia/MultimediaHandler';
import { Capabilities, Screen } from '../ui/screen/interfaces';
import { HeaderLocation, Interpreter } from '../utils/constants';
import { Logger } from '../utils/log';
import { GameState } from './GameState';

/** Max length of suggested name header in auxiliary save files (matches Infocom's PSNLEN) */
const AUXILIARY_NAME_LENGTH = 32;

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
  private _multimediaHandler: MultimediaHandler;
  private readonly _logger: Logger;
  private readonly _userStackManager: UserStackManager | null = null;
  private _storage: StorageInterface;
  private _undoStack: ZMachineState[] = [];
  private readonly _maxUndoLevels = 10;
  private readonly _originalStory: Buffer;
  private _blorbMap: BlorbMap | null = null;
  private _blorbData: Buffer | null = null;

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
    // Store a copy of the original story for restart functionality
    // This must be a copy, not a reference, since Memory modifies the buffer in place
    this._originalStory = Buffer.from(storyBuffer);
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
  public get blorbMap(): BlorbMap | null {
    return this._blorbMap;
  }
  public get blorbData(): Buffer | null {
    return this._blorbData;
  }

  /**
   * Attach a parsed Blorb resource map to this Z-Machine instance.
   * Call this after construction when a .blb file is available.
   * @param map Parsed Blorb map
   * @param data Raw Blorb file buffer
   * @param handler Optional pre-configured MultimediaHandler (e.g., BlorbMultimediaHandler with render/play callbacks). If not provided, a default BlorbMultimediaHandler is created.
   */
  setBlorb(map: BlorbMap, data: Buffer, handler?: MultimediaHandler): void {
    this._blorbMap = map;
    this._blorbData = data;
    this._multimediaHandler = handler ?? new BlorbMultimediaHandler(map, data, { logger: this._logger });
    this._logger.info('Blorb resources attached, BlorbMultimediaHandler active');
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

    // Configure capabilities in header flags
    const screenCapabilities = this._screen.getCapabilities();

    // Set interpreter number and version (required for games like Beyond Zork)
    // Default to Amiga (4) which provides better default color palettes in games
    // that select palettes based on interpreter number. Configurable via Capabilities.
    const interpreterNumber = screenCapabilities.interpreterNumber ?? Interpreter.Amiga;
    this._memory.setByte(HeaderLocation.InterpreterNumber, interpreterNumber);
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

      // Write default colors to header (Z-machine spec section 8.3.2)
      const defaultFg = screenCapabilities.defaultForeground ?? Color.White;
      const defaultBg = screenCapabilities.defaultBackground ?? Color.Black;
      this._memory.setByte(HeaderLocation.DefaultForegroundColor, defaultFg);
      this._memory.setByte(HeaderLocation.DefaultBackgroundColor, defaultBg);
    }

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
   *
   * V1-5: Word 0x06 contains the byte address of the first instruction; we jump there.
   * V6-7: Word 0x06 contains the packed address of the main routine; we must call it
   * (Z-spec 6.4), creating a stack frame so catch/throw work correctly.
   */
  execute(): void {
    if (this._state.version >= 6) {
      const packedMain = this._memory.getWord(HeaderLocation.InitialPC);
      const mainAddr = this._memory.unpackRoutineAddress(packedMain);
      this._state.callRoutine(mainAddr, null);
    } else {
      this._state.pc = this._memory.getWord(HeaderLocation.InitialPC);
    }

    // Start execution
    this._executor.executeLoop().catch((error) => {
      const msg = error instanceof Error ? error.message : String(error);
      this._logger.error(`Execution error: ${error}`);
      try {
        this._screen.print(this, `\n\n*** Fatal error: ${msg} ***\n[Game has halted. Please restart.]\n`);
      } catch {
        // If printing fails, the error is already logged above
      }
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
   * Save auxiliary data to a file (V5+ partial save).
   * Writes raw memory bytes to a file, prefixed with a suggested name header.
   * This does NOT save game state — just a memory region.
   *
   * File format (matching Infocom):
   *   [32 bytes: suggested name (length-prefixed)] [N bytes: data from memory]
   *
   * @param table Memory address of data to save
   * @param bytes Number of bytes to save
   * @param name Memory address of length-prefixed suggested filename (0 if none)
   * @param shouldPrompt Whether to prompt the user for a filename
   * @returns True if the save was successful
   */
  async saveAuxiliary(table: number, bytes: number, name: number = 0, shouldPrompt: boolean = true): Promise<boolean> {
    try {
      let filename = '';

      if (shouldPrompt) {
        filename = await this._inputProcessor.promptForFilename(this, 'save');
        if (!filename) return false;
      }

      // Read the suggested name from memory (length-prefixed, max 32 bytes)
      const nameHeader = Buffer.alloc(AUXILIARY_NAME_LENGTH);
      if (name !== 0) {
        const nameLen = Math.min(this._memory.getByte(name), AUXILIARY_NAME_LENGTH - 1);
        nameHeader[0] = nameLen;
        for (let i = 0; i < nameLen; i++) {
          nameHeader[i + 1] = this._memory.getByte(name + 1 + i);
        }
      }

      // Read the data from memory
      const data = this._memory.getBytes(table, bytes);

      // Build the file: [name header (32 bytes)] + [data]
      const fileBuffer = Buffer.concat([nameHeader, data]);

      // Write using raw storage (bypasses format provider)
      if (!filename) {
        filename = 'auxiliary.dat';
      }
      await this._storage.writeRaw(filename, fileBuffer);

      return true;
    } catch (error) {
      this._logger.error(`Failed to save auxiliary data: ${error}`);
      return false;
    }
  }

  /**
   * Restore auxiliary data from a file (V5+ partial restore).
   * Reads raw memory bytes from a file, validating the suggested name header.
   * This does NOT restore game state — just a memory region.
   *
   * @param table Memory address to write data into
   * @param bytes Maximum number of bytes to restore
   * @param name Memory address of length-prefixed suggested filename (0 if none)
   * @param shouldPrompt Whether to prompt the user for a filename
   * @returns Number of bytes actually read, or 0 on failure
   */
  async restoreAuxiliary(
    table: number,
    bytes: number,
    name: number = 0,
    shouldPrompt: boolean = true
  ): Promise<number> {
    try {
      let filename = '';

      if (shouldPrompt) {
        filename = await this._inputProcessor.promptForFilename(this, 'restore');
        if (!filename) return 0;
      }

      if (!filename) {
        filename = 'auxiliary.dat';
      }

      const fileBuffer = await this._storage.readRaw(filename);
      if (!fileBuffer) {
        this._logger.warn(`Auxiliary file not found: ${filename}`);
        return 0;
      }

      if (fileBuffer.length < AUXILIARY_NAME_LENGTH) {
        this._logger.error('Auxiliary file too small to contain name header');
        return 0;
      }

      // Validate the suggested name matches
      if (name !== 0) {
        const currentNameLen = Math.min(this._memory.getByte(name), AUXILIARY_NAME_LENGTH - 1);
        const fileNameLen = fileBuffer[0];

        if (currentNameLen !== fileNameLen) {
          this._logger.error('Auxiliary file name length mismatch');
          return 0;
        }

        for (let i = 0; i < currentNameLen; i++) {
          if (this._memory.getByte(name + 1 + i) !== fileBuffer[1 + i]) {
            this._logger.error('Auxiliary file name mismatch');
            return 0;
          }
        }
      }

      // Read data after the name header
      const dataStart = AUXILIARY_NAME_LENGTH;
      const availableBytes = fileBuffer.length - dataStart;
      const bytesToRead = Math.min(bytes, availableBytes);

      // Copy data into Z-machine memory
      const data = fileBuffer.subarray(dataStart, dataStart + bytesToRead);
      this._memory.setBytes(table, Buffer.from(data));

      return bytesToRead;
    } catch (error) {
      this._logger.error(`Failed to restore auxiliary data: ${error}`);
      return 0;
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
   *
   * According to Z-machine spec section 6.1.3:
   * - Dynamic memory is copied back from the original story file
   * - The stack is emptied
   * - Execution resumes at the initial PC from the header
   * - Certain header fields set by the interpreter are preserved/re-initialized
   */
  restart(): void {
    // Cancel any pending input operations first
    // This clears timeouts and other input-related state
    this._inputProcessor.cancelInput(this);

    // Signal the current execution loop to exit for restart
    // This is critical: restart() is called from within an opcode handler,
    // which is within the current executeLoop(). We need the old loop to exit
    // cleanly before starting a new one. Using signalRestart() instead of quit()
    // ensures screen.quit() is not called.
    this._executor.signalRestart();

    // Clear stacks
    this._state.stack.length = 0;
    this._state.callstack.length = 0;

    // Restore ALL dynamic memory from the original story file
    // This includes the header, which will be re-initialized below
    const dynamicMemoryEnd = this._memory.dynamicMemoryEnd;
    for (let i = 0; i < dynamicMemoryEnd; i++) {
      this._memory.buffer[i] = this._originalStory[i];
    }

    // Re-configure screen capabilities (this sets interpreter-specific header fields)
    // This must be done after restoring memory to ensure header is properly initialized
    this.configureScreenCapabilities();

    // Reset execution start: V6-7 call main routine; V1-5 jump to initial PC
    if (this._state.version >= 6) {
      const packedMain = this._memory.getWord(HeaderLocation.InitialPC);
      const mainAddr = this._memory.unpackRoutineAddress(packedMain);
      this._state.callRoutine(mainAddr, null);
    } else {
      this._state.pc = this._memory.getWord(HeaderLocation.InitialPC);
    }

    // Reset object factory cache to clear any cached object state
    if (this._state['_objectFactory'] && typeof this._state['_objectFactory'].resetCache === 'function') {
      this._state['_objectFactory'].resetCache();
    }

    // Clear the undo stack since we're restarting
    this._undoStack.length = 0;

    // Schedule the new execution loop to start after the current call stack unwinds.
    // This ensures the old executeLoop() exits cleanly before the new one begins.
    setImmediate(() => {
      // Reset executor state now that the old loop has exited
      this._executor.reset();

      // Start fresh execution
      this._executor.executeLoop().catch((error) => {
        const msg = error instanceof Error ? error.message : String(error);
        this._logger.error(`Error during restart execution: ${error}`);
        try {
          this._screen.print(this, `\n\n*** Fatal error: ${msg} ***\n[Game has halted. Please restart.]\n`);
        } catch {
          // If printing fails, the error is already logged above
        }
      });
    });
  }

  /**
   * Quit the Z-Machine
   */
  quit(): void {
    this._executor.quit();
  }
}
