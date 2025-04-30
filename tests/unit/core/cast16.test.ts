// Unit test for cast16.ts
import { describe, expect, it } from 'vitest';
import { toI16, toU16 } from '../../../src/core/memory/cast16';

describe('cast16 utility', () => {
  describe('toI16', () => {
    it('converts unsigned to signed for edge cases', () => {
      expect(toI16(0xffff)).toBe(-1); // Maximum unsigned to -1
      expect(toI16(0x8000)).toBe(-32768); // Halfway point to minimum signed
      expect(toI16(0x7fff)).toBe(32767); // Maximum positive signed
    });

    it('handles zero correctly', () => {
      expect(toI16(0)).toBe(0); // Zero remains zero
    });

    it('preserves positive values within range', () => {
      expect(toI16(1)).toBe(1); // Minimum positive
      expect(toI16(255)).toBe(255); // Small positive
      expect(toI16(16384)).toBe(16384); // Mid-range positive
    });

    it('converts unsigned to negative values correctly', () => {
      expect(toI16(0x8001)).toBe(-32767); // Just past halfway
      expect(toI16(0x8fff)).toBe(-28673); // Arbitrary negative
      expect(toI16(0xfff0)).toBe(-16); // Near maximum
    });
  });

  describe('toU16', () => {
    it('converts signed to unsigned for edge cases', () => {
      expect(toU16(-1)).toBe(0xffff); // -1 to maximum unsigned
      expect(toU16(-32768)).toBe(0x8000); // Minimum signed to halfway point
      expect(toU16(32767)).toBe(0x7fff); // Maximum positive unchanged
    });

    it('handles zero correctly', () => {
      expect(toU16(0)).toBe(0); // Zero remains zero
    });

    it('preserves positive values', () => {
      expect(toU16(1)).toBe(1); // Minimum positive
      expect(toU16(255)).toBe(255); // Small positive
      expect(toU16(16384)).toBe(16384); // Mid-range positive
    });

    it('converts negative values to unsigned correctly', () => {
      expect(toU16(-255)).toBe(0xff01); // Small negative
      expect(toU16(-16384)).toBe(0xc000); // Mid-range negative
      expect(toU16(-32767)).toBe(0x8001); // Near minimum
    });
  });
});
