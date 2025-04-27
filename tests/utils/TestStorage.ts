import { FormatProvider } from '../../src/storage/formats/FormatProvider';
import { SaveInfo, StorageInterface, StorageOptions } from '../../src/storage/interfaces';
import { StorageProvider } from '../../src/storage/providers/StorageProvider';
import { ZMachineState } from '../../src/types';
import { Logger } from '../../src/utils/log';

/**
 * StorageInterface implementation for use in integrations tests
 */
export class TestStorage implements StorageInterface {
  private snapshot: ZMachineState | null = null;
  private formatProvider: FormatProvider;
  private storageProvider: StorageProvider;
  public originalStory: Buffer;
  public options: StorageOptions = {};
  private logger: Logger;

  constructor(storyData: Buffer, options?: { logger?: Logger }) {
    this.originalStory = storyData;
    this.logger = options?.logger || new Logger('TestStorage');

    // Create minimal implementations of required providers
    this.formatProvider = this.createMockFormatProvider();
    this.storageProvider = this.createMockStorageProvider();
  }

  private createMockFormatProvider(): FormatProvider {
    return {
      serialize: (state: ZMachineState): Buffer => {
        return Buffer.from(JSON.stringify({ mock: 'serialized data' }));
      },
      deserialize: (data: Buffer, originalStory: Buffer): ZMachineState => {
        if (!this.snapshot) {
          throw new Error('No snapshot available');
        }
        return this.snapshot;
      },
      extractMetadata: (data: Buffer): { description?: string; [key: string]: unknown } => {
        return { description: 'Test save file' };
      },
    };
  }

  private createMockStorageProvider(): StorageProvider {
    return {
      read: async (location: string): Promise<Buffer | null> => {
        if (!this.snapshot) return null;
        return Buffer.from(JSON.stringify({ mock: 'saved data' }));
      },
      write: async (location: string, data: Buffer): Promise<void> => {
        // No-op for test
      },
      list: async (pattern?: string): Promise<string[]> => {
        return ['test_save.dat'];
      },
      exists: async (location: string): Promise<boolean> => {
        return this.snapshot !== null;
      },
      ensureDirectory: async (directory: string): Promise<void> => {
        // No-op for test
      },
    };
  }

  async saveSnapshot(state: ZMachineState, description?: string): Promise<void> {
    this.snapshot = state;
  }

  async loadSnapshot(): Promise<ZMachineState> {
    if (!this.snapshot) {
      throw new Error('No snapshot available');
    }
    return this.snapshot;
  }

  async getSaveInfo(): Promise<SaveInfo> {
    return {
      exists: this.snapshot !== null,
      path: 'test_savefile.dat',
      description: 'Test save file',
    };
  }

  setOptions(options: StorageOptions): void {
    this.options = { ...this.options, ...options };
  }

  async listSaves(): Promise<SaveInfo[]> {
    return [
      {
        exists: this.snapshot !== null,
        path: 'test_savefile.dat',
        description: 'Test save file',
      },
    ];
  }

  getStorageLocation(): string {
    // Return the default storage location or the configured filename
    return this.options.filename || 'test_savefile.dat';
  }
}
