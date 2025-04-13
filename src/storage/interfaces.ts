import { StackFrame } from '../core/execution/StackFrame';

/**
 * Represents a snapshot of the Z-machine state
 */
export interface Snapshot {
  /**
   * Memory buffer containing the entire Z-machine memory
   */
  mem: Buffer;

  /**
   * The evaluation stack
   */
  stack: Array<number>;

  /**
   * The call stack containing frames for each active routine
   */
  callstack: Array<StackFrame>;

  /**
   * The program counter (current execution address)
   */
  pc: number;
}

/**
 * Interface for saving and loading game state
 */
export interface Storage {
  /**
   * Save a snapshot of the current game state
   * @param snapshot The snapshot to save
   */
  saveSnapshot(snapshot: Snapshot): void;

  /**
   * Load a saved game snapshot
   * @returns The loaded snapshot
   */
  loadSnapshot(): Snapshot;
}
