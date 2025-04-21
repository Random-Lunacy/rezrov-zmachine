import { Logger } from '../../utils/log';
import { QuetzalFormat } from '../formats/QuetzalFormat';
import { SaveInfo, Snapshot, Storage, StorageOptions, StorageProvider } from '../interfaces';
import { NodeFsProvider } from './NodeFsProvider';

/**
 * Storage implementation that uses the Quetzal format for
 * saving and loading game state.
 */
export class QuetzalStorage extends NodeFsProvider implements Storage {
  private logger: Logger;
  private quetzalFormat: QuetzalFormat;
  private originalStoryData: Buffer;
  private provider: StorageProvider;
  private savePath: string;
  private saveFilename: string;
  private lastSaveData: Buffer | null = null;
  private saveDescription: string = '';

  /**
   * Create a new QuetzalStorage instance
   *
   * @param originalStoryData The original story file buffer
   * @param provider The storage provider to use
   * @param savePath Directory where saves will be stored
   * @param saveFilename Filename for the save file
   * @param options Additional options
   */
  constructor(
    originalStoryData: Buffer,
    provider?: StorageProvider,
    savePath: string = '.',
    saveFilename: string = 'save.qzl',
    options?: { logger?: Logger }
  ) {
    super();
    this.logger = options?.logger || new Logger('QuetzalStorage');
    this.quetzalFormat = new QuetzalFormat(options);
    this.originalStoryData = originalStoryData;
    this.provider = provider || new NodeFsProvider();
    this.savePath = savePath;
    this.saveFilename = saveFilename;
  }

  /**
   * Save a game snapshot in Quetzal format
   *
   * @param snapshot The game state to save
   * @param description Optional description of the save
   */
  async saveSnapshot(snapshot: Snapshot, description?: string): Promise<void> {
    this.logger.debug(`Saving snapshot to ${this.savePath}/${this.saveFilename}`);

    try {
      if (description) {
        this.saveDescription = description;
      }

      // Create Quetzal format data
      const quetzalData = this.quetzalFormat.createQuetzalFile(
        snapshot,
        true,
        this.originalStoryData,
        this.saveDescription
      );

      // Ensure the save directory exists
      await this.provider.ensureDirectory(this.savePath);

      // Write the file using the provider
      await this.provider.write(`${this.savePath}/${this.saveFilename}`, quetzalData);

      // Keep a copy in memory for faster access
      this.lastSaveData = quetzalData;

      this.logger.info(`Saved game to ${this.savePath}/${this.saveFilename}`);
    } catch (error) {
      this.logger.error(`Failed to save snapshot: ${error}`);
      throw error;
    }
  }

  /**
   * Load a game snapshot in Quetzal format
   *
   * @returns The loaded game state
   */
  async loadSnapshot(): Promise<Snapshot> {
    this.logger.debug(`Loading snapshot from ${this.savePath}/${this.saveFilename}`);

    try {
      // Try to load from provider first
      let quetzalData: Buffer;
      const fullPath = `${this.savePath}/${this.saveFilename}`;

      if (await this.provider.exists(fullPath)) {
        const data = await this.provider.read(fullPath);
        if (!data) {
          throw new Error(`Could not read save file: ${fullPath}`);
        }
        quetzalData = data;
      } else if (this.lastSaveData) {
        // Fall back to in-memory save
        this.logger.debug('Using in-memory save data');
        quetzalData = this.lastSaveData;
      } else {
        throw new Error(`Save file not found: ${fullPath}`);
      }

      // Parse the Quetzal file
      const snapshot = this.quetzalFormat.parseQuetzalFile(quetzalData, this.originalStoryData);

      this.logger.info(`Loaded game from ${this.savePath}/${this.saveFilename}`);
      return snapshot;
    } catch (error) {
      this.logger.error(`Failed to load snapshot: ${error}`);
      throw error;
    }
  }

  /**
   * Set the filename for saves
   *
   * @param filename The new filename to use
   */
  setFilename(filename: string): void {
    this.saveFilename = filename;
  }

  /**
   * Set the directory where saves are stored
   *
   * @param path The new save directory
   */
  setSavePath(path: string): void {
    this.savePath = path;
  }

  /**
   * Get information about the current save file
   *
   * @returns Save file information
   */
  async getSaveInfo(): Promise<SaveInfo> {
    const fullPath = `${this.savePath}/${this.saveFilename}`;
    const exists = (await this.provider.exists(fullPath)) || this.lastSaveData !== null;

    const info: SaveInfo = {
      exists,
      path: fullPath,
      format: 'quetzal',
      description: this.saveDescription,
    };

    if (exists && (await this.provider.exists(fullPath))) {
      const stats = await this.getStats(fullPath);
      if (stats?.lastModified) {
        info.lastModified = stats.lastModified;
      }
    }

    return info;
  }

  /**
   * List all available saves in the save directory
   *
   * @returns Array of save information objects
   */
  async listSaves(): Promise<SaveInfo[]> {
    try {
      const files = await this.provider.list(`${this.savePath}/*.qzl`);
      const saveInfos: SaveInfo[] = [];

      for (const file of files) {
        const data = await this.provider.read(`${this.savePath}/${file}`);
        if (data) {
          try {
            // Try to extract metadata from the Quetzal file
            const metadata = this.quetzalFormat.extractMetadata(data);
            const stats = await this.getStats(`${this.savePath}/${file}`);

            saveInfos.push({
              exists: true,
              path: `${this.savePath}/${file}`,
              format: 'quetzal',
              description: metadata.description || '',
              lastModified: stats?.lastModified,
            });
          } catch (e) {
            // If metadata extraction fails, still list the file
            this.logger.warn(`Failed to extract metadata from ${file}: ${e}`);
            saveInfos.push({
              exists: true,
              path: `${this.savePath}/${file}`,
              format: 'quetzal',
            });
          }
        }
      }

      return saveInfos;
    } catch (error) {
      this.logger.error(`Error listing saves: ${error}`);
      return [];
    }
  }

  /**
   * Set options for the storage
   *
   * @param options Storage options
   */
  setOptions(options: StorageOptions): void {
    if (options.savePath) {
      this.savePath = options.savePath;
    }
    if (options.filename) {
      this.saveFilename = options.filename;
    }
    if (options.description) {
      this.saveDescription = options.description;
    }
    // Additional options could be handled here
  }

  /**
   * Set the storage provider
   *
   * @param provider The new storage provider
   */
  setProvider(provider: StorageProvider): void {
    this.provider = provider;
  }
}
