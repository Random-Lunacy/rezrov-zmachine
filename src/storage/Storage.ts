import { FormatProvider } from './formats/FormatProvider';
import { SaveInfo, Snapshot, StorageOptions } from './interfaces';
import { StorageProvider } from './providers/StorageProvider';

/**
 * Base Storage implementation, specific storage providers
 * (e.g., Quetzal, SimpleDat) should extend this class.
 */
export class Storage {
  private formatProvider: FormatProvider;
  private storageProvider: StorageProvider;
  private options: StorageOptions = {};
  private originalStoryData: Buffer;

  constructor(
    formatProvider: FormatProvider,
    storageProvider: StorageProvider,
    originalStoryData: Buffer,
    options?: StorageOptions
  ) {
    this.formatProvider = formatProvider;
    this.storageProvider = storageProvider;
    this.originalStoryData = originalStoryData;
    if (options) {
      this.options = options;
    }
  }

  async saveSnapshot(snapshot: Snapshot, description?: string): Promise<void> {
    const location = this.getStorageLocation();
    const data = this.formatProvider.serialize(snapshot, this.originalStoryData);
    await this.storageProvider.write(location, data);
  }

  async loadSnapshot(): Promise<Snapshot> {
    const location = this.getStorageLocation();
    const data = await this.storageProvider.read(location);
    if (!data) {
      throw new Error(`Save file not found: ${location}`);
    }
    return this.formatProvider.deserialize(data, this.originalStoryData);
  }

  async getSaveInfo(): Promise<SaveInfo> {
    throw new Error('Method not implemented.');
    // Implementation to get save info
  }

  async listSaves(): Promise<SaveInfo[]> {
    throw new Error('Method not implemented.');
    // Implementation to list saves
  }

  setOptions(options: StorageOptions): void {
    this.options = { ...this.options, ...options };
  }

  private getStorageLocation(): string {
    return this.options.filename || 'save.dat';
  }
}
