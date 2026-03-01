/**
 * Plays Blorb sound resources using the Web Audio API.
 * Supports OGG Vorbis (OGGV). AIFF requires additional decoding.
 */
import { Logger, ResourceStatus } from 'rezrov-zmachine';

export class SoundPlayer {
  private readonly logger = new Logger('SoundPlayer');
  private readonly audioContext: AudioContext;
  private playingSources: Map<number, AudioBufferSourceNode> = new Map();

  constructor() {
    this.audioContext = new AudioContext();
  }

  playSound(
    resourceId: number,
    data: ArrayBuffer | Buffer,
    format: string,
    volume: number,
    repeats: number
  ): ResourceStatus {
    const arrayBuffer = data instanceof ArrayBuffer ? data : new Uint8Array(data).buffer;

    const fmt = format.trim();
    if (fmt !== 'OGGV' && fmt !== 'OGG') {
      this.logger.debug(`Unsupported sound format: ${fmt}`);
      return ResourceStatus.NotAvailable;
    }

    this.audioContext
      .decodeAudioData(arrayBuffer.slice(0))
      .then((audioBuffer) => {
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.loop = repeats === -1 || repeats > 1;

        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = volume / 255;

        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        source.onended = () => {
          this.playingSources.delete(resourceId);
        };

        this.playingSources.set(resourceId, source);
        source.start(0);
      })
      .catch((error: unknown) => {
        this.logger.warn(`Failed to decode sound resource ${resourceId}: ${error}`);
        this.playingSources.delete(resourceId);
      });

    return ResourceStatus.Available;
  }

  stopSound(resourceId: number): ResourceStatus {
    if (resourceId === 0) {
      for (const source of this.playingSources.values()) {
        try {
          source.stop();
        } catch {
          // Already stopped
        }
      }
      this.playingSources.clear();
      return ResourceStatus.Available;
    }

    const source = this.playingSources.get(resourceId);
    if (source) {
      try {
        source.stop();
      } catch {
        // Already stopped
      }
      this.playingSources.delete(resourceId);
      return ResourceStatus.Available;
    }

    return ResourceStatus.NotAvailable;
  }

  getSoundStatus(resourceId: number): ResourceStatus {
    return this.playingSources.has(resourceId) ? ResourceStatus.Playing : ResourceStatus.Stopped;
  }
}
