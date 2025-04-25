/**
 * Storage factory functions to create a storage instance
 */
import { EnhancedDatFormat } from './formats/EnhancedDatFormat';
import { QuetzalFormat } from './formats/QuetzalFormat';
import { StorageInterface } from './interfaces';
import { BrowserStorageProvider } from './providers/BrowserStorageProvider';
import { FileSystemProvider } from './providers/FileSystemProvider';
import { MemoryStorageProvider } from './providers/MemoryStorageProvider';
import { Storage } from './Storage';

/**
 * FileSystemStorage factory function
 * Creates a storage instance that uses the file system for storage.
 * This is useful for desktop applications or environments where
 * file system access is available.
 * Use Quetzal format by default, but can be overridden.
 */
export function createFileSystemStorage(originalStoryData: Buffer, useQuetzal: boolean = true): StorageInterface {
  const formatProvider = useQuetzal ? new QuetzalFormat() : new EnhancedDatFormat();
  const storageProvider = new FileSystemProvider();
  return new Storage(formatProvider, storageProvider, originalStoryData);
}

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
