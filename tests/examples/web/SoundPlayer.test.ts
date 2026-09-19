// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResourceStatus } from '../../../src/index';
import { SoundPlayer } from '../../../examples/web/src/SoundPlayer';

interface FakeSource {
  buffer: unknown;
  loop: boolean;
  onended: (() => void) | null;
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}

let sources: FakeSource[];
let gain: { gain: { value: number }; connect: ReturnType<typeof vi.fn> };
let decode: ReturnType<typeof vi.fn>;

function makeSource(): FakeSource {
  const source: FakeSource = {
    buffer: null,
    loop: false,
    onended: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  sources.push(source);
  return source;
}

/** Web Audio does not exist in jsdom; stand in a context we can inspect. */
function installAudioContext(): void {
  sources = [];
  gain = { gain: { value: 0 }, connect: vi.fn() };
  decode = vi.fn(async () => ({}) as AudioBuffer);
  vi.stubGlobal(
    'AudioContext',
    class {
      destination = {};
      decodeAudioData = decode;
      createBufferSource = (): FakeSource => makeSource();
      createGain = (): typeof gain => gain;
    }
  );
}

describe('SoundPlayer', () => {
  beforeEach(() => {
    installAudioContext();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('playSound', () => {
    it.each(['OGGV', 'OGG', ' OGGV '])('should report %s as available', (format) => {
      const player = new SoundPlayer();
      expect(player.playSound(1, new ArrayBuffer(8), format, 255, 1)).toBe(ResourceStatus.Available);
    });

    it.each(['AIFF', 'MOD', ''])('should reject unsupported format %s without decoding', (format) => {
      const player = new SoundPlayer();

      expect(player.playSound(1, new ArrayBuffer(8), format, 255, 1)).toBe(ResourceStatus.NotAvailable);
      expect(decode).not.toHaveBeenCalled();
    });

    it('should start the source and scale volume from the 0-255 Z-machine range', async () => {
      const player = new SoundPlayer();

      player.playSound(1, new ArrayBuffer(8), 'OGGV', 128, 1);
      await vi.waitFor(() => expect(sources).toHaveLength(1));

      expect(sources[0].start).toHaveBeenCalledWith(0);
      expect(gain.gain.value).toBeCloseTo(128 / 255);
    });

    it.each([
      [-1, true, 'repeat forever'],
      [2, true, 'repeat a fixed number of times'],
      [1, false, 'play once'],
    ])('should set loop=%s for repeats=%s (%s)', async (repeats, expectedLoop) => {
      const player = new SoundPlayer();

      player.playSound(1, new ArrayBuffer(8), 'OGGV', 255, repeats as number);
      await vi.waitFor(() => expect(sources).toHaveLength(1));

      expect(sources[0].loop).toBe(expectedLoop);
    });

    it('should accept a Node Buffer and pass a copy to the decoder', async () => {
      const player = new SoundPlayer();
      const data = Buffer.from([1, 2, 3, 4]);

      player.playSound(1, data, 'OGGV', 255, 1);

      await vi.waitFor(() => expect(decode).toHaveBeenCalledTimes(1));
    });

    it('should not leave a failed decode registered as playing', async () => {
      decode.mockRejectedValueOnce(new Error('bad vorbis stream'));
      const player = new SoundPlayer();

      player.playSound(5, new ArrayBuffer(8), 'OGGV', 255, 1);

      await vi.waitFor(() => expect(player.getSoundStatus(5)).toBe(ResourceStatus.Stopped));
    });
  });

  describe('getSoundStatus', () => {
    it('should report a playing resource', async () => {
      const player = new SoundPlayer();
      player.playSound(3, new ArrayBuffer(8), 'OGGV', 255, 1);

      await vi.waitFor(() => expect(player.getSoundStatus(3)).toBe(ResourceStatus.Playing));
    });

    it('should report an unknown resource as stopped', () => {
      expect(new SoundPlayer().getSoundStatus(42)).toBe(ResourceStatus.Stopped);
    });

    it('should report a resource as stopped once it ends on its own', async () => {
      const player = new SoundPlayer();
      player.playSound(3, new ArrayBuffer(8), 'OGGV', 255, 1);
      await vi.waitFor(() => expect(sources).toHaveLength(1));

      sources[0].onended?.();

      expect(player.getSoundStatus(3)).toBe(ResourceStatus.Stopped);
    });
  });

  describe('stopSound', () => {
    it('should stop a single playing resource', async () => {
      const player = new SoundPlayer();
      player.playSound(3, new ArrayBuffer(8), 'OGGV', 255, 1);
      await vi.waitFor(() => expect(sources).toHaveLength(1));

      expect(player.stopSound(3)).toBe(ResourceStatus.Available);
      expect(sources[0].stop).toHaveBeenCalled();
      expect(player.getSoundStatus(3)).toBe(ResourceStatus.Stopped);
    });

    it('should report a resource that is not playing as unavailable', () => {
      expect(new SoundPlayer().stopSound(42)).toBe(ResourceStatus.NotAvailable);
    });

    it('should stop every source for resource id 0 (Z-machine "stop all")', async () => {
      const player = new SoundPlayer();
      player.playSound(1, new ArrayBuffer(8), 'OGGV', 255, 1);
      player.playSound(2, new ArrayBuffer(8), 'OGGV', 255, 1);
      await vi.waitFor(() => expect(sources).toHaveLength(2));

      expect(player.stopSound(0)).toBe(ResourceStatus.Available);
      expect(sources[0].stop).toHaveBeenCalled();
      expect(sources[1].stop).toHaveBeenCalled();
      expect(player.getSoundStatus(1)).toBe(ResourceStatus.Stopped);
      expect(player.getSoundStatus(2)).toBe(ResourceStatus.Stopped);
    });

    it('should succeed at "stop all" even with nothing playing', () => {
      expect(new SoundPlayer().stopSound(0)).toBe(ResourceStatus.Available);
    });

    it('should swallow an error from an already-stopped source', async () => {
      const player = new SoundPlayer();
      player.playSound(3, new ArrayBuffer(8), 'OGGV', 255, 1);
      await vi.waitFor(() => expect(sources).toHaveLength(1));
      sources[0].stop.mockImplementation(() => {
        throw new Error('InvalidStateError');
      });

      expect(() => player.stopSound(3)).not.toThrow();
    });
  });
});
