import * as fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Memory } from '../../../src/core/memory/Memory';
import { createFileSystemStorage, FileSystemProvider, memoryFromFile, setLogToFile } from '../../../src/node';
import { EnhancedDatFormat } from '../../../src/storage/formats/EnhancedDatFormat';
import { QuetzalFormat } from '../../../src/storage/formats/QuetzalFormat';
import { Storage } from '../../../src/storage/Storage';
import { HeaderLocation } from '../../../src/utils/constants';
import { Logger } from '../../../src/utils/log';

// ESM namespace objects are not configurable, so vi.spyOn(fs, ...) cannot work here. Mock the two
// functions src/node.ts uses at the top level (where hoisting is explicit) and keep the rest of fs
// intact. Each test that needs them sets its own implementation via vi.mocked().
vi.mock('fs', async (importActual) => {
  const actual = await importActual<typeof import('fs')>();
  return { ...actual, readFileSync: vi.fn(), appendFileSync: vi.fn() };
});

describe('@random-lunacy/rezrov-zmachine/node', () => {
  describe('memoryFromFile', () => {
    let mockLogger: Logger;

    beforeEach(() => {
      mockLogger = new Logger('TestLogger');
      mockLogger.warn = vi.fn();
      mockLogger.error = vi.fn();
    });

    it('should load a Memory from a story file', () => {
      // Return a buffer with a complete valid header (64 bytes, the v3 minimum)
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        const buffer = Buffer.alloc(64, 0);

        // Set the basic header values needed for validation
        buffer[0] = 3; // Version 3
        buffer.writeUInt16BE(0x0400, HeaderLocation.StaticMemBase); // 0x0e = 0x400
        buffer.writeUInt16BE(0x0800, HeaderLocation.HighMemBase); // 0x04 = 0x800

        return buffer;
      });

      const memory = memoryFromFile('dummy.z3', { logger: mockLogger });

      expect(memory).toBeInstanceOf(Memory);
      expect(memory.version).toBe(3);
    });

    it('should wrap file read errors', () => {
      const mockReadFileSync = vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });

      expect(() => memoryFromFile('nonexistent.z3', { logger: mockLogger })).toThrow(/Failed to load story file/);

      expect(mockReadFileSync).toHaveBeenCalledWith('nonexistent.z3');
    });
  });

  describe('createFileSystemStorage', () => {
    const originalStory = Buffer.from([0x03]); // Mock Z-machine story file (version 3)

    it('should create a Storage with FileSystemProvider and QuetzalFormat by default', () => {
      const storage = createFileSystemStorage(originalStory);

      expect(storage).toBeInstanceOf(Storage);
      expect((storage as any).formatProvider).toBeInstanceOf(QuetzalFormat);
      expect((storage as any).storageProvider).toBeInstanceOf(FileSystemProvider);
      expect((storage as any).originalStory).toBe(originalStory);
    });

    it('should use EnhancedDatFormat when useQuetzal is false', () => {
      const storage = createFileSystemStorage(originalStory, false);

      expect(storage).toBeInstanceOf(Storage);
      expect((storage as any).formatProvider).toBeInstanceOf(EnhancedDatFormat);
      expect((storage as any).storageProvider).toBeInstanceOf(FileSystemProvider);
      expect((storage as any).originalStory).toBe(originalStory);
    });
  });

  describe('setLogToFile', () => {
    const consoleSpy = vi.spyOn(console, 'log');

    beforeEach(() => {
      Logger.setLogToConsole(false);
    });

    afterEach(() => {
      setLogToFile(false);
      Logger.setLogToConsole(true);
      consoleSpy.mockClear();
      vi.mocked(fs.appendFileSync).mockClear();
    });

    it('should append each message to the file, then stop when disabled', () => {
      setLogToFile(true, 'test.log');
      const logger = new Logger('TestLogger');

      logger.info('Test file logging');
      expect(fs.appendFileSync).toHaveBeenCalledWith(
        'test.log',
        expect.stringContaining('Test file logging\n'),
        'utf8'
      );

      vi.mocked(fs.appendFileSync).mockClear();

      setLogToFile(false);
      logger.info('This should not be logged to file');
      expect(fs.appendFileSync).not.toHaveBeenCalled();
    });

    it('should default to log.txt', () => {
      setLogToFile(true);
      new Logger('TestLogger').info('Default path');

      expect(fs.appendFileSync).toHaveBeenCalledWith('log.txt', expect.any(String), 'utf8');
    });

    it('should log to the console as well when both are enabled', () => {
      Logger.setLogToConsole(true);
      setLogToFile(true, 'dual-output.log');

      new Logger('DualLogger').info('Log to both outputs');

      expect(consoleSpy).toHaveBeenCalled();
      expect(fs.appendFileSync).toHaveBeenCalled();
    });
  });
});
