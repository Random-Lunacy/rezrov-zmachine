import { Logger } from '../../utils/log';
import { StorageProvider } from './StorageProvider';

// Typical localStorage size limit in browsers (in bytes)
const DEFAULT_SIZE_LIMIT = 5 * 1024 * 1024; // 5MB

export class BrowserStorageProvider implements StorageProvider {
  private logger: Logger;
  private prefix: string;
  private sizeLimit: number;

  constructor(options?: { prefix?: string; logger?: Logger; sizeLimit?: number }) {
    this.logger = options?.logger || new Logger('BrowserStorageProvider');
    this.prefix = options?.prefix || 'rezrov-zmachine-';
    this.sizeLimit = options?.sizeLimit || DEFAULT_SIZE_LIMIT;
  }

  /**
   * Read data from localStorage
   * @param location The storage key (without prefix)
   * @returns Buffer containing the data, or null if not found
   * @throws Error if there's an error reading from localStorage
   */
  async read(location: string): Promise<Buffer | null> {
    try {
      const data = localStorage.getItem(this.prefix + location);
      if (!data) return null;

      return Buffer.from(data, 'base64');
    } catch (error) {
      this.logger.error(`Error reading from localStorage: ${error}`);
      throw new Error(`Failed to read from localStorage: ${error}`);
    }
  }

  /**
   * Write data to localStorage
   * @param location The storage key (without prefix)
   * @param data Buffer containing the data to write
   * @throws Error if the data exceeds the size limit or if there's an error writing to localStorage
   */
  async write(location: string, data: Buffer): Promise<void> {
    try {
      // Check size limit
      if (data.length > this.sizeLimit) {
        throw new Error(`Data size (${data.length} bytes) exceeds limit (${this.sizeLimit} bytes)`);
      }

      const base64Data = data.toString('base64');

      try {
        localStorage.setItem(this.prefix + location, base64Data);
      } catch (storageError) {
        // Check if it's a quota error
        if (isQuotaExceededError(storageError)) {
          // Try to free some space by removing old items
          if (!this.clearOldest()) {
            throw new Error('Storage quota exceeded and unable to free space');
          }

          // Try again
          localStorage.setItem(this.prefix + location, base64Data);
        } else {
          throw storageError;
        }
      }
    } catch (error) {
      this.logger.error(`Failed to write to localStorage: ${error}`);
      throw new Error(`Failed to write to localStorage: ${error}`);
    }
  }

  /**
   * List all storage keys matching the pattern
   * @param pattern Optional pattern to filter keys
   * @returns Array of matching keys (without prefix)
   * @throws Error if there's an error listing localStorage keys
   */
  async list(pattern?: string): Promise<string[]> {
    try {
      const results: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(this.prefix)) continue;

        const filename = key.substring(this.prefix.length);

        if (!pattern || this.matchPattern(filename, pattern)) {
          results.push(filename);
        }
      }

      return results;
    } catch (error) {
      this.logger.error(`Error listing localStorage keys: ${error}`);
      throw new Error(`Failed to list localStorage keys: ${error}`);
    }
  }

  /**
   * Check if a key exists in localStorage
   * @param location The storage key (without prefix)
   * @returns True if the key exists, false otherwise
   * @throws Error if there's an error checking localStorage
   */
  async exists(location: string): Promise<boolean> {
    try {
      return localStorage.getItem(this.prefix + location) !== null;
    } catch (error) {
      this.logger.error(`Error checking if item exists in localStorage: ${error}`);
      throw new Error(`Failed to check if item exists in localStorage: ${error}`);
    }
  }

  /**
   * Delete an item from localStorage
   * @param location The storage key (without prefix)
   * @returns True if the item was deleted, false if it didn't exist
   * @throws Error if there's an error deleting from localStorage
   */
  async delete(location: string): Promise<boolean> {
    try {
      const key = this.prefix + location;
      const exists = localStorage.getItem(key) !== null;

      if (exists) {
        localStorage.removeItem(key);
      }

      return exists;
    } catch (error) {
      this.logger.error(`Error deleting item from localStorage: ${error}`);
      throw new Error(`Failed to delete item from localStorage: ${error}`);
    }
  }

  /**
   * Clear all items matching the pattern
   * @param pattern Pattern to match keys
   * @returns Number of items deleted
   * @throws Error if there's an error clearing localStorage
   */
  async clear(pattern?: string): Promise<number> {
    try {
      const keys = await this.list(pattern);
      let count = 0;

      for (const key of keys) {
        const fullKey = this.prefix + key;
        localStorage.removeItem(fullKey);
        count++;
      }

      return count;
    } catch (error) {
      this.logger.error(`Error clearing localStorage: ${error}`);
      throw new Error(`Failed to clear localStorage: ${error}`);
    }
  }

  /**
   * Get the total size of all items in localStorage with this prefix
   * @returns The total size in bytes
   * @throws Error if there's an error calculating the size
   */
  async getTotalSize(): Promise<number> {
    try {
      let totalSize = 0;

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(this.prefix)) continue;

        const value = localStorage.getItem(key) || '';
        // Key size + value size in UTF-16 (2 bytes per character)
        totalSize += (key.length + value.length) * 2;
      }

      return totalSize;
    } catch (error) {
      this.logger.error(`Error calculating localStorage size: ${error}`);
      throw new Error(`Failed to calculate localStorage size: ${error}`);
    }
  }

  /**
   * No-op for compatibility with the StorageProvider interface
   * @param directory Directory name (ignored)
   */
  async ensureDirectory(directory: string): Promise<void> {
    this.logger.debug(`ensureDirectory called for ${directory}, but this is a no-op in BrowserStorageProvider.`);
    return;
  }

  /**
   * Match a filename against a pattern
   * @param filename The filename to check
   * @param pattern The pattern to match
   * @returns True if the filename matches the pattern
   */
  private matchPattern(filename: string, pattern: string): boolean {
    // Convert glob pattern to regex
    // Escape special regex characters except * and ?
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\*/g, '.*') // * becomes .*
      .replace(/\?/g, '.'); // ? becomes .

    return new RegExp(`^${regexPattern}$`).test(filename);
  }

  /**
   * Clear the oldest item in localStorage with this prefix
   * @returns True if an item was cleared, false if no items found
   */
  private clearOldest(): boolean {
    try {
      // Find the oldest item with our prefix
      let oldestKey: string | null = null;
      let oldestTime = Date.now();

      // Simple timestamp-based approach
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(this.prefix)) continue;

        try {
          const data = localStorage.getItem(key);
          if (!data) continue;

          // Try to parse as JSON to see if it has a timestamp
          const parsed = JSON.parse(data);
          if (parsed && parsed.__timestamp && parsed.__timestamp < oldestTime) {
            oldestTime = parsed.__timestamp;
            oldestKey = key;
          }
        } catch {
          // If not parseable as JSON or no timestamp, consider it a candidate for removal
          if (!oldestKey) {
            oldestKey = key;
          }
        }
      }

      if (oldestKey) {
        localStorage.removeItem(oldestKey);
        this.logger.debug(`Cleared oldest item: ${oldestKey}`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Error clearing oldest item: ${error}`);
      return false;
    }
  }
}

/**
 * Check if an error is a quota exceeded error
 * @param error The error to check
 * @returns True if it's a quota exceeded error
 */
function isQuotaExceededError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  return (
    // Firefox
    error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    // Chrome
    error.name === 'QuotaExceededError' ||
    // Safari
    error.name === 'QUOTA_EXCEEDED_ERR' ||
    // Generic fallback
    error.message.includes('quota') ||
    error.message.includes('storage')
  );
}
