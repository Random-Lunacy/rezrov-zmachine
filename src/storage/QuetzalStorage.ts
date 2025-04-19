import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/log';
import { Snapshot, Storage } from './interfaces';
import { QuetzalFormat } from './QuetzalFormat';

/**
 * Storage implementation that uses the Quetzal format
 */
export class QuetzalStorage implements Storage {
  private logger: Logger;
  private quetzalFormat: QuetzalFormat;
  private originalStoryData: Buffer;
  private savePath: string;
  private saveFilename: string;
  private lastSaveData: Buffer | null = null;

  /**
   * Create a new QuetzalStorage
   *
   * @param logger The logger to use
   * @param originalStoryData The original story data (for compression)
   * @param savePath The directory to save files to (defaults to current directory)
   * @param saveFilename The filename to save to (defaults to "save.qzl")
   */
  constructor(
    originalStoryData: Buffer,
    savePath: string = '.',
    saveFilename: string = 'save.qzl',
    options?: { logger?: Logger }
  ) {
    this.logger = options?.logger || new Logger('QuetzalStorage');
    this.quetzalFormat = new QuetzalFormat(options);
    this.originalStoryData = originalStoryData;
    this.savePath = savePath;
    this.saveFilename = saveFilename;
  }

  /**
   * Save a snapshot to a Quetzal file
   * @param snapshot The snapshot to save
   */
  saveSnapshot(snapshot: Snapshot): void {
    this.logger.debug(`Saving snapshot to ${this.savePath}/${this.saveFilename}`);

    try {
      // Create Quetzal file
      const quetzalData = this.quetzalFormat.createQuetzalFile(
        snapshot,
        true, // Use compression
        this.originalStoryData
      );

      // Make sure directory exists
      if (!fs.existsSync(this.savePath)) {
        fs.mkdirSync(this.savePath, { recursive: true });
      }

      // Save to file
      fs.writeFileSync(path.join(this.savePath, this.saveFilename), quetzalData);

      // Keep a copy for loadSnapshot
      this.lastSaveData = quetzalData;

      this.logger.info(`Saved game to ${this.savePath}/${this.saveFilename}`);
    } catch (error) {
      this.logger.error(`Failed to save snapshot: ${error}`);
      throw error;
    }
  }

  /**
   * Load a snapshot from a Quetzal file
   * @returns The loaded snapshot
   */
  loadSnapshot(): Snapshot {
    this.logger.debug(`Loading snapshot from ${this.savePath}/${this.saveFilename}`);

    try {
      // If we have lastSaveData and were asked to load the same file,
      // we can just use that instead of reading from disk
      let quetzalData: Buffer;
      const fullPath = path.join(this.savePath, this.saveFilename);

      if (fs.existsSync(fullPath)) {
        quetzalData = fs.readFileSync(fullPath);
      } else if (this.lastSaveData) {
        this.logger.debug('Using in-memory save data');
        quetzalData = this.lastSaveData;
      } else {
        throw new Error(`Save file not found: ${fullPath}`);
      }

      // Parse Quetzal file
      const snapshot = this.quetzalFormat.parseQuetzalFile(quetzalData, this.originalStoryData);

      this.logger.info(`Loaded game from ${this.savePath}/${this.saveFilename}`);
      return snapshot;
    } catch (error) {
      this.logger.error(`Failed to load snapshot: ${error}`);
      throw error;
    }
  }

  /**
   * Set the save filename
   * @param filename The new filename
   */
  setFilename(filename: string): void {
    this.saveFilename = filename;
  }

  /**
   * Set the save path
   * @param path The new path
   */
  setSavePath(path: string): void {
    this.savePath = path;
  }

  /**
   * Get information about the save file
   * @returns Object containing save info or null if no save exists
   */
  getSaveInfo(): { exists: boolean; path: string; lastModified?: Date } {
    const fullPath = path.join(this.savePath, this.saveFilename);

    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      return {
        exists: true,
        path: fullPath,
        lastModified: stats.mtime,
      };
    } else if (this.lastSaveData) {
      return {
        exists: true,
        path: fullPath,
      };
    } else {
      return {
        exists: false,
        path: fullPath,
      };
    }
  }
}
