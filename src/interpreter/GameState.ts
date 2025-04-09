import { Memory } from "../core/memory/Memory";
import { StackFrame } from "../core/execution/StackFrame";
import { Address } from "../types";
import { GameObject } from "../core/objects/GameObject";

export class GameState {
  private _pc: Address = 0;
  private _stack: Array<number> = [];
  private _callstack: Array<StackFrame> = [];
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
