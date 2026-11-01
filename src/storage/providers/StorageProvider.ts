export interface StorageProvider {
  read(location: string): Promise<Uint8Array | null>;
  write(location: string, data: Uint8Array): Promise<void>;
  list(pattern?: string): Promise<string[]>;
  exists(location: string): Promise<boolean>;
  ensureDirectory?(directory: string): Promise<void>;
}
