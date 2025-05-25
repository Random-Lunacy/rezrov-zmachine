// tests/unit/storage/factory.test.ts
import { describe, expect, it } from 'vitest';
import { createBrowserStorage, createFileSystemStorage, createMemoryStorage } from '../../../src/storage/factory';
import { EnhancedDatFormat } from '../../../src/storage/formats/EnhancedDatFormat';
import { QuetzalFormat } from '../../../src/storage/formats/QuetzalFormat';
import { BrowserStorageProvider } from '../../../src/storage/providers/BrowserStorageProvider';
import { FileSystemProvider } from '../../../src/storage/providers/FileSystemProvider';
import { MemoryStorageProvider } from '../../../src/storage/providers/MemoryStorageProvider';
import { Storage } from '../../../src/storage/Storage';

describe('Storage Factory Functions', () => {
  const originalStory = Buffer.from([0x03]); // Mock Z-machine story file (version 3)

  describe('createFileSystemStorage', () => {
    it('should create a Storage with FileSystemProvider and QuetzalFormat by default', () => {
      const storage = createFileSystemStorage(originalStory);

      // Test that it's a Storage instance
      expect(storage).toBeInstanceOf(Storage);

      // Access the private properties with type casting to verify correct setup
      const formatProvider = (storage as any).formatProvider;
      const storageProvider = (storage as any).storageProvider;
      const storyData = (storage as any).originalStory;

      expect(formatProvider).toBeInstanceOf(QuetzalFormat);
      expect(storageProvider).toBeInstanceOf(FileSystemProvider);
      expect(storyData).toBe(originalStory);
    });

    it('should use EnhancedDatFormat when useQuetzal is false', () => {
      const storage = createFileSystemStorage(originalStory, false);

      // Test that it's a Storage instance
      expect(storage).toBeInstanceOf(Storage);

      // Access the private properties with type casting to verify correct setup
      const formatProvider = (storage as any).formatProvider;
      const storageProvider = (storage as any).storageProvider;
      const storyData = (storage as any).originalStory;

      expect(formatProvider).toBeInstanceOf(EnhancedDatFormat);
      expect(storageProvider).toBeInstanceOf(FileSystemProvider);
      expect(storyData).toBe(originalStory);
    });
  });

  describe('createBrowserStorage', () => {
    it('should create a Storage with BrowserStorageProvider and EnhancedDatFormat', () => {
      const storage = createBrowserStorage(originalStory);

      // Test that it's a Storage instance
      expect(storage).toBeInstanceOf(Storage);

      // Access the private properties with type casting to verify correct setup
      const formatProvider = (storage as any).formatProvider;
      const storageProvider = (storage as any).storageProvider;
      const storyData = (storage as any).originalStory;

      expect(formatProvider).toBeInstanceOf(EnhancedDatFormat);
      expect(storageProvider).toBeInstanceOf(BrowserStorageProvider);
      expect(storyData).toBe(originalStory);
    });
  });

  describe('createMemoryStorage', () => {
    it('should create a Storage with MemoryStorageProvider and EnhancedDatFormat', () => {
      const storage = createMemoryStorage(originalStory);

      // Test that it's a Storage instance
      expect(storage).toBeInstanceOf(Storage);

      // Access the private properties with type casting to verify correct setup
      const formatProvider = (storage as any).formatProvider;
      const storageProvider = (storage as any).storageProvider;
      const storyData = (storage as any).originalStory;

      expect(formatProvider).toBeInstanceOf(EnhancedDatFormat);
      expect(storageProvider).toBeInstanceOf(MemoryStorageProvider);
      expect(storyData).toBe(originalStory);
    });
  });
});
