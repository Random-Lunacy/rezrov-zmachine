import { ZMachineState } from '../types';
import { FormatProvider } from './formats/FormatProvider';
import { SaveInfo, StorageInterface, StorageOptions } from './interfaces';
import { StorageProvider } from './providers/StorageProvider';

/**
 * Base Storage implementation, specific storage providers
 * (e.g., Quetzal, SimpleDat) should extend this class.
 */
export class Storage implements StorageInterface {
  private formatProvider: FormatProvider;
  private storageProvider: StorageProvider;
  private originalStory: Buffer;
  private options: StorageOptions = {};

  constructor(
    formatProvider: FormatProvider,
    storageProvider: StorageProvider,
    originalStory: Buffer,
    options?: StorageOptions
  ) {
    this.formatProvider = formatProvider;
    this.storageProvider = storageProvider;
    this.originalStory = originalStory;
    if (options) {
      this.options = options;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async saveSnapshot(state: ZMachineState, description?: string): Promise<void> {
    const location = this.getStorageLocation();
    const data = this.formatProvider.serialize(state);
    await this.storageProvider.write(location, data);
  }

  async loadSnapshot(): Promise<ZMachineState> {
    const location = this.getStorageLocation();
    const data = await this.storageProvider.read(location);
    if (!data) {
      throw new Error(`Save file not found: ${location}`);
    }
    return this.formatProvider.deserialize(data, this.originalStory);
  }

  async getSaveInfo(): Promise<SaveInfo> {
    const location = this.getStorageLocation();
    try {
      const exists = await this.storageProvider.exists(location);
      if (!exists) {
        return {
          exists: false,
          path: location,
        };
      }

      const data = await this.storageProvider.read(location);
      let description = '';

      if (data && this.formatProvider.extractMetadata) {
        const metadata = this.formatProvider.extractMetadata(data);
        description = metadata.description || '';
      }

      return {
        exists: true,
        path: location,
        format: this.formatProvider.constructor.name.replace('Format', '').toLowerCase(),
        description,
      };
    } catch (error) {
      throw new Error(`Failed to get save info: ${error}`);
    }
  }

  async listSaves(): Promise<SaveInfo[]> {
    try {
      // Get potential save files
      const pattern = this.options.filename?.replace(/\.[^.]+$/, '') || 'save';
      const files = await this.storageProvider.list(`${pattern}*`);

      const results: SaveInfo[] = [];

      for (const file of files) {
        try {
          const data = await this.storageProvider.read(file);
          if (!data) continue;

          let description = '';
          if (this.formatProvider.extractMetadata) {
            const metadata = this.formatProvider.extractMetadata(data);
            description = metadata.description || '';
          }

          results.push({
            exists: true,
            path: file,
            format: this.formatProvider.constructor.name.replace('Format', '').toLowerCase(),
            description,
          });
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
          // Skip files that can't be read or parsed
        }
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to list saves: ${error}`);
    }
  }

  setOptions(options: StorageOptions): void {
    this.options = { ...this.options, ...options };
  }

  async writeRaw(filename: string, data: Buffer): Promise<void> {
    await this.storageProvider.write(filename, data);
  }

  async readRaw(filename: string): Promise<Buffer | null> {
    return this.storageProvider.read(filename);
  }

  private getStorageLocation(): string {
    return this.options.filename || 'save.dat';
  }
}
