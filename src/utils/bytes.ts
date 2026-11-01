/**
 * Byte helpers that work on any Uint8Array, so the library doesn't depend on Node's Buffer methods.
 * They match the Buffer behaviour the code relied on: big-endian reads and writes that throw a
 * RangeError when out of bounds, 7-bit ASCII decoding, and copies that clamp to the target's length.
 */

function checkRange(bytes: Uint8Array, offset: number, size: number): void {
  if (!Number.isInteger(offset) || offset < 0 || offset + size > bytes.length) {
    throw new RangeError(`Offset ${offset} out of range for ${size} byte(s) in a buffer of length ${bytes.length}`);
  }
}

function checkValue(value: number, max: number): void {
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new RangeError(`Value ${value} out of range (0 to ${max})`);
  }
}

/** Read an unsigned byte. */
export function readU8(bytes: Uint8Array, offset: number): number {
  checkRange(bytes, offset, 1);
  return bytes[offset];
}

/** Read an unsigned big-endian 16-bit word. */
export function readU16BE(bytes: Uint8Array, offset: number): number {
  checkRange(bytes, offset, 2);
  return (bytes[offset] << 8) | bytes[offset + 1];
}

/** Read an unsigned big-endian 32-bit word. */
export function readU32BE(bytes: Uint8Array, offset: number): number {
  checkRange(bytes, offset, 4);
  return bytes[offset] * 0x1000000 + ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]);
}

/** Write an unsigned byte. */
export function writeU8(bytes: Uint8Array, value: number, offset: number): void {
  checkValue(value, 0xff);
  checkRange(bytes, offset, 1);
  bytes[offset] = value;
}

/** Write an unsigned big-endian 16-bit word. */
export function writeU16BE(bytes: Uint8Array, value: number, offset: number): void {
  checkValue(value, 0xffff);
  checkRange(bytes, offset, 2);
  bytes[offset] = value >>> 8;
  bytes[offset + 1] = value & 0xff;
}

/** Write an unsigned big-endian 32-bit word. */
export function writeU32BE(bytes: Uint8Array, value: number, offset: number): void {
  checkValue(value, 0xffffffff);
  checkRange(bytes, offset, 4);
  bytes[offset] = value >>> 24;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

/**
 * Decode bytes as 7-bit ASCII (the high bit is dropped, like Buffer's 'ascii' encoding).
 * Out-of-range start and end values are clamped, like Buffer.toString.
 */
export function asciiString(bytes: Uint8Array, start: number = 0, end: number = bytes.length): string {
  let result = '';
  for (const byte of bytes.subarray(start, end)) {
    result += String.fromCharCode(byte & 0x7f);
  }
  return result;
}

/**
 * Copy bytes from source[sourceStart, sourceEnd) into target at targetStart, stopping at the end of the
 * target instead of throwing, like Buffer.copy. Overlapping ranges of the same array are handled.
 * @returns The number of bytes copied
 */
export function copyBytes(
  source: Uint8Array,
  target: Uint8Array,
  targetStart: number = 0,
  sourceStart: number = 0,
  sourceEnd: number = source.length
): number {
  const available = Math.max(0, Math.min(sourceEnd, source.length) - sourceStart);
  const count = Math.max(0, Math.min(available, target.length - targetStart));
  if (count > 0) {
    target.set(source.subarray(sourceStart, sourceStart + count), targetStart);
  }
  return count;
}

const BASE64_CHUNK = 0x8000;

/** Encode bytes as base64. */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += BASE64_CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + BASE64_CHUNK));
  }
  return btoa(binary);
}

/** Decode a base64 string into a new Uint8Array. */
export function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Write a string into the array as 7-bit ASCII (one byte per character, high bits dropped). */
export function writeAscii(bytes: Uint8Array, text: string, offset: number): void {
  checkRange(bytes, offset, text.length);
  for (let i = 0; i < text.length; i++) {
    bytes[offset + i] = text.charCodeAt(i) & 0x7f;
  }
}

/** Join byte arrays into one new Uint8Array. */
export function concatBytes(parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');

/** Encode a string as UTF-8. */
export function utf8Encode(text: string): Uint8Array {
  return encoder.encode(text);
}

/** Decode UTF-8 bytes into a string. */
export function utf8Decode(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}
