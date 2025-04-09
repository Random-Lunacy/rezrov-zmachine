export interface Snapshot {
  mem: Buffer;
  stack: Array<number>;
  callstack: Array<any>; // Will be replaced with StackFrame type
  pc: number;
}

export interface Storage {
  saveSnapshot(snapshot: Snapshot): void;
  loadSnapshot(): Snapshot;
}
