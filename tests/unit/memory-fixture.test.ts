import { readFileSync } from 'fs';
import { join } from 'path';
import { beforeAll, describe, expect, it } from 'vitest';
import { Memory } from '../../src/core/memory/Memory';

describe('Memory with minimal.z3 fixture', () => {
  let memory: Memory;

  beforeAll(() => {
    const fixtureData = readFileSync(join(__dirname, '../fixtures/minimal.z3'));
    memory = new Memory(fixtureData);
  });

  it('correctly reads header values', () => {
    expect(memory.version).toBe(3); // Version
    expect(memory.getWord(0x0a)).toBeGreaterThan(0); // Object table address
  });
});
