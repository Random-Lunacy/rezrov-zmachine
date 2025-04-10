import { Storage, Snapshot } from '../../src/storage/interfaces';

export class TestStorage implements Storage {
  private snapshot: Snapshot | null = null;

  saveSnapshot(snapshot: Snapshot): void {
    this.snapshot = snapshot;
  }

  loadSnapshot(): Snapshot {
    if (!this.snapshot) {
      throw new Error('No snapshot available');
    }
    return this.snapshot;
  }
}
