import { Snapshot } from '../interfaces';
import { FormatProvider } from './FormatProvider';

export class SimpleDatFormat implements FormatProvider {
  serialize(snapshot: Snapshot, originalStory?: Buffer): Buffer {
    throw new Error('Method not implemented.');
  }
  deserialize(data: Buffer, originalStory?: Buffer): Snapshot {
    throw new Error('Method not implemented.');
  }
  extractMetadata?(data: Buffer): {
    description?: string;
    [key: string]: string | number | boolean | null | undefined;
  } {
    throw new Error('Method not implemented.');
  }
}
