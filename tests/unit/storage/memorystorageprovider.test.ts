import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorageProvider } from '../../../src/storage/providers/MemoryStorageProvider';
import { Logger } from '../../../src/utils/log';

// Suppress console output during tests
Logger.setLogToConsole(false);

describe('MemoryStorageProvider', () => {
  let provider: MemoryStorageProvider;

  beforeEach(() => {
    // Create a new instance for each test
    provider = new MemoryStorageProvider();

    // Mock the logger
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
  });

  describe('read/write operations', () => {
    it('should return null when reading non-existent location', async () => {
      const result = await provider.read('nonexistent');
      expect(result).toBeNull();
    });

    it('should write and read data correctly', async () => {
      const testData = Buffer.from('test data');
      const location = 'test-location';

      await provider.write(location, testData);
      const result = await provider.read(location);

      expect(result).not.toBeNull();
      expect(result?.toString()).toBe('test data');
    });

    it('should overwrite existing data', async () => {
      const location = 'test-location';

      await provider.write(location, Buffer.from('initial data'));
      await provider.write(location, Buffer.from('updated data'));

      const result = await provider.read(location);
      expect(result?.toString()).toBe('updated data');
    });
  });

  describe('exists operation', () => {
    it('should return false for non-existent locations', async () => {
      const exists = await provider.exists('nonexistent');
      expect(exists).toBe(false);
    });

    it('should return true for existing locations', async () => {
      const location = 'test-location';
      await provider.write(location, Buffer.from('test data'));

      const exists = await provider.exists(location);
      expect(exists).toBe(true);
    });
  });

  describe('list operation', () => {
    it('should return empty array when no data is stored', async () => {
      const result = await provider.list();
      expect(result).toEqual([]);
    });

    it('should list all stored locations', async () => {
      await provider.write('location1', Buffer.from('data1'));
      await provider.write('location2', Buffer.from('data2'));
      await provider.write('location3', Buffer.from('data3'));

      const result = await provider.list();
      expect(result).toHaveLength(3);
      expect(result).toEqual(expect.arrayContaining(['location1', 'location2', 'location3']));
    });

    it('should filter locations based on pattern', async () => {
      await provider.write('save.dat', Buffer.from('data1'));
      await provider.write('save-1.dat', Buffer.from('data2'));
      await provider.write('config.json', Buffer.from('data3'));

      const result = await provider.list('save');
      expect(result).toHaveLength(2);
      expect(result).toEqual(expect.arrayContaining(['save.dat', 'save-1.dat']));
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
