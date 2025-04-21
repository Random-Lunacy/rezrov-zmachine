import { Snapshot } from '../interfaces';

export interface FormatProvider {
  serialize(snapshot: Snapshot, originalStory?: Buffer): Buffer;
  deserialize(data: Buffer, originalStory?: Buffer): Snapshot;
  extractMetadata?(data: Buffer): { description?: string; [key: string]: string | number | boolean | null | undefined };
}
