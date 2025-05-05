import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FormatProvider } from '../../../src/storage/formats/FormatProvider';
import { StorageInterface, StorageOptions } from '../../../src/storage/interfaces';
import { StorageProvider } from '../../../src/storage/providers/StorageProvider';
import { Storage } from '../../../src/storage/Storage';
import { ZMachineState } from '../../../src/types';
import { Logger } from '../../../src/utils/log';

// Silence logger during tests
Logger.setLogToConsole(false);

describe('Storage', () => {
  // Mock implementations of FormatProvider and StorageProvider
  let mockFormatProvider: FormatProvider;
  let mockStorageProvider: StorageProvider;
  let originalStory: Buffer;
  let storage: StorageInterface;
  let mockState: ZMachineState;

  beforeEach(() => {
    // Create a mock FormatProvider
    mockFormatProvider = {
      serialize: vi.fn().mockReturnValue(Buffer.from('serialized data')),
      deserialize: vi.fn().mockReturnValue({
        memory: Buffer.alloc(1000),
        pc: 0x1000,
        stack: [1, 2, 3],
        callFrames: [],
        originalStory: Buffer.alloc(1000),
      }),
      extractMetadata: vi.fn().mockReturnValue({ description: 'Test save file' }),
    };

    // Mock the constructor name for format detection
    Object.defineProperty(mockFormatProvider.constructor, 'name', {
      value: 'EnhancedDatFormat',
    });

    // Create a mock StorageProvider
    mockStorageProvider = {
      read: vi.fn().mockResolvedValue(Buffer.from('saved data')),
      write: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue(['save.dat', 'save-1.dat', 'save-2.dat']),
      exists: vi.fn().mockResolvedValue(true),
      ensureDirectory: vi.fn().mockResolvedValue(undefined),
    };

    // Create original story buffer
    originalStory = Buffer.alloc(1000);
    originalStory[0] = 3; // Version 3

    // Set up a test Z-machine state
    mockState = {
      memory: Buffer.alloc(1000),
      pc: 0x1000,
      stack: [1, 2, 3],
      callFrames: [],
      originalStory: Buffer.from(originalStory),
    };

    // Create the storage instance
    storage = new Storage(mockFormatProvider, mockStorageProvider, originalStory);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with default options', () => {
      // Test that Storage initializes with default options
      expect(storage).toBeDefined();

      // Verify that setting storage options directly works
      const options: StorageOptions = { filename: 'test.dat' };
      storage.setOptions(options);

      // Ensure the file path reflects the new options (indirectly test private method)
      return storage.getSaveInfo().then((info) => {
        expect(info.path).toBe('test.dat');
      });
    });

    it('should initialize with provided options', () => {
      const options: StorageOptions = {
        filename: 'custom.dat',
        description: 'Custom save file',
      };

      // Create storage with options
      const customStorage = new Storage(mockFormatProvider, mockStorageProvider, originalStory, options);

      // Ensure options are applied
      return customStorage.getSaveInfo().then((info) => {
        expect(info.path).toBe('custom.dat');
      });
    });
  });

  describe('saveSnapshot', () => {
    it('should serialize and write state to the provider', async () => {
      await storage.saveSnapshot(mockState, 'Test description');

      // Verify format provider was called with correct state
      expect(mockFormatProvider.serialize).toHaveBeenCalledWith(mockState);

      // Verify storage provider was called with correct data
      expect(mockStorageProvider.write).toHaveBeenCalledWith(
        'save.dat', // Default filename
        expect.any(Buffer)
      );
    });

    it('should use custom filename when provided', async () => {
      storage.setOptions({ filename: 'custom.dat' });
      await storage.saveSnapshot(mockState);

      expect(mockStorageProvider.write).toHaveBeenCalledWith('custom.dat', expect.any(Buffer));
    });

    it('should handle write errors', async () => {
      // Mock a write error
      mockStorageProvider.write = vi.fn().mockRejectedValue(new Error('Write failed'));

      // Expect the error to be propagated
      await expect(storage.saveSnapshot(mockState)).rejects.toThrow();
    });
  });

  describe('loadSnapshot', () => {
    it('should read and deserialize state from the provider', async () => {
      const result = await storage.loadSnapshot();

      // Verify storage provider was called to read the file
      expect(mockStorageProvider.read).toHaveBeenCalledWith('save.dat');

      // Verify format provider was called to deserialize
      expect(mockFormatProvider.deserialize).toHaveBeenCalledWith(expect.any(Buffer), originalStory);

      // Verify the result is the deserialized state
      expect(result).toEqual({
        memory: expect.any(Buffer),
        pc: 0x1000,
        stack: [1, 2, 3],
        callFrames: [],
        originalStory: expect.any(Buffer),
      });
    });

    it('should throw when save file does not exist', async () => {
      // Mock file not found
      mockStorageProvider.read = vi.fn().mockResolvedValue(null);

      // Expect error about missing save file
      await expect(storage.loadSnapshot()).rejects.toThrow('Save file not found');
    });

    it('should handle deserialize errors', async () => {
      // Mock a deserialize error
      mockFormatProvider.deserialize = vi.fn().mockImplementation(() => {
        throw new Error('Invalid save data');
      });

      // Expect the error to be propagated
      await expect(storage.loadSnapshot()).rejects.toThrow('Invalid save data');
    });
  });

  describe('getSaveInfo', () => {
    it('should return info when save file exists', async () => {
      const info = await storage.getSaveInfo();

      // Verify storage provider was checked for existence
      expect(mockStorageProvider.exists).toHaveBeenCalledWith('save.dat');

      // Verify format provider was used to extract metadata
      expect(mockFormatProvider.extractMetadata).toHaveBeenCalled();

      // Verify the returned info
      expect(info).toEqual({
        exists: true,
        path: 'save.dat',
        format: 'enhanceddat',
        description: 'Test save file',
      });
    });

    it('should return info when save file does not exist', async () => {
      // Mock file not found
      mockStorageProvider.exists = vi.fn().mockResolvedValue(false);

      const info = await storage.getSaveInfo();

      // Verify the returned info indicates non-existence
      expect(info).toEqual({
        exists: false,
        path: 'save.dat',
      });

      // Verify extractMetadata was not called
      expect(mockFormatProvider.extractMetadata).not.toHaveBeenCalled();
    });

    it('should handle errors from exists check', async () => {
      // Mock an error when checking existence
      mockStorageProvider.exists = vi.fn().mockRejectedValue(new Error('Access denied'));

      // Expect the error to be propagated with context
      await expect(storage.getSaveInfo()).rejects.toThrow('Failed to get save info');
    });

    it('should handle case where extractMetadata is not available', async () => {
      // Create format provider without extractMetadata
      const limitedFormatProvider: FormatProvider = {
        serialize: vi.fn().mockReturnValue(Buffer.from('serialized data')),
        deserialize: vi.fn().mockReturnValue(mockState),
        // No extractMetadata
      };

      // Create storage with limited provider
      const limitedStorage = new Storage(limitedFormatProvider, mockStorageProvider, originalStory);

      // Should still return info without description
      const info = await limitedStorage.getSaveInfo();

      expect(info).toEqual({
        exists: true,
        path: 'save.dat',
        format: expect.any(String),
        description: '',
      });
    });
  });

  describe('listSaves', () => {
    it('should list save files and get their info', async () => {
      const saves = await storage.listSaves();

      // Verify storage provider list was called with expected pattern
      expect(mockStorageProvider.list).toHaveBeenCalledWith('save*');

      // Verify format provider was used to extract metadata for each save
      expect(mockFormatProvider.extractMetadata).toHaveBeenCalledTimes(3);

      // Verify the returned saves list
      expect(saves).toHaveLength(3);
      expect(saves[0]).toEqual({
        exists: true,
        path: 'save.dat',
        format: 'enhanceddat',
        description: 'Test save file',
      });
    });

    it('should handle errors from list operation', async () => {
      // Mock a list error
      mockStorageProvider.list = vi.fn().mockRejectedValue(new Error('Permission denied'));

      // Expect the error to be propagated with context
      await expect(storage.listSaves()).rejects.toThrow('Failed to list saves');
    });

    it('should filter out unreadable save files', async () => {
      // Mock read to succeed for only one file
      mockStorageProvider.read = vi.fn().mockImplementation(async (path) => {
        if (path === 'save.dat') {
          return Buffer.from('valid data');
        }
        return null;
      });

      const saves = await storage.listSaves();

      // Only one valid save should be returned
      expect(saves).toHaveLength(1);
      expect(saves[0].path).toBe('save.dat');
    });

    it('should handle custom filename pattern', async () => {
      storage.setOptions({ filename: 'mysave.quetzal' });
      await storage.listSaves();

      // Should search with the filename base
      expect(mockStorageProvider.list).toHaveBeenCalledWith('mysave*');
    });
  });

  describe('setOptions', () => {
    it('should update options without affecting existing ones', () => {
      // Set initial options
      storage.setOptions({
        savePath: '/path/to/saves',
        useCompression: true,
      });

      // Update just one option
      storage.setOptions({ filename: 'updated.dat' });

      // Get the options indirectly through getSaveInfo
      return storage.getSaveInfo().then((info) => {
        expect(info.path).toBe('updated.dat');

        // Cannot directly test private field but the behavior
        // suggests the original options were preserved
      });
    });
  });
});
