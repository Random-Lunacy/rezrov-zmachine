export interface StorageProvider {
  read(location: string): Promise<Buffer | null>;
  write(location: string, data: Buffer): Promise<void>;
  list(pattern?: string): Promise<string[]>;
  exists(location: string): Promise<boolean>;
  ensureDirectory?(directory: string): Promise<void>;
}
