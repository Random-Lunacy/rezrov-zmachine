import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserStorageProvider } from '../../../src/storage/providers/BrowserStorageProvider';
import { Logger } from '../../../src/utils/log';

// Suppress console output during tests
Logger.setLogToConsole(false);

describe('BrowserStorageProvider', () => {
  let provider: BrowserStorageProvider;
  let localStorageMock: Record<string, any>;

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    };

    // Replace global localStorage with our mock
    global.localStorage = localStorageMock as unknown as Storage;

    // Create a new instance with a custom prefix for testing
    provider = new BrowserStorageProvider({
      prefix: 'test-',
      sizeLimit: 1000, // Small limit for testing
      logger: new Logger('BrowserStorageProviderTest'),
    });

    // Mock the logger
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('read operation', () => {
    it('should return null when reading non-existent location', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      const result = await provider.read('nonexistent');

      expect(localStorageMock.getItem).toHaveBeenCalledWith('test-nonexistent');
      expect(result).toBeNull();
    });

    it('should decode base64 data when reading', async () => {
      // 'test data' in base64
      const base64Data = 'dGVzdCBkYXRh';
      localStorageMock.getItem.mockReturnValue(base64Data);

      const result = await provider.read('test-location');

      expect(localStorageMock.getItem).toHaveBeenCalledWith('test-test-location');
      expect(result).not.toBeNull();
      expect(result?.toString()).toBe('test data');
    });

    it('should throw an error when localStorage access fails', async () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Access denied');
      });

      await expect(provider.read('test-location')).rejects.toThrow('Failed to read from localStorage');
    });
  });

  describe('write operation', () => {
    it('should encode data as base64 when writing', async () => {
      const testData = Buffer.from('test data');

      await provider.write('test-location', testData);

      expect(localStorageMock.setItem).toHaveBeenCalledWith('test-test-location', expect.any(String));

      // Verify the second argument is base64 encoded
      const encodedArg = localStorageMock.setItem.mock.calls[0][1];
      expect(Buffer.from(encodedArg, 'base64').toString()).toBe('test data');
    });

    it('should throw an error when data exceeds size limit', async () => {
      // Create data larger than the size limit (1000 bytes)
      const largeData = Buffer.alloc(1500).fill('X');

      await expect(provider.write('test-location', largeData)).rejects.toThrow(
        'Data size (1500 bytes) exceeds limit (1000 bytes)'
      );

      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('should attempt to clear space when quota is exceeded', async () => {
      // Set up mock to throw quota exceeded error on first call, then succeed
      const quotaError = new Error('Quota exceeded');
      quotaError.name = 'QuotaExceededError';

      let callCount = 0;
      localStorageMock.setItem.mockImplementation(() => {
        if (callCount === 0) {
          callCount++;
          throw quotaError;
        }
        // Second call succeeds
        return undefined;
      });

      // To simulate successful clearOldest behavior:
      // 1. Make localStorage.length return a positive value
      Object.defineProperty(localStorageMock, 'length', { value: 1 });

      // 2. Make it return a prefixed key when requested
      localStorageMock.key.mockReturnValue('test-oldItem');

      // 3. Make getItem return a value for that key
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'test-oldItem') {
          return JSON.stringify({ __timestamp: Date.now() - 1000 });
        }
        return null;
      });

      // Should succeed after clearing oldest item
      await provider.write('test-location', Buffer.from('test data'));

      // Should have tried twice to set the item
      expect(localStorageMock.setItem).toHaveBeenCalledTimes(2);

      // Should have removed the old item
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('test-oldItem');
    });

    it('should throw when quota exceeded and unable to free space', async () => {
      // Set up mock to always throw quota exceeded error
      const quotaError = new Error('Quota exceeded');
      quotaError.name = 'QuotaExceededError';

      localStorageMock.setItem.mockImplementation(() => {
        throw quotaError;
      });

      // Mock empty localStorage to prevent clearing
      localStorageMock.length = 0;

      await expect(provider.write('test-location', Buffer.from('test data'))).rejects.toThrow(
        'Storage quota exceeded and unable to free space'
      );
    });
  });

  describe('exists operation', () => {
    it('should return false for non-existent locations', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      const exists = await provider.exists('nonexistent');

      expect(localStorageMock.getItem).toHaveBeenCalledWith('test-nonexistent');
      expect(exists).toBe(false);
    });

    it('should return true for existing locations', async () => {
      localStorageMock.getItem.mockReturnValue('some data');

      const exists = await provider.exists('test-location');

      expect(localStorageMock.getItem).toHaveBeenCalledWith('test-test-location');
      expect(exists).toBe(true);
    });

    it('should throw an error when localStorage access fails', async () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Access denied');
      });

      await expect(provider.exists('test-location')).rejects.toThrow('Failed to check if item exists');
    });
  });

  describe('list operation', () => {
    beforeEach(() => {
      // Set up localStorage with some items
      localStorageMock.length = 5;
      localStorageMock.key.mockImplementation((index) => {
        const keys = ['test-save.dat', 'test-save-1.dat', 'other-item', 'test-config.json', 'test-notes.txt'];
        return keys[index];
      });
    });

    it('should list all items with the prefix', async () => {
      const result = await provider.list();

      expect(result).toHaveLength(4);
      expect(result).toEqual(expect.arrayContaining(['save.dat', 'save-1.dat', 'config.json', 'notes.txt']));
      // Should not include items without the prefix
      expect(result).not.toContain('other-item');
    });

    it('should filter items based on pattern', async () => {
      const result = await provider.list('save*');

      expect(result).toHaveLength(2);
      expect(result).toEqual(expect.arrayContaining(['save.dat', 'save-1.dat']));
    });

    it('should handle more complex patterns', async () => {
      const resultDat = await provider.list('*.dat');

      expect(resultDat).toHaveLength(2);
      expect(resultDat).toEqual(expect.arrayContaining(['save.dat', 'save-1.dat']));

      const resultTxt = await provider.list('*.txt');

      expect(resultTxt).toHaveLength(1);
      expect(resultTxt).toEqual(['notes.txt']);
    });

    it('should throw an error when localStorage access fails', async () => {
      localStorageMock.key.mockImplementation(() => {
        throw new Error('Access denied');
      });

      await expect(provider.list()).rejects.toThrow('Failed to list localStorage keys');
    });
  });

  describe('delete operation', () => {
    it('should delete existing items', async () => {
      localStorageMock.getItem.mockReturnValue('some data');

      const result = await provider.delete('test-location');

      expect(localStorageMock.getItem).toHaveBeenCalledWith('test-test-location');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('test-test-location');
      expect(result).toBe(true);
    });

    it('should return false for non-existent items', async () => {
      localStorageMock.getItem.mockReturnValue(null);

      const result = await provider.delete('nonexistent');

      expect(localStorageMock.getItem).toHaveBeenCalledWith('test-nonexistent');
      expect(localStorageMock.removeItem).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should throw an error when localStorage access fails', async () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Access denied');
      });

      await expect(provider.delete('test-location')).rejects.toThrow('Failed to delete item');
    });
  });

  describe('clear operation', () => {
    beforeEach(() => {
      // Set up localStorage with some items
      localStorageMock.length = 5;
      localStorageMock.key.mockImplementation((index) => {
        const keys = ['test-save.dat', 'test-save-1.dat', 'other-item', 'test-config.json', 'test-notes.txt'];
        return keys[index];
      });
    });

    it('should clear all matching items', async () => {
      const result = await provider.clear();

      expect(localStorageMock.removeItem).toHaveBeenCalledTimes(4);
      expect(result).toBe(4);
    });

    it('should clear items matching a pattern', async () => {
      const result = await provider.clear('save*');

      expect(localStorageMock.removeItem).toHaveBeenCalledTimes(2);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('test-save.dat');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('test-save-1.dat');
      expect(result).toBe(2);
    });

    it('should throw an error when localStorage access fails', async () => {
      localStorageMock.key.mockImplementation(() => {
        throw new Error('Access denied');
      });

      await expect(provider.clear()).rejects.toThrow('Failed to clear localStorage');
    });
  });

  describe('getTotalSize operation', () => {
    beforeEach(() => {
      // Set up localStorage with some items
      localStorageMock.length = 2;
      localStorageMock.key.mockImplementation((index) => {
        const keys = ['test-item1', 'other-item'];
        return keys[index];
      });
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'test-item1') return 'value1';
        if (key === 'other-item') return 'value2';
        return null;
      });
    });

    it('should calculate total size of items with prefix', async () => {
      const result = await provider.getTotalSize();

      // Only 'test-item1' should be included, with key length 10 and value length 6
      // Each character is 2 bytes in UTF-16
      const expectedSize = (10 + 6) * 2;
      expect(result).toBe(expectedSize);
    });

    it('should throw an error when localStorage access fails', async () => {
      localStorageMock.key.mockImplementation(() => {
        throw new Error('Access denied');
      });

      await expect(provider.getTotalSize()).rejects.toThrow('Failed to calculate localStorage size');
    });
  });

  describe('ensureDirectory operation', () => {
    it('should be a no-op and resolve successfully', async () => {
      const loggerSpy = vi.spyOn(Logger.prototype, 'debug');

      await expect(provider.ensureDirectory('test-dir')).resolves.toBeUndefined();

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('ensureDirectory called'));
    });
  });
});
