import * as fs from 'fs/promises';
import { glob } from 'glob';
import * as path from 'path';
import { StorageStats } from '../interfaces';
import { StorageProvider } from './StorageProvider';

export class FileSystemProvider implements StorageProvider {
  async read(location: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(location);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null; // File does not exist
      }
      if ((error as NodeJS.ErrnoException).code === 'EACCES') {
        throw new Error(`Permission denied: ${location}`);
      }
    }
    return null; // Other errors
  }

  async write(location: string, data: Buffer): Promise<void> {
    await fs.writeFile(location, data);
  }

  async list(directory: string, pattern?: string): Promise<string[]> {
    if (pattern) {
      return glob(path.join(directory, pattern));
    } else {
      const files = await fs.readdir(directory);
      return files.filter((file) => !file.startsWith('.'));
    }
  }

  async delete(location: string): Promise<boolean> {
    try {
      await fs.unlink(location);
      return true;
    } catch {
      return false;
    }
  }

  async exists(location: string): Promise<boolean> {
    try {
      await fs.access(location);
      return true;
    } catch {
      return false;
    }
  }

  async ensureDirectory(directory: string): Promise<void> {
    try {
      const stats = await fs.stat(directory);
      if (!stats.isDirectory()) {
        throw new Error(`A file with the same name as the directory '${directory}' already exists.`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Directory does not exist, attempt to create it
        try {
          await fs.mkdir(directory, { recursive: true });
        } catch (mkdirError) {
          throw new Error(`Failed to create directory '${directory}': ${(mkdirError as Error).message}`);
        }
      } else {
        throw new Error(`Failed to check directory '${directory}': ${(error as Error).message}`);
      }
    }
  }

  async getStats(location: string): Promise<StorageStats | null> {
    try {
      const stats = await fs.stat(location);
      return {
        size: stats.size,
        lastModified: stats.mtime,
        created: stats.birthtime,
      };
    } catch {
      return null;
    }
  }
}
