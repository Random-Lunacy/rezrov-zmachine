// Unit test for cast16.ts
import { toI16, toU16 } from '../../src/core/memory/cast16';
import { describe, expect, it } from 'vitest';

describe('cast16 utility', () => {
  it('toI16 converts unsigned to signed', () => {
    expect(toI16(0xffff)).toBe(-1);
    expect(toI16(0x8000)).toBe(-32768);
    expect(toI16(0x7fff)).toBe(32767);
  });

  it('toU16 converts signed to unsigned', () => {
    expect(toU16(-1)).toBe(0xffff);
    expect(toU16(-32768)).toBe(0x8000);
    expect(toU16(32767)).toBe(0x7fff);
  });
});
