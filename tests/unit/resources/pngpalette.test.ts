import { describe, expect, it } from 'vitest';
import {
  findPaletteChunk,
  isPng,
  PALETTE_ENTRY_SIZE,
  readPalette,
  replacePalette,
} from '../../../src/resources/PngPalette';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** CRC-32 as PNG defines it, used here to independently verify what the code writes. */
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

/** Build a PNG containing the given palette (and an IDAT, so PLTE is not last). */
function buildPng(palette: number[][] | null): Buffer {
  const parts = [PNG_SIGNATURE, chunk('IHDR', Buffer.alloc(13))];
  if (palette) {
    parts.push(chunk('PLTE', Buffer.from(palette.flat())));
  }
  parts.push(chunk('IDAT', Buffer.from([1, 2, 3])), chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

const SEPIA = [
  [0xee, 0xaa, 0x88],
  [0xcc, 0x88, 0x66],
  [0xaa, 0x66, 0x44],
];
const EGA = [
  [0x00, 0x00, 0xaa],
  [0x00, 0xaa, 0x00],
  [0x00, 0xaa, 0xaa],
];

describe('PngPalette', () => {
  describe('isPng', () => {
    it('should accept a buffer with the PNG signature', () => {
      expect(isPng(buildPng(EGA))).toBe(true);
    });

    it('should reject a buffer without the PNG signature', () => {
      expect(isPng(Buffer.from('JFIF not a png'))).toBe(false);
    });

    it('should reject a buffer shorter than the signature', () => {
      expect(isPng(Buffer.from([0x89, 0x50]))).toBe(false);
    });
  });

  describe('findPaletteChunk', () => {
    it('should locate the PLTE chunk past earlier chunks', () => {
      const png = buildPng(EGA);
      const found = findPaletteChunk(png);

      expect(found).not.toBeNull();
      expect(found!.length).toBe(EGA.length * PALETTE_ENTRY_SIZE);
      // The reported offset must point at the palette data itself, not its header.
      expect(png[found!.dataOffset]).toBe(0x00);
      expect(png[found!.dataOffset + 2]).toBe(0xaa);
    });

    it('should return null for a PNG with no palette', () => {
      expect(findPaletteChunk(buildPng(null))).toBeNull();
    });

    it('should return null for a non-PNG buffer', () => {
      expect(findPaletteChunk(Buffer.from('not a png at all'))).toBeNull();
    });

    it('should return null rather than read past the end of a truncated chunk', () => {
      const png = buildPng(EGA);
      // Claim the PLTE chunk is far longer than the buffer.
      const found = findPaletteChunk(png)!;
      const corrupt = Buffer.from(png);
      corrupt.writeUInt32BE(0xffff, found.dataOffset - 8);

      expect(findPaletteChunk(corrupt)).toBeNull();
    });
  });

  describe('readPalette', () => {
    it('should return the palette entries as RGB triples', () => {
      expect([...readPalette(buildPng(SEPIA))!]).toEqual(SEPIA.flat());
    });

    it('should return null when the PNG has no palette', () => {
      expect(readPalette(buildPng(null))).toBeNull();
    });

    it('should return a copy that survives rewriting the source', () => {
      const png = buildPng(EGA);
      const palette = readPalette(png)!;
      png.fill(0);

      expect([...palette]).toEqual(EGA.flat());
    });
  });

  describe('replacePalette', () => {
    it('should substitute palette entries index-for-index', () => {
      const result = replacePalette(buildPng(EGA), Buffer.from(SEPIA.flat()));

      expect([...readPalette(result)!]).toEqual(SEPIA.flat());
    });

    it('should not modify the source buffer', () => {
      const png = buildPng(EGA);
      replacePalette(png, Buffer.from(SEPIA.flat()));

      expect([...readPalette(png)!]).toEqual(EGA.flat());
    });

    it('should recompute the chunk CRC so the PNG stays valid', () => {
      const result = replacePalette(buildPng(EGA), Buffer.from(SEPIA.flat()));
      const found = findPaletteChunk(result)!;

      const typeAndData = result.subarray(found.dataOffset - 4, found.dataOffset + found.length);
      const storedCrc = result.readUInt32BE(found.dataOffset + found.length);
      expect(storedCrc).toBe(crc32(typeAndData));
    });

    it('should keep entries the replacement palette does not cover', () => {
      // Source has three entries; replacement supplies only the first.
      const result = replacePalette(buildPng(EGA), Buffer.from(SEPIA[0]));

      expect([...readPalette(result)!]).toEqual([...SEPIA[0], ...EGA[1], ...EGA[2]]);
    });

    it('should ignore replacement entries beyond the original palette size', () => {
      // A longer replacement must not grow the chunk, which would shift later chunks.
      const original = buildPng([EGA[0]]);
      const result = replacePalette(original, Buffer.from(SEPIA.flat()));

      expect(result.length).toBe(original.length);
      expect([...readPalette(result)!]).toEqual(SEPIA[0]);
    });

    it('should return the data unchanged when there is no palette to replace', () => {
      const png = buildPng(null);

      expect(replacePalette(png, Buffer.from(SEPIA.flat()))).toBe(png);
    });
  });
});
