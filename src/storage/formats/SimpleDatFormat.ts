import { Snapshot } from '../interfaces';
import { FormatProvider } from './FormatProvider';

export class SimpleDatFormat implements FormatProvider {
  serialize(snapshot: Snapshot, originalStory?: Buffer): Buffer {
    // Convert the Snapshot object into a Buffer (DAT format)
    const snapshotData = JSON.stringify(snapshot); // Serialize snapshot to JSON
    const buffer = Buffer.from(snapshotData, 'utf-8'); // Convert JSON string to Buffer
    return buffer;
  }

  deserialize(data: Buffer, originalStory?: Buffer): Snapshot {
    // Convert the Buffer (DAT format) back into a Snapshot object
    const snapshotData = data.toString('utf-8'); // Convert Buffer to JSON string
    const snapshot: Snapshot = JSON.parse(snapshotData); // Parse JSON string to Snapshot
    return snapshot;
  }

  extractMetadata?(data: Buffer): {
    description?: string;
    [key: string]: string | number | boolean | null | undefined;
  } {
    // No metadata extraction for SimpleDatFormat
    return {};
  }
}
