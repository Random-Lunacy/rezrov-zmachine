import { join } from 'path';
import { beforeAll, describe, expect, it } from 'vitest';
import { Memory } from '../../src/core/memory/Memory';
import { Logger, LogLevel } from '../../src/utils/log';

describe('Memory with minimal.z5 fixture', () => {
  let memory: Memory;
  Logger.setLevel(LogLevel.DEBUG);

  beforeAll(() => {
    memory = Memory.fromFile(join(__dirname, '../fixtures/minimal.z5'));
  });

  it('correctly reads header values', () => {
    expect(memory.version).toBe(5); // Version
    expect(memory.getWord(0x0a)).toBeGreaterThan(0); // Object table address
  });
});
