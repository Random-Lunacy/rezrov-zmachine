/**
 * Storage factory functions to create a storage instance
 */
import { QuetzalFormat } from './formats/QuetzalFormat';
import { SimpleDatFormat } from './formats/SimpleDatFormat';
import { BrowserStorageProvider } from './providers/BrowserStorageProvider';
import { FileSystemProvider } from './providers/FileSystemProvider';
import { MemoryStorageProvider } from './providers/MemoryStorageProvider';
import { Storage } from './Storage';

export function createFileSystemStorage(originalStoryData: Buffer, useQuetzal: boolean = true): Storage {
  const formatProvider = useQuetzal ? new QuetzalFormat() : new SimpleDatFormat();
  const storageProvider = new FileSystemProvider();
  return new Storage(formatProvider, storageProvider, originalStoryData);
}

export function createBrowserStorage(originalStoryData: Buffer): Storage {
  const formatProvider = new SimpleDatFormat();
  const storageProvider = new BrowserStorageProvider();
  return new Storage(formatProvider, storageProvider, originalStoryData);
}

export function createMemoryStorage(originalStoryData: Buffer): Storage {
  const formatProvider = new SimpleDatFormat();
  const storageProvider = new MemoryStorageProvider();
  return new Storage(formatProvider, storageProvider, originalStoryData);
}
