// tests/unit/storage/factory.test.ts
import { describe, expect, it } from 'vitest';
import { createBrowserStorage, createMemoryStorage } from '../../../src/storage/factory';
import { EnhancedDatFormat } from '../../../src/storage/formats/EnhancedDatFormat';
import { BrowserStorageProvider } from '../../../src/storage/providers/BrowserStorageProvider';
import { MemoryStorageProvider } from '../../../src/storage/providers/MemoryStorageProvider';
import { Storage } from '../../../src/storage/Storage';

describe('Storage Factory Functions', () => {
  const originalStory = Buffer.from([0x03]); // Mock Z-machine story file (version 3)

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
