// src/interpreter/ZMachine.ts
import { Memory } from "../core/memory/Memory";
import { Executor } from "../core/execution/Executor";
import { GameState } from "./GameState";
import { Screen } from "../ui/screen/interfaces";
import { Storage } from "../storage/interfaces";
import { InputHandler } from "../ui/input/InputHandler";
import { Logger } from "../utils/log";
import { HeaderLocation } from "../utils/constants";
import { ZMachineVersion, getVersionCapabilities } from "./Version";

/**
 * Main Z-Machine interpreter class
 * This class serves as the main interface to the Z-Machine interpreter
 */
export class ZMachine {
  private memory: Memory;
  private executor: Executor;
  private state: GameState;
  private screen: Screen;
  private storage: Storage;
  private inputHandler: InputHandler;
  private logger: Logger;

  /**
   * Creates a new Z-Machine interpreter
   * @param storyBuffer Buffer containing the story file
   * @param logger Logger for debugging
   * @param screen Screen interface for output
   * @param storage Storage interface for save/restore
   */
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
    const version = this.memory.getByte(
      HeaderLocation.Version
    ) as ZMachineVersion;
    this.state = new GameState(this.memory, version);

    // Initialize executor
    this.executor = new Executor(this.memory, this.state, this.logger);

    // Initialize input handler
    this.inputHandler = new InputHandler(this, this.screen);

    // Configure screen capabilities
    this.configureScreenCapabilities();
  }

  /**
   * Configure screen capabilities based on the Z-Machine version
   */
  private configureScreenCapabilities(): void {
    const { rows, cols } = this.screen.getSize();

    // Set screen dimensions in header
    this.memory.setByte(HeaderLocation.ScreenHeightInLines, rows);
    this.memory.setByte(HeaderLocation.ScreenWidthInChars, cols);

    // Configure capabilities in header flags
    const screenCapabilities = this.screen.getCapabilities();
    const version = this.state.version;

    let flags1 = this.memory.getByte(HeaderLocation.Flags1);

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

    this.memory.setByte(HeaderLocation.Flags1, flags1);
  }

  /**
   * Start executing the story file
   */
  execute(): void {
    // Set initial PC from the header
    this.state.pc = this.memory.getWord(HeaderLocation.InitialPC);

    // Start the execution loop
    this.executor.executeLoop();
  }

  /**
   * Get the current input state if execution is suspended
   */
  getInputState(): InputState | null {
    return this.executor.suspendedInputState;
  }

  /**
   * Handle input completion from the user
   * @param input The user input
   */
  handleInputCompletion(input: string): void {
    this.inputHandler.processInput(input);
    this.resumeExecution();
  }

  /**
   * Handle keypress completion from the user
   * @param key The key pressed
   */
  handleKeyCompletion(key: string): void {
    this.inputHandler.processKeypress(key);
    this.resumeExecution();
  }

  /**
   * Save the current game state
   * @returns True if the save was successful
   */
  saveGame(): boolean {
    try {
      this.storage.saveSnapshot(this.state.createSnapshot());
      return true;
    } catch (e) {
      this.logger.error(`Failed to save game: ${e}`);
      return false;
    }
  }

  /**
   * Restore a saved game state
   * @returns True if the restore was successful
   */
  restoreGame(): boolean {
    try {
      const snapshot = this.storage.loadSnapshot();
      this.state.restoreFromSnapshot(snapshot);
      return true;
    } catch (e) {
      this.logger.error(`Failed to restore game: ${e}`);
      return false;
    }
  }

  /**
   * Get the Z-Machine version
   * @returns The Z-Machine version
   */
  getVersion(): ZMachineVersion {
    return this.state.version;
  }

  /**
   * Get the game state
   * @returns The game state
   */
  getGameState(): GameState {
    return this.state;
  }

  /**
   * Get the screen interface
   * @returns The screen interface
   */
  getScreen(): Screen {
    return this.screen;
  }

  /**
   * Handle input completion from the user
   * @param input The user input
   */
  handleInputCompletion(input: string): void {
    this.inputHandler.processInput(input);
  }

  /**
   * Handle keypress completion from the user
   * @param key The key pressed
   */
  handleKeyCompletion(key: string): void {
    this.inputHandler.processKeypress(key);
  }

  /**
   * Update the status line (for V1-3 games)
   */
  updateStatusLine(): void {
    if (this.state.version > 3) {
      return;
    }

    // Get location object
    const globalVarsBase = this.state.globalVariablesAddress;
    const locationVar = 0; // First global is the location
    const locationObjNum = this.memory.getWord(
      globalVarsBase + 2 * locationVar
    );
    const locationObj = this.state.getObject(locationObjNum);

    // Determine if this is a score or time game
    const isScoreGame =
      this.state.version < 3 ||
      (this.memory.getByte(HeaderLocation.Flags1) & 0x02) === 0;

    // Prepare status line content
    const lhs = locationObj?.name || "Unknown location";
    let rhs: string;

    if (isScoreGame) {
      const score = this.memory.getWord(globalVarsBase + 2 * 1); // Global 1 = score
      const moves = this.memory.getWord(globalVarsBase + 2 * 2); // Global 2 = moves
      rhs = `Score: ${score}   Moves: ${moves}`;
    } else {
      const hours = this.memory.getWord(globalVarsBase + 2 * 1); // Global 1 = hours
      const minutes = this.memory.getWord(globalVarsBase + 2 * 2); // Global 2 = minutes
      const paddedMinutes = minutes.toString().padStart(2, "0");
      rhs = `Time: ${hours}:${paddedMinutes}`;
    }

    // Update the status line
    this.screen.updateStatusBar(lhs, rhs);
  }

  /**
   * Quit the Z-Machine
   */
  quit(): void {
    this.executor.quit();
  }
}
