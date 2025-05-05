import { Stats } from 'fs';
import * as fs from 'fs/promises';
import { glob } from 'glob';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileSystemProvider } from '../../../src/storage/providers/FileSystemProvider';
import { Logger } from '../../../src/utils/log';

// Suppress console output during tests
Logger.setLogToConsole(false);

// Mock fs/promises module
vi.mock('fs/promises');
// Mock glob module
vi.mock('glob');

describe('FileSystemProvider', () => {
  let provider: FileSystemProvider;

  beforeEach(() => {
    // Create a new instance for each test
    provider = new FileSystemProvider();

    // Reset all mocks
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('read', () => {
    it('should read a file successfully', async () => {
      const testData = Buffer.from('test data');
      // Mock fs.readFile to return test data
      vi.mocked(fs.readFile).mockResolvedValue(testData);

      const result = await provider.read('test.dat');

      // Verify fs.readFile was called with the correct path
      expect(fs.readFile).toHaveBeenCalledWith('test.dat');
      // Verify the returned data matches what we expected
      expect(result).toEqual(testData);
    });

    it('should return null when file does not exist', async () => {
      // Mock fs.readFile to throw ENOENT error
      const error = new Error('File not found');
      (error as NodeJS.ErrnoException).code = 'ENOENT';
      vi.mocked(fs.readFile).mockRejectedValue(error);

      const result = await provider.read('nonexistent.dat');

      // Verify fs.readFile was called
      expect(fs.readFile).toHaveBeenCalledWith('nonexistent.dat');
      // Verify null is returned for non-existent files
      expect(result).toBeNull();
    });

    it('should throw error when permission denied', async () => {
      // Mock fs.readFile to throw EACCES error
      const error = new Error('Permission denied');
      (error as NodeJS.ErrnoException).code = 'EACCES';
      vi.mocked(fs.readFile).mockRejectedValue(error);

      // Should throw with 'Permission denied' message
      await expect(provider.read('protected.dat')).rejects.toThrow('Permission denied');
      expect(fs.readFile).toHaveBeenCalledWith('protected.dat');
    });

    it('should return null for other errors', async () => {
      // Mock fs.readFile to throw a generic error
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Unknown error'));

      const result = await provider.read('problem.dat');

      // Verify null is returned for other errors
      expect(result).toBeNull();
    });
  });

  describe('write', () => {
    it('should write to a file successfully', async () => {
      const testData = Buffer.from('test data');
      // Mock fs.writeFile to succeed
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await provider.write('test.dat', testData);

      // Verify fs.writeFile was called with correct arguments
      expect(fs.writeFile).toHaveBeenCalledWith('test.dat', testData);
    });

    it('should propagate errors when write fails', async () => {
      const testData = Buffer.from('test data');
      // Mock fs.writeFile to throw error
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Write failed'));

      // Should throw the error
      await expect(provider.write('test.dat', testData)).rejects.toThrow('Write failed');
    });
  });

  describe('list', () => {
    it('should list files in a directory without pattern', async () => {
      // Mock fs.readdir to return string array (this matches the implementation)
      const files = ['file1.dat', 'file2.dat', '.hidden'];
      vi.mocked(fs.readdir).mockResolvedValue(files);

      const result = await provider.list('/test/dir');

      // Verify fs.readdir was called
      expect(fs.readdir).toHaveBeenCalledWith('/test/dir');
      // Verify hidden files are filtered out
      expect(result).toEqual(['file1.dat', 'file2.dat']);
    });

    it('should list files matching a pattern', async () => {
      const matchingFiles = ['/test/dir/file1.dat', '/test/dir/file2.dat'];
      // Mock glob to return matching files
      vi.mocked(glob).mockResolvedValue(matchingFiles);

      const result = await provider.list('/test/dir', '*.dat');

      // Verify glob was called with correct pattern
      expect(glob).toHaveBeenCalledWith(path.join('/test/dir', '*.dat'));
      // Verify the returned files match the pattern
      expect(result).toEqual(matchingFiles);
    });

    it('should handle errors during listing', async () => {
      // Mock fs.readdir to throw error
      vi.mocked(fs.readdir).mockRejectedValue(new Error('Read directory failed'));

      // Should throw the error
      await expect(provider.list('/test/dir')).rejects.toThrow('Read directory failed');
    });
  });

  describe('delete', () => {
    it('should delete a file successfully', async () => {
      // Mock fs.unlink to succeed
      vi.mocked(fs.unlink).mockResolvedValue(undefined);

      const result = await provider.delete('test.dat');

      // Verify fs.unlink was called
      expect(fs.unlink).toHaveBeenCalledWith('test.dat');
      // Verify true is returned for successful deletion
      expect(result).toBe(true);
    });

    it('should return false when deletion fails', async () => {
      // Mock fs.unlink to throw error
      vi.mocked(fs.unlink).mockRejectedValue(new Error('Delete failed'));

      const result = await provider.delete('nonexistent.dat');

      // Verify fs.unlink was called
      expect(fs.unlink).toHaveBeenCalledWith('nonexistent.dat');
      // Verify false is returned for failed deletion
      expect(result).toBe(false);
    });
  });

  describe('exists', () => {
    it('should return true when file exists', async () => {
      // Mock fs.access to succeed
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const result = await provider.exists('test.dat');

      // Verify fs.access was called
      expect(fs.access).toHaveBeenCalledWith('test.dat');
      // Verify true is returned for existing file
      expect(result).toBe(true);
    });

    it('should return false when file does not exist', async () => {
      // Mock fs.access to throw error
      vi.mocked(fs.access).mockRejectedValue(new Error('File not found'));

      const result = await provider.exists('nonexistent.dat');

      // Verify fs.access was called
      expect(fs.access).toHaveBeenCalledWith('nonexistent.dat');
      // Verify false is returned for non-existent file
      expect(result).toBe(false);
    });
  });

  describe('ensureDirectory', () => {
    it('should do nothing if directory already exists', async () => {
      // Create a mock stat object with isDirectory method
      const mockStats = {
        isDirectory: vi.fn().mockReturnValue(true),
      };

      // Mock fs.stat to return directory stats
      vi.mocked(fs.stat).mockResolvedValue(mockStats as unknown as Stats);

      await provider.ensureDirectory('/test/dir');

      // Verify fs.stat was called
      expect(fs.stat).toHaveBeenCalledWith('/test/dir');
      // Verify isDirectory was called
      expect(mockStats.isDirectory).toHaveBeenCalled();
      // Verify fs.mkdir was not called
      expect(fs.mkdir).not.toHaveBeenCalled();
    });

    it('should create directory if it does not exist', async () => {
      // Mock fs.stat to throw ENOENT error
      const error = new Error('Directory not found');
      (error as NodeJS.ErrnoException).code = 'ENOENT';
      vi.mocked(fs.stat).mockRejectedValue(error);

      // Mock fs.mkdir to succeed
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);

      await provider.ensureDirectory('/test/dir');

      // Verify fs.stat was called
      expect(fs.stat).toHaveBeenCalledWith('/test/dir');
      // Verify fs.mkdir was called with recursive option
      expect(fs.mkdir).toHaveBeenCalledWith('/test/dir', { recursive: true });
    });

    it('should throw if path exists but is not a directory', async () => {
      // Create a mock stat object with isDirectory method
      const mockStats = {
        isDirectory: vi.fn().mockReturnValue(false),
      };

      // Mock fs.stat to return file stats
      vi.mocked(fs.stat).mockResolvedValue(mockStats as unknown as Stats);

      // Should throw with specific message
      await expect(provider.ensureDirectory('/test/file')).rejects.toThrow(
        /A file with the same name as the directory.*already exists/
      );

      // Verify isDirectory was called
      expect(mockStats.isDirectory).toHaveBeenCalled();
    });

    it('should throw if directory creation fails', async () => {
      // Mock fs.stat to throw ENOENT error
      const statError = new Error('Directory not found');
      (statError as NodeJS.ErrnoException).code = 'ENOENT';
      vi.mocked(fs.stat).mockRejectedValue(statError);

      // Mock fs.mkdir to throw error
      vi.mocked(fs.mkdir).mockRejectedValue(new Error('Creation failed'));

      // Should throw with specific message
      await expect(provider.ensureDirectory('/test/dir')).rejects.toThrow(
        /Failed to create directory.*Creation failed/
      );
    });

    it('should throw for other stat errors', async () => {
      // Mock fs.stat to throw generic error
      vi.mocked(fs.stat).mockRejectedValue(new Error('Stat failed'));

      // Should throw with specific message
      await expect(provider.ensureDirectory('/test/dir')).rejects.toThrow(/Failed to check directory.*Stat failed/);
    });
  });

  describe('getStats', () => {
    it('should return file stats when file exists', async () => {
      const mockDate = new Date();
      // Create a mock stats object
      const mockStats = {
        size: 1024,
        mtime: mockDate,
        birthtime: mockDate,
      };

      // Mock fs.stat to return stats
      vi.mocked(fs.stat).mockResolvedValue(mockStats as unknown as Stats);

      const stats = await provider.getStats('test.dat');

      // Verify fs.stat was called
      expect(fs.stat).toHaveBeenCalledWith('test.dat');
      // Verify returned stats match expected values
      expect(stats).toEqual({
        size: 1024,
        lastModified: mockDate,
        created: mockDate,
      });
    });

    it('should return null when file does not exist', async () => {
      // Mock fs.stat to throw error
      vi.mocked(fs.stat).mockRejectedValue(new Error('File not found'));

      const stats = await provider.getStats('nonexistent.dat');

      // Verify fs.stat was called
      expect(fs.stat).toHaveBeenCalledWith('nonexistent.dat');
      // Verify null is returned for non-existent file
      expect(stats).toBeNull();
    });
  });
});
