import { beforeEach, describe, expect, it } from 'vitest';
import { BlorbParser } from '../../../src/resources/BlorbParser';
import { BlorbUsage } from '../../../src/resources/BlorbData';
import type { BlorbMap } from '../../../src/resources/BlorbData';

/**
 * Helper to build a synthetic Blorb file buffer for testing.
 * Constructs valid IFF FORM/IFRS structure with RIdx and content chunks.
 */
function buildBlorb(
  resources: Array<{ usage: string; number: number; chunkType: string; data: Buffer }>,
  extraChunks?: Array<{ type: string; data: Buffer }>
): Buffer {
  // Calculate total size needed
  // Each resource needs: 8 (chunk header) + data.length + padding
  // Plus RIdx: 8 (header) + 4 (count) + 12 * numResources
  const ridxDataLen = 4 + resources.length * 12;
  const ridxChunkLen = 8 + ridxDataLen + (ridxDataLen % 2);

  let contentLen = 0;
  for (const r of resources) {
    contentLen += 8 + r.data.length;
    if (r.data.length % 2 !== 0) contentLen++;
  }

  let extraLen = 0;
  if (extraChunks) {
    for (const c of extraChunks) {
      extraLen += 8 + c.data.length;
      if (c.data.length % 2 !== 0) extraLen++;
    }
  }

  const totalFormSize = 4 + ridxChunkLen + contentLen + extraLen; // 4 for 'IFRS'
  const buf = Buffer.alloc(8 + totalFormSize);
  let offset = 0;

  // FORM header
  buf.write('FORM', offset, 'ascii');
  offset += 4;
  buf.writeUInt32BE(totalFormSize, offset);
  offset += 4;
  buf.write('IFRS', offset, 'ascii');
  offset += 4;

  // RIdx chunk
  const ridxStart = offset; // remember for RIdx entries
  buf.write('RIdx', offset, 'ascii');
  offset += 4;
  buf.writeUInt32BE(ridxDataLen, offset);
  offset += 4;
  buf.writeUInt32BE(resources.length, offset);
  offset += 4;

  // We need to know each content chunk's start position before writing the RIdx entries.
  // Content chunks start after the RIdx chunk.
  let chunkStartPos = ridxStart + 8 + ridxDataLen;
  if (ridxDataLen % 2 !== 0) chunkStartPos++;

  const chunkPositions: number[] = [];
  for (const r of resources) {
    chunkPositions.push(chunkStartPos);
    chunkStartPos += 8 + r.data.length;
    if (r.data.length % 2 !== 0) chunkStartPos++;
  }

  // Write RIdx entries
  for (let i = 0; i < resources.length; i++) {
    buf.write(resources[i].usage, offset, 'ascii');
    offset += 4;
    buf.writeUInt32BE(resources[i].number, offset);
    offset += 4;
    buf.writeUInt32BE(chunkPositions[i], offset);
    offset += 4;
  }

  // Padding for RIdx data
  if (ridxDataLen % 2 !== 0) {
    offset++;
  }

  // Write content chunks
  for (const r of resources) {
    buf.write(r.chunkType, offset, 'ascii');
    offset += 4;
    buf.writeUInt32BE(r.data.length, offset);
    offset += 4;
    r.data.copy(buf, offset);
    offset += r.data.length;
    if (r.data.length % 2 !== 0) {
      offset++; // padding byte
    }
  }

  // Write extra (non-resource) chunks
  if (extraChunks) {
    for (const c of extraChunks) {
      buf.write(c.type, offset, 'ascii');
      offset += 4;
      buf.writeUInt32BE(c.data.length, offset);
      offset += 4;
      c.data.copy(buf, offset);
      offset += c.data.length;
      if (c.data.length % 2 !== 0) {
        offset++;
      }
    }
  }

  return buf;
}

/** Build a minimal empty Blorb (FORM/IFRS with RIdx containing 0 resources) */
function buildEmptyBlorb(): Buffer {
  return buildBlorb([]);
}

describe('BlorbParser', () => {
  describe('isBlorb', () => {
    it('should identify a valid Blorb file', () => {
      const data = buildEmptyBlorb();
      expect(BlorbParser.isBlorb(data)).toBe(true);
    });

    it('should reject a non-Blorb buffer', () => {
      const data = Buffer.from('Not a blorb file at all');
      expect(BlorbParser.isBlorb(data)).toBe(false);
    });

    it('should reject a buffer that is too small', () => {
      const data = Buffer.alloc(8);
      expect(BlorbParser.isBlorb(data)).toBe(false);
    });

    it('should reject FORM with wrong type', () => {
      const data = buildEmptyBlorb();
      data.write('IFZS', 8, 'ascii'); // Quetzal, not Blorb
      expect(BlorbParser.isBlorb(data)).toBe(false);
    });
  });

  describe('parse - validation', () => {
    it('should throw on non-FORM header', () => {
      const data = Buffer.alloc(20);
      data.write('XXXX', 0, 'ascii');
      expect(() => BlorbParser.parse(data)).toThrow(/expected FORM header/);
    });

    it('should throw on non-IFRS type', () => {
      const data = buildEmptyBlorb();
      data.write('IFZS', 8, 'ascii');
      expect(() => BlorbParser.parse(data)).toThrow(/expected IFRS type/);
    });

    it('should throw on buffer too small', () => {
      expect(() => BlorbParser.parse(Buffer.alloc(8))).toThrow(/too small/);
    });

    it('should throw when RIdx is missing', () => {
      // Build a FORM/IFRS with no chunks (manually, bypassing buildBlorb)
      const buf = Buffer.alloc(12);
      buf.write('FORM', 0, 'ascii');
      buf.writeUInt32BE(4, 4); // size = 4 (just the IFRS identifier)
      buf.write('IFRS', 8, 'ascii');
      expect(() => BlorbParser.parse(buf)).toThrow(/missing RIdx/);
    });
  });

  describe('parse - chunk scanning', () => {
    let blorbData: Buffer;
    let map: BlorbMap;

    beforeEach(() => {
      const pictData = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes (4 bytes)
      const sndData = Buffer.from([0x4f, 0x67, 0x67, 0x53, 0x00]); // OggS header (5 bytes, odd)
      blorbData = buildBlorb([
        { usage: BlorbUsage.Pict, number: 1, chunkType: 'PNG ', data: pictData },
        { usage: BlorbUsage.Snd, number: 1, chunkType: 'OGGV', data: sndData },
      ]);
      map = BlorbParser.parse(blorbData);
    });

    it('should find all chunks including RIdx', () => {
      // RIdx + PNG + OGGV = 3 chunks
      expect(map.chunks.length).toBe(3);
    });

    it('should correctly identify chunk types', () => {
      expect(map.chunks[0].type).toBe('RIdx');
      expect(map.chunks[1].type).toBe('PNG ');
      expect(map.chunks[2].type).toBe('OGGV');
    });

    it('should correctly record chunk lengths', () => {
      expect(map.chunks[1].length).toBe(4); // PNG data
      expect(map.chunks[2].length).toBe(5); // OGGV data (odd)
    });

    it('should handle odd-size padding correctly', () => {
      // The OGGV chunk has 5 bytes of data (odd), so should be padded.
      // The parser should not choke on this.
      expect(map.chunks.length).toBe(3);
      // Verify we can read the data back correctly
      const sndBuf = BlorbParser.getResource(map, blorbData, BlorbUsage.Snd, 1);
      expect(sndBuf).not.toBeNull();
      expect(sndBuf!.length).toBe(5);
      expect(sndBuf![0]).toBe(0x4f); // 'O' of OggS
    });
  });

  describe('parse - resource index', () => {
    let blorbData: Buffer;
    let map: BlorbMap;

    beforeEach(() => {
      blorbData = buildBlorb([
        { usage: BlorbUsage.Pict, number: 3, chunkType: 'JPEG', data: Buffer.from('jpeg-data-3') },
        { usage: BlorbUsage.Pict, number: 1, chunkType: 'PNG ', data: Buffer.from('png-data-1') },
        { usage: BlorbUsage.Snd, number: 2, chunkType: 'OGGV', data: Buffer.from('ogg-data-2') },
        { usage: BlorbUsage.Exec, number: 0, chunkType: 'ZCOD', data: Buffer.from('story-data') },
      ]);
      map = BlorbParser.parse(blorbData);
    });

    it('should parse the correct number of resources', () => {
      expect(map.resources.length).toBe(4);
    });

    it('should sort resources by usage then number', () => {
      // Exec < Pict < Snd (string comparison)
      expect(map.resources[0].usage).toBe('Exec');
      expect(map.resources[0].number).toBe(0);
      expect(map.resources[1].usage).toBe('Pict');
      expect(map.resources[1].number).toBe(1);
      expect(map.resources[2].usage).toBe('Pict');
      expect(map.resources[2].number).toBe(3);
      expect(map.resources[3].usage).toBe('Snd ');
      expect(map.resources[3].number).toBe(2);
    });

    it('should map resources to correct chunks', () => {
      // Exec:0 should point to the ZCOD chunk
      const execChunk = map.chunks[map.resources[0].chunkIndex];
      expect(execChunk.type).toBe('ZCOD');

      // Pict:1 should point to the PNG chunk
      const pictChunk = map.chunks[map.resources[1].chunkIndex];
      expect(pictChunk.type).toBe('PNG ');
    });
  });

  describe('getResource', () => {
    let blorbData: Buffer;
    let map: BlorbMap;

    beforeEach(() => {
      blorbData = buildBlorb([
        { usage: BlorbUsage.Pict, number: 1, chunkType: 'JPEG', data: Buffer.from('jpeg-pic-1') },
        { usage: BlorbUsage.Pict, number: 2, chunkType: 'PNG ', data: Buffer.from('png-pic-2') },
        { usage: BlorbUsage.Snd, number: 1, chunkType: 'OGGV', data: Buffer.from('sound-1') },
      ]);
      map = BlorbParser.parse(blorbData);
    });

    it('should return correct data for an existing resource', () => {
      const data = BlorbParser.getResource(map, blorbData, BlorbUsage.Pict, 1);
      expect(data).not.toBeNull();
      expect(data!.toString('ascii')).toBe('jpeg-pic-1');
    });

    it('should return correct data for a different resource', () => {
      const data = BlorbParser.getResource(map, blorbData, BlorbUsage.Pict, 2);
      expect(data).not.toBeNull();
      expect(data!.toString('ascii')).toBe('png-pic-2');
    });

    it('should return correct data for sound resource', () => {
      const data = BlorbParser.getResource(map, blorbData, BlorbUsage.Snd, 1);
      expect(data).not.toBeNull();
      expect(data!.toString('ascii')).toBe('sound-1');
    });

    it('should return null for a non-existent resource number', () => {
      const data = BlorbParser.getResource(map, blorbData, BlorbUsage.Pict, 99);
      expect(data).toBeNull();
    });

    it('should return null for a non-existent usage type', () => {
      const data = BlorbParser.getResource(map, blorbData, BlorbUsage.Exec, 0);
      expect(data).toBeNull();
    });
  });

  describe('getResourceChunkType', () => {
    it('should return the chunk type for a resource', () => {
      const blorbData = buildBlorb([
        { usage: BlorbUsage.Pict, number: 1, chunkType: 'JPEG', data: Buffer.from('x') },
        { usage: BlorbUsage.Pict, number: 2, chunkType: 'PNG ', data: Buffer.from('y') },
      ]);
      const map = BlorbParser.parse(blorbData);

      expect(BlorbParser.getResourceChunkType(map, BlorbUsage.Pict, 1)).toBe('JPEG');
      expect(BlorbParser.getResourceChunkType(map, BlorbUsage.Pict, 2)).toBe('PNG ');
      expect(BlorbParser.getResourceChunkType(map, BlorbUsage.Pict, 99)).toBeNull();
    });
  });

  describe('getExecData', () => {
    it('should extract embedded story data', () => {
      const storyContent = Buffer.alloc(64);
      storyContent[0] = 5; // Z-machine version
      storyContent.write('HELLO', 1, 'ascii');

      const blorbData = buildBlorb([
        { usage: BlorbUsage.Exec, number: 0, chunkType: 'ZCOD', data: storyContent },
        { usage: BlorbUsage.Pict, number: 1, chunkType: 'JPEG', data: Buffer.from('pic') },
      ]);
      const map = BlorbParser.parse(blorbData);

      const exec = BlorbParser.getExecData(map, blorbData);
      expect(exec).not.toBeNull();
      expect(exec!.length).toBe(64);
      expect(exec![0]).toBe(5);
      expect(exec!.toString('ascii', 1, 6)).toBe('HELLO');
    });

    it('should return null when no Exec resource exists', () => {
      const blorbData = buildBlorb([
        { usage: BlorbUsage.Pict, number: 1, chunkType: 'JPEG', data: Buffer.from('pic') },
      ]);
      const map = BlorbParser.parse(blorbData);

      expect(BlorbParser.getExecData(map, blorbData)).toBeNull();
    });
  });

  describe('getChunkByType', () => {
    it('should find a metadata chunk', () => {
      const authData = Buffer.from('Andrew Plotkin');
      const blorbData = buildBlorb([], [{ type: 'AUTH', data: authData }]);
      const map = BlorbParser.parse(blorbData);

      const result = BlorbParser.getChunkByType(map, blorbData, 'AUTH');
      expect(result).not.toBeNull();
      expect(result!.toString('ascii')).toBe('Andrew Plotkin');
    });

    it('should skip to the Nth occurrence with count parameter', () => {
      const anno1 = Buffer.from('First annotation');
      const anno2 = Buffer.from('Second annotation');
      const blorbData = buildBlorb([], [
        { type: 'ANNO', data: anno1 },
        { type: 'ANNO', data: anno2 },
      ]);
      const map = BlorbParser.parse(blorbData);

      const first = BlorbParser.getChunkByType(map, blorbData, 'ANNO', 0);
      expect(first!.toString('ascii')).toBe('First annotation');

      const second = BlorbParser.getChunkByType(map, blorbData, 'ANNO', 1);
      expect(second!.toString('ascii')).toBe('Second annotation');

      const third = BlorbParser.getChunkByType(map, blorbData, 'ANNO', 2);
      expect(third).toBeNull();
    });

    it('should return null for non-existent chunk type', () => {
      const blorbData = buildEmptyBlorb();
      const map = BlorbParser.parse(blorbData);
      expect(BlorbParser.getChunkByType(map, blorbData, 'XXXX')).toBeNull();
    });
  });

  describe('getResourceCount', () => {
    it('should count resources by usage type', () => {
      const blorbData = buildBlorb([
        { usage: BlorbUsage.Pict, number: 1, chunkType: 'JPEG', data: Buffer.from('a') },
        { usage: BlorbUsage.Pict, number: 2, chunkType: 'PNG ', data: Buffer.from('b') },
        { usage: BlorbUsage.Pict, number: 3, chunkType: 'JPEG', data: Buffer.from('c') },
        { usage: BlorbUsage.Snd, number: 1, chunkType: 'OGGV', data: Buffer.from('d') },
      ]);
      const map = BlorbParser.parse(blorbData);

      expect(BlorbParser.getResourceCount(map, BlorbUsage.Pict)).toBe(3);
      expect(BlorbParser.getResourceCount(map, BlorbUsage.Snd)).toBe(1);
      expect(BlorbParser.getResourceCount(map, BlorbUsage.Exec)).toBe(0);
    });
  });

  describe('getResourceNumbers', () => {
    it('should return all resource numbers for a usage type', () => {
      const blorbData = buildBlorb([
        { usage: BlorbUsage.Pict, number: 5, chunkType: 'JPEG', data: Buffer.from('a') },
        { usage: BlorbUsage.Pict, number: 10, chunkType: 'PNG ', data: Buffer.from('b') },
        { usage: BlorbUsage.Pict, number: 1, chunkType: 'JPEG', data: Buffer.from('c') },
      ]);
      const map = BlorbParser.parse(blorbData);

      // Should be sorted by number (since resources are sorted by usage+number)
      expect(BlorbParser.getResourceNumbers(map, BlorbUsage.Pict)).toEqual([1, 5, 10]);
    });
  });

  describe('empty Blorb', () => {
    it('should parse a valid Blorb with 0 resources', () => {
      const blorbData = buildEmptyBlorb();
      const map = BlorbParser.parse(blorbData);

      expect(map.resources.length).toBe(0);
      expect(map.chunks.length).toBe(1); // Just the RIdx
      expect(map.chunks[0].type).toBe('RIdx');
    });
  });

  describe('FORM sub-chunks', () => {
    it('should handle AIFF resources wrapped in FORM containers', () => {
      // AIFF files are FORM containers themselves: FORM + size + AIFF + data
      // Build an AIFF-like FORM chunk manually
      const aiffContent = Buffer.from('AIFF-sample-data');
      const formChunkData = Buffer.alloc(4 + aiffContent.length);
      formChunkData.write('AIFF', 0, 'ascii');
      aiffContent.copy(formChunkData, 4);

      // The FORM chunk in the RIdx will point to the sub-FORM's header position
      // buildBlorb handles this — but for FORM sub-chunks we need special handling.
      // Let's test by building manually to ensure FORM sub-chunk detection works.

      // Manual build: FORM/IFRS containing RIdx + FORM/AIFF sub-chunk
      const numRes = 1;
      const ridxDataLen = 4 + numRes * 12;

      // FORM/AIFF sub-chunk: FORM(4) + len(4) + AIFF(4) + data
      const subFormLen = 4 + aiffContent.length; // length field value (does NOT include FORM+len header)
      const subFormTotal = 8 + subFormLen; // total bytes on disk

      const totalFormSize = 4 + (8 + ridxDataLen) + subFormTotal;
      const buf = Buffer.alloc(8 + totalFormSize);
      let offset = 0;

      // Outer FORM/IFRS
      buf.write('FORM', offset, 'ascii');
      offset += 4;
      buf.writeUInt32BE(totalFormSize, offset);
      offset += 4;
      buf.write('IFRS', offset, 'ascii');
      offset += 4;

      // RIdx chunk
      buf.write('RIdx', offset, 'ascii');
      offset += 4;
      buf.writeUInt32BE(ridxDataLen, offset);
      offset += 4;
      buf.writeUInt32BE(numRes, offset);
      offset += 4;

      // RIdx entry: Snd resource 1 pointing to the FORM sub-chunk
      const formChunkStart = 12 + 8 + ridxDataLen; // position of FORM sub-chunk header
      buf.write('Snd ', offset, 'ascii');
      offset += 4;
      buf.writeUInt32BE(1, offset); // resource number
      offset += 4;
      buf.writeUInt32BE(formChunkStart, offset);
      offset += 4;

      // FORM/AIFF sub-chunk
      buf.write('FORM', offset, 'ascii');
      offset += 4;
      buf.writeUInt32BE(subFormLen, offset);
      offset += 4;
      buf.write('AIFF', offset, 'ascii');
      offset += 4;
      aiffContent.copy(buf, offset);

      const map = BlorbParser.parse(buf);

      // The FORM chunk should be detected
      const formChunk = map.chunks.find((c) => c.type === 'FORM');
      expect(formChunk).toBeDefined();
      // For FORM sub-chunks, offset = header start, length = len+8
      expect(formChunk!.length).toBe(subFormLen + 8);

      // Should be able to look up the sound resource
      const sndData = BlorbParser.getResource(map, buf, 'Snd ', 1);
      expect(sndData).not.toBeNull();
      // The returned data for FORM sub-chunks includes the full FORM container
      expect(sndData!.toString('ascii', 0, 4)).toBe('FORM');
      expect(sndData!.toString('ascii', 8, 12)).toBe('AIFF');
    });
  });

  describe('RIdx validation', () => {
    it('should throw on bad RIdx length', () => {
      // Build a blorb manually with wrong RIdx length
      const buf = Buffer.alloc(40);
      let offset = 0;
      buf.write('FORM', offset, 'ascii');
      offset += 4;
      buf.writeUInt32BE(32, offset); // totalFormSize
      offset += 4;
      buf.write('IFRS', offset, 'ascii');
      offset += 4;
      buf.write('RIdx', offset, 'ascii');
      offset += 4;
      buf.writeUInt32BE(8, offset); // wrong: says 8 bytes but 1 resource needs 4+12=16
      offset += 4;
      buf.writeUInt32BE(1, offset); // claims 1 resource
      offset += 4;
      // Only 4 more bytes available, not enough for one 12-byte entry

      expect(() => BlorbParser.parse(buf)).toThrow(/RIdx length/);
    });

    it('should throw when resource points to non-existent chunk position', () => {
      // Build FORM/IFRS with RIdx pointing to a position that doesn't match any chunk
      const buf = Buffer.alloc(44);
      let offset = 0;
      buf.write('FORM', offset, 'ascii');
      offset += 4;
      buf.writeUInt32BE(36, offset);
      offset += 4;
      buf.write('IFRS', offset, 'ascii');
      offset += 4;
      buf.write('RIdx', offset, 'ascii');
      offset += 4;
      buf.writeUInt32BE(16, offset); // 4 + 1*12
      offset += 4;
      buf.writeUInt32BE(1, offset); // 1 resource
      offset += 4;
      buf.write('Pict', offset, 'ascii');
      offset += 4;
      buf.writeUInt32BE(1, offset); // resource number
      offset += 4;
      buf.writeUInt32BE(9999, offset); // bogus start position
      offset += 4;

      expect(() => BlorbParser.parse(buf)).toThrow(/does not match any chunk/);
    });
  });
});
