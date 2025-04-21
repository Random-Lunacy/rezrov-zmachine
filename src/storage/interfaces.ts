import { StackFrame } from '../core/execution/StackFrame';

/**
 * Represents a snapshot of the Z-machine state
 */
export interface Snapshot {
  mem: Buffer;
  stack: Array<number>;
  callstack: Array<StackFrame>;
  pc: number;
}

/**
 * Information about a saved game file
 */
export interface SaveInfo {
  exists: boolean;
  path: string;
  format?: 'simple' | 'quetzal' | string;
  description?: string;
  lastModified?: Date;
}

/**
 * Interface for saving and loading game state
 */
export interface Storage {
  // Core operations
  saveSnapshot(snapshot: Snapshot, description?: string): Promise<void>;
  loadSnapshot(): Promise<Snapshot>;

  // Metadata operations
  getSaveInfo(): Promise<SaveInfo>;
  listSaves(): Promise<SaveInfo[]>;

  // Configuration
  setOptions(options: StorageOptions): void;
}

/**
 * Represents information about a saved game
 */
export interface StorageProvider {
  read(location: string): Promise<Buffer | null>;
  write(location: string, data: Buffer): Promise<void>;
  list(pattern?: string): Promise<string[]>;
  delete(location: string): Promise<boolean>;
  exists(location: string): Promise<boolean>;
  ensureDirectory(directory: string): Promise<void>;
}

/**
 * Configuration options for storage implementations
 */
export interface StorageOptions {
  savePath?: string;
  filename?: string;
  description?: string;
  useCompression?: boolean;
  // Provider-specific options with typed values
  providerOptions?: {
    [key: string]: string | number | boolean | null;
  };
}

export interface StorageStats {
  size?: number;
  lastModified?: Date;
  created?: Date;
}
