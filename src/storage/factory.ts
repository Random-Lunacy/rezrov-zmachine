/**
 * Storage factory functions to create a storage instance
 */
import { EnhancedDatFormat } from './formats/EnhancedDatFormat';
import { QuetzalFormat } from './formats/QuetzalFormat';
import { BrowserStorageProvider } from './providers/BrowserStorageProvider';
import { FileSystemProvider } from './providers/FileSystemProvider';
import { MemoryStorageProvider } from './providers/MemoryStorageProvider';
import { Storage } from './Storage';

export function createFileSystemStorage(originalStoryData: Buffer, useQuetzal: boolean = true): Storage {
  const formatProvider = useQuetzal ? new QuetzalFormat() : new EnhancedDatFormat();
  const storageProvider = new FileSystemProvider();
  return new Storage(formatProvider, storageProvider, originalStoryData);
}

export function createBrowserStorage(originalStoryData: Buffer): Storage {
  const formatProvider = new EnhancedDatFormat();
  const storageProvider = new BrowserStorageProvider();
  return new Storage(formatProvider, storageProvider, originalStoryData);
}

export function createMemoryStorage(originalStoryData: Buffer): Storage {
  const formatProvider = new EnhancedDatFormat();
  const storageProvider = new MemoryStorageProvider();
  return new Storage(formatProvider, storageProvider, originalStoryData);
}
