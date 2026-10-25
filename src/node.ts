/**
 * Node.js-only entry point for the rezrov-zmachine library (`rezrov-zmachine/node`).
 *
 * The main entry has no Node dependencies, so it can be bundled for the browser. Everything that
 * needs the file system lives here instead.
 */
import { appendFileSync, readFileSync } from 'fs';
import { Memory } from './core/memory/Memory';
import { EnhancedDatFormat } from './storage/formats/EnhancedDatFormat';
import { QuetzalFormat } from './storage/formats/QuetzalFormat';
import { StorageInterface } from './storage/interfaces';
import { FileSystemProvider } from './storage/providers/FileSystemProvider';
import { Storage } from './storage/Storage';
import { Logger } from './utils/log';

export { FileSystemProvider } from './storage/providers/FileSystemProvider';

/**
 * Creates a Memory from a story file on disk.
 * @param filePath Path to the story file
 * @param options Passed through to the Memory constructor
 */
export function memoryFromFile(filePath: string, options?: { logger?: Logger }): Memory {
  try {
    const buffer = readFileSync(filePath);
    return new Memory(buffer, options);
  } catch (e) {
    const logger = options?.logger || new Logger('memoryFromFile');
    logger.error(`Failed to load story file: ${e}`);
    throw new Error(`Failed to load story file: ${e}`, { cause: e });
  }
}

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
 * Set whether log messages are also appended to a file.
 * @param toFile Whether to enable file logging
 * @param filePath File to append to (default 'log.txt')
 */
export function setLogToFile(toFile: boolean, filePath: string = 'log.txt'): void {
  Logger.setLogSink(toFile ? (formattedMsg) => appendFileSync(filePath, formattedMsg + '\n', 'utf8') : null);
}
