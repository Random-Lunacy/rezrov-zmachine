import { describe, expect, it } from 'vitest';
import {
  asciiString,
  copyBytes,
  readU16BE,
  readU32BE,
  readU8,
  toBase64,
  writeU16BE,
  writeU32BE,
  writeU8,
} from '../../../src/utils/bytes';

// The helpers replace Buffer methods, so most tests compare against Buffer itself.
const SAMPLE = Buffer.from([0x00, 0x01, 0x7f, 0x80, 0xff, 0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde]);

describe('bytes', () => {
  describe('reads', () => {
    it('should match Buffer at every offset', () => {
      for (let offset = 0; offset < SAMPLE.length; offset++) {
        expect(readU8(SAMPLE, offset)).toBe(SAMPLE.readUInt8(offset));
      }
      for (let offset = 0; offset <= SAMPLE.length - 2; offset++) {
        expect(readU16BE(SAMPLE, offset)).toBe(SAMPLE.readUInt16BE(offset));
      }
      for (let offset = 0; offset <= SAMPLE.length - 4; offset++) {
        expect(readU32BE(SAMPLE, offset)).toBe(SAMPLE.readUInt32BE(offset));
      }
    });

    it('should read a 32-bit value with the top bit set as unsigned', () => {
      expect(readU32BE(Uint8Array.from([0xff, 0xff, 0xff, 0xff]), 0)).toBe(0xffffffff);
      expect(readU32BE(Uint8Array.from([0x80, 0x00, 0x00, 0x00]), 0)).toBe(0x80000000);
    });

    it('should work on a Uint8Array that is not a Buffer', () => {
      const plain = Uint8Array.from(SAMPLE);
      expect(readU16BE(plain, 5)).toBe(0x1234);
    });

    it('should work on a subarray with a non-zero byteOffset', () => {
      expect(readU16BE(SAMPLE.subarray(5), 0)).toBe(0x1234);
    });

    it.each([
      ['past the end', 11, readU16BE],
      ['negative', -1, readU16BE],
      ['fractional', 1.5, readU16BE],
      ['past the end (32-bit)', 9, readU32BE],
      ['past the end (8-bit)', 12, readU8],
    ] as const)('should throw a RangeError for an offset %s', (_name, offset, read) => {
      expect(() => read(SAMPLE, offset)).toThrow(RangeError);
    });
  });

  describe('writes', () => {
    it('should produce the same bytes as Buffer', () => {
      const expected = Buffer.alloc(12);
      expected.writeUInt8(0xab, 0);
      expected.writeUInt16BE(0xbeef, 1);
      expected.writeUInt32BE(0xdeadbeef, 3);
      expected.writeUInt32BE(0, 7);

      const actual = new Uint8Array(12);
      writeU8(actual, 0xab, 0);
      writeU16BE(actual, 0xbeef, 1);
      writeU32BE(actual, 0xdeadbeef, 3);
      writeU32BE(actual, 0, 7);

      expect(Buffer.from(actual).equals(expected)).toBe(true);
    });

    it.each([
      ['an 8-bit value over 255', (b: Uint8Array) => writeU8(b, 256, 0)],
      ['a negative value', (b: Uint8Array) => writeU16BE(b, -1, 0)],
      ['a 16-bit value over 65535', (b: Uint8Array) => writeU16BE(b, 0x10000, 0)],
      ['a 32-bit value over 2^32-1', (b: Uint8Array) => writeU32BE(b, 0x100000000, 0)],
      ['a fractional value', (b: Uint8Array) => writeU16BE(b, 1.5, 0)],
      ['an offset past the end', (b: Uint8Array) => writeU16BE(b, 1, 7)],
    ])('should throw a RangeError for %s', (_name, write) => {
      expect(() => write(new Uint8Array(8))).toThrow(RangeError);
    });
  });

  describe('asciiString', () => {
    it('should match Buffer.toString for ranges, including the high-bit drop', () => {
      expect(asciiString(SAMPLE)).toBe(SAMPLE.toString('ascii'));
      expect(asciiString(SAMPLE, 2, 5)).toBe(SAMPLE.toString('ascii', 2, 5));
      expect(asciiString(Buffer.from('FORM', 'ascii'), 0, 4)).toBe('FORM');
    });

    it('should clamp out-of-range ends like Buffer', () => {
      expect(asciiString(SAMPLE, 8, 100)).toBe(SAMPLE.toString('ascii', 8, 100));
      expect(asciiString(SAMPLE, 100, 200)).toBe('');
    });
  });

  describe('copyBytes', () => {
    it('should match Buffer.copy for plain, offset and ranged copies', () => {
      for (const args of [
        [0, 0, 12],
        [3, 0, 4],
        [0, 5, 9],
        [2, 4, 12],
      ] as const) {
        const expected = Buffer.alloc(8, 0xee);
        const actual = new Uint8Array(8).fill(0xee);
        const expectedCount = SAMPLE.copy(expected, ...args);
        const actualCount = copyBytes(SAMPLE, actual, ...args);

        expect(actualCount).toBe(expectedCount);
        expect(Buffer.from(actual).equals(expected)).toBe(true);
      }
    });

    it('should stop at the end of the target instead of throwing', () => {
      const target = new Uint8Array(3);
      expect(copyBytes(SAMPLE, target)).toBe(3);
      expect(Array.from(target)).toEqual([0x00, 0x01, 0x7f]);
    });

    it('should copy nothing when the start is past the end', () => {
      expect(copyBytes(SAMPLE, new Uint8Array(4), 4)).toBe(0);
      expect(copyBytes(SAMPLE, new Uint8Array(4), 0, 20)).toBe(0);
    });

    it('should handle overlapping ranges of the same array in both directions', () => {
      const forward = Uint8Array.from([1, 2, 3, 4, 5, 6]);
      copyBytes(forward, forward, 2, 0, 4);
      expect(Array.from(forward)).toEqual([1, 2, 1, 2, 3, 4]);

      const backward = Uint8Array.from([1, 2, 3, 4, 5, 6]);
      copyBytes(backward, backward, 0, 2, 6);
      expect(Array.from(backward)).toEqual([3, 4, 5, 6, 5, 6]);
    });
  });

  describe('toBase64', () => {
    it('should match Buffer.toString for small and empty inputs', () => {
      expect(toBase64(SAMPLE)).toBe(SAMPLE.toString('base64'));
      expect(toBase64(new Uint8Array(0))).toBe('');
    });

    it('should handle an input larger than one chunk, with every byte value', () => {
      const big = new Uint8Array(100_000);
      for (let i = 0; i < big.length; i++) big[i] = i & 0xff;

      expect(toBase64(big)).toBe(Buffer.from(big).toString('base64'));
    });
  });
});
