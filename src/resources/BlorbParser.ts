/**
 * Blorb file parser.
 *
 * Parses IFF FORM/IFRS containers into a BlorbMap for resource lookup.
 * Modeled on gi_blorb.c (giblorb_create_map + giblorb_initialize_map)
 * from the cheapglk reference implementation by Andrew Plotkin.
 */

import type { BlorbChunk, BlorbMap, BlorbResource } from './BlorbData';
import { BLORB_FORM_TYPE, BLORB_RIDX_TYPE } from './BlorbData';

export class BlorbParser {
  /**
   * Parse a Buffer containing a Blorb file into a BlorbMap.
   * Validates the IFF structure, scans all chunks, and builds the resource index.
   *
   * @param data The raw Blorb file data
   * @returns A BlorbMap with chunks and sorted resources
   * @throws Error on invalid format
   */
  static parse(data: Buffer): BlorbMap {
    // Validate minimum size for FORM header (12 bytes: 'FORM' + size + type)
    if (data.length < 12) {
      throw new Error('Invalid Blorb file: too small');
    }

    // Validate FORM header
    const formId = data.toString('ascii', 0, 4);
    if (formId !== 'FORM') {
      throw new Error(`Invalid Blorb file: expected FORM header, got '${formId}'`);
    }

    // Validate IFRS type
    const formType = data.toString('ascii', 8, 12);
    if (formType !== BLORB_FORM_TYPE) {
      throw new Error(`Invalid Blorb file: expected ${BLORB_FORM_TYPE} type, got '${formType}'`);
    }

    const totalLength = data.readUInt32BE(4) + 8;

    // Scan all chunks
    const chunks = BlorbParser.scanChunks(data, totalLength);

    // Build resource index from the RIdx chunk
    const resources = BlorbParser.buildResourceIndex(data, chunks);

    return { chunks, resources };
  }

  /**
   * Scan all IFF chunks in the file, building chunk descriptors.
   * Mirrors the chunk scanning loop in giblorb_create_map (gi_blorb.c:145-192).
   */
  private static scanChunks(data: Buffer, totalLength: number): BlorbChunk[] {
    const chunks: BlorbChunk[] = [];
    let offset = 12; // Skip FORM header (4) + size (4) + type (4)

    while (offset < totalLength && offset + 8 <= data.length) {
      const type = data.toString('ascii', offset, offset + 4);
      const len = data.readUInt32BE(offset + 4);

      if (type === 'FORM') {
        // FORM sub-containers (e.g., AIFF): data includes the 8-byte header
        // per gi_blorb.c:173-176
        chunks.push({
          type,
          offset: offset,
          length: len + 8,
        });
      } else {
        chunks.push({
          type,
          offset: offset + 8,
          length: len,
        });
      }

      // Advance to next chunk, with word-alignment padding
      offset = offset + len + 8;
      if (offset & 1) {
        offset++;
      }

      if (offset > totalLength) {
        throw new Error('Invalid Blorb file: chunk extends past end of FORM');
      }
    }

    return chunks;
  }

  /**
   * Find the RIdx chunk and build the sorted resource index.
   * Mirrors giblorb_initialize_map (gi_blorb.c:231-353).
   */
  private static buildResourceIndex(data: Buffer, chunks: BlorbChunk[]): BlorbResource[] {
    // Find the RIdx chunk
    const ridxIndex = chunks.findIndex((c) => c.type === BLORB_RIDX_TYPE);
    if (ridxIndex === -1) {
      throw new Error('Invalid Blorb file: missing RIdx chunk');
    }

    const ridx = chunks[ridxIndex];
    const ridxData = data.subarray(ridx.offset, ridx.offset + ridx.length);

    if (ridxData.length < 4) {
      throw new Error('Invalid Blorb file: RIdx chunk too small');
    }

    const numResources = ridxData.readUInt32BE(0);

    // Sanity check (per gi_blorb.c:266-267)
    if (numResources & 0xf0000000) {
      throw new Error('Invalid Blorb file: impossibly large resource count');
    }

    // Validate length: numResources * 12 bytes per entry + 4 byte count
    if (ridxData.length !== numResources * 12 + 4) {
      throw new Error(`Invalid Blorb file: RIdx length ${ridxData.length} does not match ${numResources} resources`);
    }

    // Build a map from chunk header start position to chunk index.
    // The RIdx stores chunk start positions (the position of the type+length header),
    // not data positions. For normal chunks, header start = offset - 8.
    // For FORM sub-chunks, header start = offset (since offset IS the header start).
    const startPosToChunkIndex = new Map<number, number>();
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const headerStart = chunk.type === 'FORM' ? chunk.offset : chunk.offset - 8;
      startPosToChunkIndex.set(headerStart, i);
    }

    const resources: BlorbResource[] = [];
    for (let i = 0; i < numResources; i++) {
      const entryOffset = 4 + i * 12;
      const usage = ridxData.toString('ascii', entryOffset, entryOffset + 4);
      const resnum = ridxData.readUInt32BE(entryOffset + 4);
      const startpos = ridxData.readUInt32BE(entryOffset + 8);

      const chunkIndex = startPosToChunkIndex.get(startpos);
      if (chunkIndex === undefined) {
        throw new Error(
          `Invalid Blorb file: resource ${usage}:${resnum} points to position ${startpos} which does not match any chunk`
        );
      }

      resources.push({ usage, number: resnum, chunkIndex });
    }

    // Sort by usage then number for binary search (per gi_blorb.c:318)
    resources.sort((a, b) => {
      if (a.usage < b.usage) return -1;
      if (a.usage > b.usage) return 1;
      return a.number - b.number;
    });

    return resources;
  }

  /**
   * Look up a resource by usage type and number, returning its raw data.
   * Uses binary search on the sorted resource index.
   *
   * @param map The parsed Blorb map
   * @param data The raw Blorb file buffer
   * @param usage Resource usage type (e.g., BlorbUsage.Pict)
   * @param number Resource number
   * @returns Buffer slice containing the resource data, or null if not found
   */
  static getResource(map: BlorbMap, data: Buffer, usage: string, number: number): Buffer | null {
    const index = BlorbParser.findResource(map.resources, usage, number);
    if (index === -1) {
      return null;
    }

    const resource = map.resources[index];
    const chunk = map.chunks[resource.chunkIndex];
    return data.subarray(chunk.offset, chunk.offset + chunk.length);
  }

  /**
   * Get the chunk type for a resource (e.g., 'JPEG', 'PNG ', 'ZCOD').
   */
  static getResourceChunkType(map: BlorbMap, usage: string, number: number): string | null {
    const index = BlorbParser.findResource(map.resources, usage, number);
    if (index === -1) {
      return null;
    }

    return map.chunks[map.resources[index].chunkIndex].type;
  }

  /**
   * Find a chunk by type, optionally skipping the first `count` matches.
   * Mirrors giblorb_load_chunk_by_type (gi_blorb.c:404-423).
   *
   * @param map The parsed Blorb map
   * @param data The raw Blorb file buffer
   * @param type Chunk type to find (e.g., 'AUTH', 'ANNO', 'IFmd')
   * @param count Number of matches to skip (default 0 = first match)
   * @returns Buffer slice containing the chunk data, or null if not found
   */
  static getChunkByType(map: BlorbMap, data: Buffer, type: string, count: number = 0): Buffer | null {
    let skipped = 0;
    for (const chunk of map.chunks) {
      if (chunk.type === type) {
        if (skipped === count) {
          return data.subarray(chunk.offset, chunk.offset + chunk.length);
        }
        skipped++;
      }
    }
    return null;
  }

  /**
   * Extract the executable story data from the Blorb file.
   * Looks for Exec resource number 0 (the main story file).
   *
   * @param map The parsed Blorb map
   * @param data The raw Blorb file buffer
   * @returns Buffer containing the story data, or null if not embedded
   */
  static getExecData(map: BlorbMap, data: Buffer): Buffer | null {
    return BlorbParser.getResource(map, data, 'Exec', 0);
  }

  /**
   * Count the number of resources of a given usage type.
   * Mirrors giblorb_count_resources (gi_blorb.c).
   */
  static getResourceCount(map: BlorbMap, usage: string): number {
    let count = 0;
    for (const res of map.resources) {
      if (res.usage === usage) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get all resource numbers for a given usage type.
   */
  static getResourceNumbers(map: BlorbMap, usage: string): number[] {
    const numbers: number[] = [];
    for (const res of map.resources) {
      if (res.usage === usage) {
        numbers.push(res.number);
      }
    }
    return numbers;
  }

  /**
   * Check whether a Buffer looks like a Blorb file (starts with FORM...IFRS).
   * Useful for auto-detection without throwing on invalid data.
   */
  static isBlorb(data: Buffer): boolean {
    if (data.length < 12) return false;
    return data.toString('ascii', 0, 4) === 'FORM' && data.toString('ascii', 8, 12) === BLORB_FORM_TYPE;
  }

  /**
   * Binary search the sorted resources array.
   * Mirrors giblorb_bsearch (gi_blorb.c:724-746).
   */
  private static findResource(resources: BlorbResource[], usage: string, number: number): number {
    let lo = 0;
    let hi = resources.length - 1;

    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const res = resources[mid];

      if (res.usage < usage) {
        lo = mid + 1;
      } else if (res.usage > usage) {
        hi = mid - 1;
      } else if (res.number < number) {
        lo = mid + 1;
      } else if (res.number > number) {
        hi = mid - 1;
      } else {
        return mid;
      }
    }

    return -1;
  }
}
