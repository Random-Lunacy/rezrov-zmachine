import { Executor } from '../core/execution/Executor';
import { InputState } from '../core/execution/InputState';
import { UserStackManager } from '../core/execution/UserStack';
import { Memory } from '../core/memory/Memory';
import { Storage } from '../storage/interfaces';
import { InputHandler } from '../ui/input/InputHandler';
import { Screen } from '../ui/screen/interfaces';
import { HeaderLocation } from '../utils/constants';
import { Logger } from '../utils/log';
import { GameState } from './GameState';
import { ZMachineVersion } from './Version';

/**
 * Main Z-Machine interpreter class
 * This class serves as the main interface to the Z-Machine interpreter
 */
export class ZMachine {
  private _memory: Memory;
  private _executor: Executor;
  private _state: GameState;
  private _screen: Screen;
  private _storage: Storage;
  /**
   * Creates a new Z-Machine interpreter
   * @param storyBuffer Buffer containing the story file
   * @param logger Logger for debugging
   * @param screen Screen interface for output
   * @param storage Storage interface for save/restore
   */
  constructor(storyBuffer: Buffer, logger: Logger, screen: Screen, storage: Storage) {
    this._memory = new Memory(storyBuffer);
    this._logger = logger;
    this._screen = screen;
    this._storage = storage;

    // Initialize state
    const version = this._memory.getByte(HeaderLocation.Version) as ZMachineVersion;

    this._state = new GameState(this._memory, logger);

    // Initialize executor
    this._executor = new Executor(this._state, this._logger);

    // Initialize input handler
    this._inputHandler = new InputHandler(this, this._screen);

    // Configure screen capabilities
    this.configureScreenCapabilities();

    // Initialize UserStackManager for Version 6
    if (this._state.version === 6) {
      this._userStackManager = new UserStackManager(this._memory, this._logger);
    }
  }

  private _inputHandler: InputHandler;
  private _logger: Logger;
  private _userStackManager: UserStackManager | null = null;

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
  public get inputHandler(): InputHandler {
    return this._inputHandler;
  }
  public get logger(): Logger {
    return this._logger;
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
    } else {
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
    }

    this._memory.setByte(HeaderLocation.Flags1, flags1);
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
   * Handle input completion from the user
   * @param input The user input
   */
  handleInputCompletion(input: string): void {
    this._inputHandler.processInput(input);
    this.resumeExecution();
  }

  /**
   * Handle keypress completion from the user
   * @param key The key pressed
   */

  handleKeyCompletion(key: string): void {
    this._inputHandler.processKeypress(key);
    this.resumeExecution();
  }

  /**
   * Save the current game state
   * @returns True if the save was successful
   */
  saveGame(): boolean {
    try {
      this._storage.saveSnapshot(this._state.createSnapshot());
      return true;
    } catch (e) {
      this._logger.error(`Failed to save game: ${e}`);
      return false;
    }
  }

  /**
   * Restore a saved game state
   * @returns True if the restore was successful
   */
  restoreGame(): boolean {
    try {
      const snapshot = this._storage.loadSnapshot();
      this._state.restoreFromSnapshot(snapshot);
      return true;
    } catch (e) {
      this._logger.error(`Failed to restore game: ${e}`);
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
  saveToTable(table: number, bytes: number, name: number = 0, shouldPrompt: boolean = true): boolean {
    try {
      // Implementation will  depend on how we handle saving
      // For a basic approach:
      let filename = '';

      if (name !== 0) {
        // Extract filename from the provided address
        filename = this.extractFilename(name);
      }

      if (shouldPrompt && filename === '') {
        // Prompt user for filename if required
        filename = this.promptForFilename('save');
        if (filename === '') {
          return false; // User cancelled
        }
      }

      // Save the specified memory range to the file
      const dataToSave = this.memory.getBytes(table, bytes);
      this.saveDataToFile(filename, dataToSave);

      return true;
    } catch (e) {
      this._logger.error(`Failed to save to table: ${e}`);
      return false;
    }
  }

  /**
   * Restore from an external file (V5+)
   * @param table The table number
   * @param bytes The number of bytes to restore
   * @param name The name of the file (optional)
   * @param shouldPrompt Whether to prompt the user for a filename (optional)
   * @returns True if the restore was successful
   */
  restoreFromTable(table: number, bytes: number, name: number = 0, shouldPrompt: boolean = true): boolean {
    try {
      // Implementation would depend on how you handle restoration
      // For a basic approach:
      let filename = '';

      if (name !== 0) {
        // Extract filename from the provided address
        filename = this.extractFilename(name);
      }

      if (shouldPrompt && filename === '') {
        // Prompt user for filename if required
        filename = this.promptForFilename('restore');
        if (filename === '') {
          return false; // User cancelled
        }
      }

      // Load data from the file
      const loadedData = this.loadDataFromFile(filename);

      // Check if data size matches expected bytes
      if (loadedData.length !== bytes) {
        this._logger.warn(`Restored data size mismatch: expected ${bytes}, got ${loadedData.length}`);
        return false;
      }

      // Write the loaded data to the specified memory range
      for (let i = 0; i < bytes; i++) {
        this.memory.setByte(table + i, loadedData[i]);
      }

      return true;
    } catch (e) {
      this._logger.error(`Failed to restore from table: ${e}`);
      return false;
    }
  }

  // Helper method to extract a filename from memory
  private extractFilename(address: number): string {
    // This implementation depends on how filenames are stored in your Z-machine
    // For a simple approach, assuming ASCIIZ string:
    let filename = '';
    let i = 0;
    let char;

    while ((char = this.memory.getByte(address + i)) !== 0) {
      filename += String.fromCharCode(char);
      i++;
    }

    return filename;
  }

  // Helper method to prompt the user for a filename
  private promptForFilename(operation: string): string {
    // This would need to be implemented according to your UI system
    // For now, just a placeholder
    return ''; // Would be replaced with actual UI prompt
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
    throw new Error('Method not implemented.');
  }

  /**
   * Restore the last saved state
   * @returns True if the restore was successful
   */
  restoreUndo(): boolean {
    throw new Error('Method not implemented.');
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
        const routineAddr = this._state.unpackRoutineAddress(routine);
        this._state.callRoutine(routineAddr, null);

        // Resume execution
        this._executor.resume();
      }
    }, time * 100); // Z-machine time is in 1/10 seconds
  }

  /**
   * Quit the Z-Machine
   */
  quit(): void {
    this._executor.quit();
  }
}
