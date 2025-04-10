import { describe, it, expect, beforeAll } from 'vitest';
import { Memory } from '../../src/core/memory/Memory';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Memory with Zork fixture', () => {
  let memory: Memory;

  beforeAll(() => {
    const fixtureData = readFileSync(join(__dirname, '../fixtures/zork1.z3'));
    memory = new Memory(fixtureData);
  });

  it('correctly reads header values', () => {
    expect(memory.getByte(0)).toBe(3); // Version
    expect(memory.getWord(0x0a)).toBeGreaterThan(0); // Object table address
  });
});
