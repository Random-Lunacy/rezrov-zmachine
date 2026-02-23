/**
 * Blorb resource container types and constants.
 *
 * Blorb is an IFF-based format (FORM type 'IFRS') that packages multimedia
 * resources (pictures, sounds) alongside interactive fiction story files.
 * See: https://www.eblong.com/zarf/blorb/blorb.html
 *
 * Reference implementation: cheapglk gi_blorb.c by Andrew Plotkin.
 */

/** IFF FORM type identifier for Blorb files */
export const BLORB_FORM_TYPE = 'IFRS';

/** Resource index chunk type (required in every Blorb file) */
export const BLORB_RIDX_TYPE = 'RIdx';

/**
 * Resource usage types from the Blorb spec.
 * These identify what role a resource plays (picture, sound, executable, etc.).
 * Values are 4-character IFF identifiers.
 */
export enum BlorbUsage {
  Exec = 'Exec',
  Pict = 'Pict',
  Snd = 'Snd ',
  Data = 'Data',
}

/**
 * Known chunk content types that may appear in a Blorb file.
 * These identify the format of the actual data within a chunk.
 */
export enum BlorbChunkType {
  ZCOD = 'ZCOD',
  GLUL = 'GLUL',
  JPEG = 'JPEG',
  PNG = 'PNG ',
  AIFF = 'AIFF',
  OGGV = 'OGGV',
  MOD = 'MOD ',
  SONG = 'SONG',
  FORM = 'FORM',
}

/**
 * Metadata chunk types that carry non-resource information.
 */
export enum BlorbMetadataType {
  IFmd = 'IFmd',
  Fspc = 'Fspc',
  RDes = 'RDes',
  AUTH = 'AUTH',
  ANNO = 'ANNO',
  SNam = 'SNam',
}

/**
 * A parsed chunk descriptor.
 * Mirrors giblorb_chunkdesc_t from the reference implementation.
 */
export interface BlorbChunk {
  /** 4-character chunk type identifier */
  type: string;
  /** Byte offset of chunk data in the buffer (past the 8-byte type+length header) */
  offset: number;
  /** Length of chunk data in bytes */
  length: number;
}

/**
 * A resource index entry mapping a usage+number pair to a chunk.
 * Mirrors giblorb_resdesc_t from the reference implementation.
 */
export interface BlorbResource {
  /** Usage type (Pict, Snd, Exec, Data) */
  usage: string;
  /** Resource number within that usage type */
  number: number;
  /** Index into the BlorbMap.chunks array */
  chunkIndex: number;
}

/**
 * The parsed Blorb map containing all chunks and the resource index.
 * Mirrors giblorb_map_t from the reference implementation.
 * Resources are sorted by usage then number for binary search lookup.
 */
export interface BlorbMap {
  chunks: BlorbChunk[];
  resources: BlorbResource[];
}
