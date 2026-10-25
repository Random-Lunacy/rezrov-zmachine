/**
 * Storage factory functions to create a storage instance
 */
import { EnhancedDatFormat } from './formats/EnhancedDatFormat';
import { StorageInterface } from './interfaces';
import { BrowserStorageProvider } from './providers/BrowserStorageProvider';
import { MemoryStorageProvider } from './providers/MemoryStorageProvider';
import { Storage } from './Storage';

/**
 * BrowserStorage factory function
 * Creates a storage instance that uses the browser's local storage.
 * This is useful for web applications where file system access
 * is not available.
 */
export function createBrowserStorage(originalStoryData: Buffer): StorageInterface {
  const formatProvider = new EnhancedDatFormat();
  const storageProvider = new BrowserStorageProvider();
  return new Storage(formatProvider, storageProvider, originalStoryData);
}

/**
 * MemoryStorage factory function
 * Creates a storage instance that uses in-memory storage.
 * This is useful for testing or environments where
 * persistent storage is not required.
 */
export function createMemoryStorage(originalStoryData: Buffer): StorageInterface {
  const formatProvider = new EnhancedDatFormat();
  const storageProvider = new MemoryStorageProvider();
  return new Storage(formatProvider, storageProvider, originalStoryData);
}
