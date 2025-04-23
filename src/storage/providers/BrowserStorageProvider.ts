import { StorageProvider } from './StorageProvider';

export class BrowserStorageProvider implements StorageProvider {
  read(location: string): Promise<Buffer | null> {
    throw new Error('Method not implemented.');
  }
  write(location: string, data: Buffer): Promise<void> {
    throw new Error('Method not implemented.');
  }
  list(pattern?: string): Promise<string[]> {
    throw new Error('Method not implemented.');
  }
  exists(location: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  ensureDirectory?(directory: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
