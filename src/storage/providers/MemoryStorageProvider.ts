import { Logger } from '../../utils/log';
import { StorageProvider } from './StorageProvider';

/**
 * In-memory storage provider.
 * This provider stores data in memory and does not persist it to disk.
 */
export class MemoryStorageProvider implements StorageProvider {
  private logger = new Logger('MemoryStorageProvider');
  private storage: Map<string, Uint8Array> = new Map();

  async read(location: string): Promise<Uint8Array | null> {
    return this.storage.get(location) || null;
  }

  async write(location: string, data: Uint8Array): Promise<void> {
    this.storage.set(location, data);
  }

  async list(pattern?: string): Promise<string[]> {
    const keys = Array.from(this.storage.keys());
    if (!pattern) {
      return keys;
    }
    const regex = new RegExp(pattern);
    return keys.filter((key) => regex.test(key));
  }

  async exists(location: string): Promise<boolean> {
    return this.storage.has(location);
  }

  async ensureDirectory(directory: string): Promise<void> {
    // Since this is an in-memory implementation, directories are not needed.
    // This method is a no-op.
    this.logger.debug(`ensureDirectory called for ${directory}, but this is a no-op in MemoryStorageProvider.`);
    return;
  }
}
