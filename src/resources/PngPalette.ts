/**
 * PNG palette (PLTE chunk) inspection and substitution.
 *
 * Blorb's adaptive-palette mechanism (the 'APal' chunk) says that certain
 * pictures carry no meaningful palette of their own: their pixel indices refer
 * to the "current palette", established by the last non-adaptive picture drawn.
 * See https://www.eblong.com/zarf/blorb/blorb.html
 *
 * Browsers and image decoders have no notion of this — they decode a PNG with
 * whatever PLTE it happens to contain. Rather than decode and re-encode the
 * image, these helpers rewrite the PLTE chunk in place, which is cheap and
 * leaves every other chunk (and the compressed pixel data) untouched.
 */

/** PNG signature: the 8 bytes every PNG file starts with. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Bytes per palette entry in a PLTE chunk (R, G, B). */
export const PALETTE_ENTRY_SIZE = 3;

let crcTable: Uint32Array | null = null;

/** Build the standard PNG CRC-32 lookup table (reflected polynomial 0xEDB88320). */
function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  crcTable = table;
  return table;
}

/**
 * CRC-32 over a byte range, as PNG defines it: computed across the chunk's
 * type field and data, seeded with all ones and finally inverted.
 */
function crc32(data: Buffer, start: number, end: number): number {
  const table = getCrcTable();
  let c = 0xffffffff;
  for (let i = start; i < end; i++) {
    c = table[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/** True if the buffer starts with the PNG signature. */
export function isPng(data: Buffer): boolean {
  if (data.length < PNG_SIGNATURE.length) return false;
  return PNG_SIGNATURE.every((byte, i) => data[i] === byte);
}

/**
 * Locate the PLTE chunk. Returns the offset of its DATA (not its length field)
 * and the data length, or null when the PNG is malformed or has no palette
 * (truecolor and greyscale PNGs legitimately have none).
 */
export function findPaletteChunk(data: Buffer): { dataOffset: number; length: number } | null {
  if (!isPng(data)) return null;

  // Walk the chunk list: each chunk is [length:4][type:4][data:length][crc:4].
  let offset = PNG_SIGNATURE.length;
  while (offset + 8 <= data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.toString('ascii', offset + 4, offset + 8);
    const dataOffset = offset + 8;

    // A truncated chunk means a corrupt file; stop rather than read past the end.
    if (dataOffset + length + 4 > data.length) return null;
    if (type === 'PLTE') return { dataOffset, length };
    if (type === 'IEND') return null;

    offset = dataOffset + length + 4;
  }
  return null;
}

/**
 * Read a PNG's palette as raw RGB triples, or null if it has no PLTE chunk.
 * The returned buffer is a copy, so it stays valid if the source is rewritten.
 */
export function readPalette(data: Buffer): Buffer | null {
  const chunk = findPaletteChunk(data);
  if (!chunk) return null;
  return Buffer.from(data.subarray(chunk.dataOffset, chunk.dataOffset + chunk.length));
}

/**
 * Return a copy of `data` whose palette entries have been replaced by those in
 * `palette`, leaving every other chunk untouched.
 *
 * The chunk's size is preserved: entries are copied index-for-index and any the
 * replacement palette does not cover keep their original colors. Blorb's
 * adaptive palettes address the current palette by index, so index-for-index is
 * exactly the required mapping, and keeping the size means no other chunk
 * offsets shift.
 *
 * Returns `data` unchanged when it has no palette to replace.
 */
export function replacePalette(data: Buffer, palette: Buffer): Buffer {
  const chunk = findPaletteChunk(data);
  if (!chunk) return data;

  const result = Buffer.from(data);
  const entries = Math.min(
    Math.floor(chunk.length / PALETTE_ENTRY_SIZE),
    Math.floor(palette.length / PALETTE_ENTRY_SIZE)
  );
  palette.copy(result, chunk.dataOffset, 0, entries * PALETTE_ENTRY_SIZE);

  // The CRC covers the chunk's type and data, so it must be recomputed.
  const crcStart = chunk.dataOffset - 4;
  const crcEnd = chunk.dataOffset + chunk.length;
  result.writeUInt32BE(crc32(result, crcStart, crcEnd), crcEnd);

  return result;
}
