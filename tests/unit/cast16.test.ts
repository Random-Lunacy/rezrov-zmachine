// Unit test for cast16.ts
import { describe, it, expect } from 'vitest';
import { toI16, toU16 } from '../../src/core/memory/cast16';

describe('cast16 utility', () => {
  it('toI16 converts unsigned to signed', () => {
    expect(toI16(0xFFFF)).toBe(-1);
    expect(toI16(0x8000)).toBe(-32768);
    expect(toI16(0x7FFF)).toBe(32767);
  });

  it('toU16 converts signed to unsigned', () => {
    expect(toU16(-1)).toBe(0xFFFF);
    expect(toU16(-32768)).toBe(0x8000);
    expect(toU16(32767)).toBe(0x7FFF);
  });
});
