import { ZMachineState } from '../types';

/**
 * Storage Interface
 */
export interface StorageInterface {
  saveSnapshot(state: ZMachineState, description?: string): Promise<void>;
  loadSnapshot(): Promise<ZMachineState>;
  getSaveInfo(): Promise<SaveInfo>;
  listSaves(): Promise<SaveInfo[]>;
  setOptions(options: StorageOptions): void;
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
