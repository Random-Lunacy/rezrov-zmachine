import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BlorbMap } from '../../../../src/resources/BlorbData';
import { BlorbParser } from '../../../../src/resources/BlorbParser';
import { readPalette } from '../../../../src/resources/PngPalette';
import { BlorbMultimediaHandler } from '../../../../src/ui/multimedia/BlorbMultimediaHandler';
import { ResourceStatus, ResourceType } from '../../../../src/ui/multimedia/MultimediaHandler';
import { Logger } from '../../../../src/utils/log';

/**
 * Build a minimal valid JPEG buffer with SOF0 marker containing given dimensions.
 * Structure: SOI + APP0 (empty) + SOF0 (with width/height) + EOI
 */
function createJpegBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(20);
  let offset = 0;

  // SOI marker
  buf[offset++] = 0xff;
  buf[offset++] = 0xd8;

  // APP0 marker with minimal length
  buf[offset++] = 0xff;
  buf[offset++] = 0xe0;
  buf.writeUInt16BE(2, offset); // segment length (just the length field itself)
  offset += 2;

  // SOF0 marker (baseline DCT)
  buf[offset++] = 0xff;
  buf[offset++] = 0xc0;
  buf.writeUInt16BE(11, offset); // segment length
  offset += 2;
  buf[offset++] = 8; // precision
  buf.writeUInt16BE(height, offset);
  offset += 2;
  buf.writeUInt16BE(width, offset);
  offset += 2;

  return buf.subarray(0, offset);
}

/**
 * Build a minimal valid PNG buffer with IHDR chunk containing given dimensions.
 * Structure: PNG signature + IHDR chunk
 */
function createPngBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(33);
  let offset = 0;

  // PNG signature
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (const byte of signature) {
    buf[offset++] = byte;
  }

  // IHDR chunk: length (4) + 'IHDR' (4) + width (4) + height (4) + bit depth (1) + color type (1) + ...
  buf.writeUInt32BE(13, offset); // IHDR data length
  offset += 4;
  buf.write('IHDR', offset, 'ascii');
  offset += 4;
  buf.writeUInt32BE(width, offset);
  offset += 4;
  buf.writeUInt32BE(height, offset);
  offset += 4;

  return buf.subarray(0, offset);
}

/**
 * Build a Blorb 'Rect' placeholder chunk: 4-byte width + 4-byte height, big-endian.
 * Per the Blorb spec, this describes the legacy picture behavior of some V6
 * Infocom games (Zork Zero, Shogun, Arthur) — a declared size with no pixel data.
 */
function createRectBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(width, 0);
  buf.writeUInt32BE(height, 4);
  return buf;
}

/**
 * Build a minimal Blorb container with given picture resources.
 * Each picture is stored as a raw chunk (JPEG, PNG, or Rect) with an RIdx entry.
 */
function createBlorbWithPictures(
  pictures: Array<{ id: number; data: Buffer; type: 'JPEG' | 'PNG ' | 'Rect' }>
): Buffer {
  // Calculate sizes
  const ridxDataSize = 4 + pictures.length * 12; // count + entries
  const ridxChunkSize = 8 + ridxDataSize; // type + length + data

  let totalChunksSize = ridxChunkSize;
  const chunkOffsets: number[] = [];

  for (const pic of pictures) {
    // Pad to word boundary
    if (totalChunksSize & 1) totalChunksSize++;
    chunkOffsets.push(12 + totalChunksSize); // 12 = FORM header
    totalChunksSize += 8 + pic.data.length; // type + length + data
  }

  const formDataSize = 4 + totalChunksSize; // 'IFRS' + chunks
  const totalSize = 8 + formDataSize; // 'FORM' + length + data
  const buf = Buffer.alloc(totalSize + 1); // +1 for potential padding
  let offset = 0;

  // FORM header
  buf.write('FORM', offset, 'ascii');
  offset += 4;
  buf.writeUInt32BE(formDataSize, offset);
  offset += 4;
  buf.write('IFRS', offset, 'ascii');
  offset += 4;

  // RIdx chunk
  buf.write('RIdx', offset, 'ascii');
  offset += 4;
  buf.writeUInt32BE(ridxDataSize, offset);
  offset += 4;
  buf.writeUInt32BE(pictures.length, offset);
  offset += 4;

  for (let i = 0; i < pictures.length; i++) {
    buf.write('Pict', offset, 'ascii');
    offset += 4;
    buf.writeUInt32BE(pictures[i].id, offset);
    offset += 4;
    buf.writeUInt32BE(chunkOffsets[i], offset);
    offset += 4;
  }

  // Picture chunks
  for (const pic of pictures) {
    if (offset & 1) offset++; // word-align
    buf.write(pic.type, offset, 'ascii');
    offset += 4;
    buf.writeUInt32BE(pic.data.length, offset);
    offset += 4;
    pic.data.copy(buf, offset);
    offset += pic.data.length;
  }

  return buf.subarray(0, totalSize);
}

/** CRC-32 as PNG defines it, for building palette chunks the parser will accept. */
function pngCrc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(pngCrc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

/** A PNG carrying the given palette, for adaptive-palette tests. */
function createPalettedPng(palette: number[][]): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(8, 0);
  ihdr.writeUInt32BE(8, 4);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('PLTE', Buffer.from(palette.flat())),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Append an 'APal' chunk (a flat list of big-endian picture numbers) to a Blorb
 * built by createBlorbWithPictures. Safe to append: the RIdx offsets were fixed
 * when the picture chunks were laid out, so adding a chunk at the end cannot
 * disturb them.
 */
function withAdaptivePalettes(blorb: Buffer, ids: number[]): Buffer {
  const apalData = Buffer.alloc(ids.length * 4);
  ids.forEach((id, i) => apalData.writeUInt32BE(id, i * 4));

  const header = Buffer.alloc(8);
  header.write('APal', 0, 'ascii');
  header.writeUInt32BE(apalData.length, 4);

  const result = Buffer.concat([blorb, header, apalData]);
  // Grow the FORM length to cover the appended chunk, or the scan will stop short.
  result.writeUInt32BE(result.length - 8, 4);
  return result;
}

describe('BlorbMultimediaHandler', () => {
  let handler: BlorbMultimediaHandler;
  let blorbMap: BlorbMap;
  let blorbData: Buffer;
  let mockLogger: Logger;

  const jpegData = createJpegBuffer(320, 200);
  const pngData = createPngBuffer(640, 480);

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as Logger;

    blorbData = createBlorbWithPictures([
      { id: 1, data: jpegData, type: 'JPEG' },
      { id: 2, data: pngData, type: 'PNG ' },
    ]);

    blorbMap = BlorbParser.parse(blorbData);
    handler = new BlorbMultimediaHandler(blorbMap, blorbData, { logger: mockLogger });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should create with default logger if none provided', () => {
      const h = new BlorbMultimediaHandler(blorbMap, blorbData);
      expect(h).toBeDefined();
    });

    it('should expose blorbMap', () => {
      expect(handler.blorbMap).toBe(blorbMap);
    });
  });

  describe('isResourceAvailable', () => {
    it('should return true for existing picture', () => {
      expect(handler.isResourceAvailable(ResourceType.Picture, 1)).toBe(true);
    });

    it('should return false for non-existent picture', () => {
      expect(handler.isResourceAvailable(ResourceType.Picture, 99)).toBe(false);
    });

    it('should return false for unsupported resource type', () => {
      expect(handler.isResourceAvailable(ResourceType.Music, 1)).toBe(false);
    });
  });

  describe('loadResource', () => {
    it('should return Loaded for available resource', async () => {
      const status = await handler.loadResource(ResourceType.Picture, 1);
      expect(status).toBe(ResourceStatus.Loaded);
    });

    it('should return NotAvailable for missing resource', async () => {
      const status = await handler.loadResource(ResourceType.Picture, 99);
      expect(status).toBe(ResourceStatus.NotAvailable);
    });
  });

  describe('unloadResource', () => {
    it('should return Available', async () => {
      const status = await handler.unloadResource(ResourceType.Picture, 1);
      expect(status).toBe(ResourceStatus.Available);
    });
  });

  describe('getResourceInfo', () => {
    it('should return info for available picture', () => {
      const info = handler.getResourceInfo(ResourceType.Picture, 1);
      expect(info).not.toBeNull();
      expect(info!.format).toBe('JPEG');
      expect(info!.size).toBe(jpegData.length);
    });

    it('should return null for missing resource', () => {
      expect(handler.getResourceInfo(ResourceType.Picture, 99)).toBeNull();
    });

    it('should return null for unsupported type', () => {
      expect(handler.getResourceInfo(ResourceType.Music, 1)).toBeNull();
    });
  });

  describe('preloadResources', () => {
    it('should return statuses for mixed resources', async () => {
      const result = await handler.preloadResources([
        { type: ResourceType.Picture, id: 1 },
        { type: ResourceType.Picture, id: 99 },
        { type: ResourceType.Picture, id: 2 },
      ]);
      expect(result).toEqual([ResourceStatus.Loaded, ResourceStatus.NotAvailable, ResourceStatus.Loaded]);
    });
  });

  describe('getPictureData', () => {
    it('should extract JPEG dimensions', () => {
      const data = handler.getPictureData(1);
      expect(data).not.toBeNull();
      expect(data!.width).toBe(320);
      expect(data!.height).toBe(200);
      expect(data!.format).toBe('JPEG');
      expect(data!.hasTransparency).toBe(false);
    });

    it('should extract PNG dimensions', () => {
      const data = handler.getPictureData(2);
      expect(data).not.toBeNull();
      expect(data!.width).toBe(640);
      expect(data!.height).toBe(480);
      expect(data!.format).toBe('PNG');
      expect(data!.hasTransparency).toBe(true);
    });

    it('should return null for non-existent picture', () => {
      expect(handler.getPictureData(99)).toBeNull();
    });

    it('should cache results', () => {
      const first = handler.getPictureData(1);
      const second = handler.getPictureData(1);
      expect(first).toBe(second);
    });
  });

  describe('displayPicture', () => {
    it('should return Available for existing picture', () => {
      const status = handler.displayPicture(1, 10, 20, 100, 0);
      expect(status).toBe(ResourceStatus.Available);
    });

    it('should return NotAvailable for missing picture', () => {
      const status = handler.displayPicture(99, 10, 20, 100, 0);
      expect(status).toBe(ResourceStatus.NotAvailable);
    });

    it('should forward the target window to the pictureRenderer callback', () => {
      const rendererSpy = vi.fn();
      const h = new BlorbMultimediaHandler(blorbMap, blorbData, { logger: mockLogger, pictureRenderer: rendererSpy });

      h.displayPicture(1, 10, 20, 100, 3);

      expect(rendererSpy).toHaveBeenCalledWith(1, jpegData, 'JPEG', 10, 20, 100, 3);
    });
  });

  describe('erasePicture', () => {
    it('should return Available for existing picture', () => {
      expect(handler.erasePicture(1)).toBe(ResourceStatus.Available);
    });

    it('should return NotAvailable for missing picture', () => {
      expect(handler.erasePicture(99)).toBe(ResourceStatus.NotAvailable);
    });
  });

  describe('JPEG dimension parsing edge cases', () => {
    it('should handle progressive JPEG (SOF2 marker)', () => {
      // Build JPEG with SOF2 (0xC2) instead of SOF0 (0xC0)
      const buf = Buffer.alloc(14);
      buf[0] = 0xff;
      buf[1] = 0xd8; // SOI
      buf[2] = 0xff;
      buf[3] = 0xc2; // SOF2 (progressive)
      buf.writeUInt16BE(11, 4); // segment length
      buf[6] = 8; // precision
      buf.writeUInt16BE(100, 7); // height
      buf.writeUInt16BE(200, 9); // width

      const blorb = createBlorbWithPictures([{ id: 1, data: buf, type: 'JPEG' }]);
      const map = BlorbParser.parse(blorb);
      const h = new BlorbMultimediaHandler(map, blorb, { logger: mockLogger });

      const data = h.getPictureData(1);
      expect(data).not.toBeNull();
      expect(data!.width).toBe(200);
      expect(data!.height).toBe(100);
    });

    it('should return null for truncated JPEG', () => {
      const buf = Buffer.from([0xff, 0xd8]); // Just SOI, no SOF

      const blorb = createBlorbWithPictures([{ id: 1, data: buf, type: 'JPEG' }]);
      const map = BlorbParser.parse(blorb);
      const h = new BlorbMultimediaHandler(map, blorb, { logger: mockLogger });

      expect(h.getPictureData(1)).toBeNull();
    });
  });

  describe('PNG dimension parsing edge cases', () => {
    it('should return null for truncated PNG', () => {
      // Valid PNG signature but no IHDR data
      const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

      const blorb = createBlorbWithPictures([{ id: 1, data: buf, type: 'PNG ' }]);
      const map = BlorbParser.parse(blorb);
      const h = new BlorbMultimediaHandler(map, blorb, { logger: mockLogger });

      expect(h.getPictureData(1)).toBeNull();
    });
  });

  describe('unsupported chunk types', () => {
    it('should return null for unknown picture format', () => {
      // Create a blorb manually with a non-JPEG/PNG chunk type
      // Use the existing blorb but spy on BlorbParser to return a weird type
      vi.spyOn(BlorbParser, 'getResource').mockReturnValue(Buffer.from([1, 2, 3]));
      vi.spyOn(BlorbParser, 'getResourceChunkType').mockReturnValue('TIFF');

      const data = handler.getPictureData(42);
      expect(data).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('unsupported chunk type'));
    });
  });

  /**
   * Per the Blorb spec, 'Rect' is a placeholder picture resource (declared size,
   * no pixel data) "to describe the legacy behavior of some V6 Infocom games
   * (Zork Zero, Shogun, and Arthur)". Zork Zero's own bytecode calls picture_data
   * on Rect-typed resources and uses the returned width/height for layout
   * (e.g. computing move_window's target position) — if picture_data fails for
   * them, the game's own lookup table keeps whatever stale bytes were there
   * before, corrupting later window placement.
   */
  describe('Rect placeholder pictures', () => {
    it('should report the declared width/height instead of treating it as unsupported', () => {
      const rectData = createRectBuffer(45, 40);
      const blorb = createBlorbWithPictures([{ id: 387, data: rectData, type: 'Rect' }]);
      const map = BlorbParser.parse(blorb);
      const h = new BlorbMultimediaHandler(map, blorb, { logger: mockLogger });

      const data = h.getPictureData(387);

      expect(data).toEqual({ width: 45, height: 40, format: 'Rect', hasTransparency: false });
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('sound methods delegate to base', () => {
    it('should return NotAvailable for playSound', () => {
      expect(handler.playSound(1, 2, 128, 1)).toBe(ResourceStatus.NotAvailable);
    });

    it('should return NotAvailable for stopSound', () => {
      expect(handler.stopSound(1)).toBe(ResourceStatus.NotAvailable);
    });
  });

  /**
   * Blorb adaptive palettes: pictures listed in 'APal' carry a placeholder palette
   * and must be recolored with the palette of the last non-adaptive picture drawn.
   * Zork Zero relies on this for its compass overlays, which ship with a stock EGA
   * ramp and are meant to match the sepia artwork they sit on.
   */
  describe('adaptive palettes', () => {
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

    /** Palette each picture was rendered with, in call order. */
    function renderWith(adaptiveIds: number[]): {
      render: (id: number) => void;
      palettes: Array<{ id: number; palette: number[] }>;
    } {
      const blorb = withAdaptivePalettes(
        createBlorbWithPictures([
          { id: 1, data: createPalettedPng(SEPIA), type: 'PNG ' },
          { id: 2, data: createPalettedPng(EGA), type: 'PNG ' },
        ]),
        adaptiveIds
      );
      const map = BlorbParser.parse(blorb);
      const palettes: Array<{ id: number; palette: number[] }> = [];
      const h = new BlorbMultimediaHandler(map, blorb, {
        logger: mockLogger,
        pictureRenderer: (id, data) => {
          const found = readPalette(data);
          palettes.push({ id, palette: found ? [...found] : [] });
        },
      });
      return { render: (id: number) => h.displayPicture(id, 1, 1, 100, 0), palettes };
    }

    it('should recolor an adaptive picture with the preceding picture palette', () => {
      const { render, palettes } = renderWith([2]);

      render(1); // non-adaptive: establishes the current palette
      render(2); // adaptive: should be recolored

      expect(palettes[0].palette).toEqual(SEPIA.flat());
      expect(palettes[1].palette).toEqual(SEPIA.flat());
    });

    it('should leave a non-adaptive picture palette alone', () => {
      const { render, palettes } = renderWith([]);

      render(1);
      render(2);

      expect(palettes[1].palette).toEqual(EGA.flat());
    });

    it('should keep using the last non-adaptive palette across several overlays', () => {
      const { render, palettes } = renderWith([2]);

      render(1);
      render(2);
      render(2);

      expect(palettes[2].palette).toEqual(SEPIA.flat());
    });

    it('should not let an adaptive picture become the current palette', () => {
      // Drawing an adaptive picture must not overwrite the palette that
      // subsequent adaptive pictures rely on.
      const { render, palettes } = renderWith([2]);

      render(1);
      render(2);
      render(1);
      render(2);

      expect(palettes[3].palette).toEqual(SEPIA.flat());
    });

    it('should render an adaptive picture unchanged when no palette is set yet', () => {
      const { render, palettes } = renderWith([2]);

      render(2); // adaptive picture drawn first, nothing to adapt to

      expect(palettes[0].palette).toEqual(EGA.flat());
    });

    it('should report no adaptive ids when the Blorb has no APal chunk', () => {
      const blorb = createBlorbWithPictures([{ id: 1, data: createPalettedPng(SEPIA), type: 'PNG ' }]);
      const map = BlorbParser.parse(blorb);

      expect(BlorbParser.getAdaptivePaletteIds(map, blorb).size).toBe(0);
    });

    it('should parse every id listed in the APal chunk', () => {
      const blorb = withAdaptivePalettes(
        createBlorbWithPictures([{ id: 1, data: createPalettedPng(SEPIA), type: 'PNG ' }]),
        [9, 10, 481]
      );
      const map = BlorbParser.parse(blorb);

      expect([...BlorbParser.getAdaptivePaletteIds(map, blorb)].sort((a, b) => a - b)).toEqual([9, 10, 481]);
    });
  });
});
