// src/interpreter/ZMachine.ts
import { Memory } from "../core/memory/Memory";
import { Executor } from "../core/execution/Executor";
import { GameState } from "./GameState";
import { Screen } from "../ui/screen/interfaces";
import { Storage } from "../storage/interfaces";
import { InputHandler } from "../ui/input/InputHandler";
import { Logger } from "../utils/log";
import { HeaderLocation } from "../utils/constants";

export class ZMachine {
  private memory: Memory;
  private executor: Executor;
  private state: GameState;
  private screen: Screen;
  private storage: Storage;
  private inputHandler: InputHandler;
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

    // Initialize input handler
    this.inputHandler = new InputHandler(this, this.screen);

    // Configure screen capabilities
    this.configureScreenCapabilities();
  }

  execute(): void {
    this.state.pc = this.memory.getWord(HeaderLocation.InitialPC);
    this.executor.executeLoop();
  }

  saveGame(): boolean {
    try {
      this.storage.saveSnapshot(this.state.createSnapshot());
      return true;
    } catch (e) {
      this.logger.error(e);
      return false;
    }
  }

  restoreGame(): boolean {
    try {
      const snapshot = this.storage.loadSnapshot();
      this.state.restoreFromSnapshot(snapshot);
      return true;
    } catch (e) {
      this.logger.error(e);
      return false;
    }
  }

  // Other methods...
}
