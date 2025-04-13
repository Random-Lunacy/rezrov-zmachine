// tests/integration/object-system.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { Memory } from '../../src/core/memory/Memory';
import { GameObject } from '../../src/core/objects/GameObject';
import { Logger, LogLevel } from '../../src/utils/log';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Object system integration', () => {
  let memory: Memory;
  let logger: Logger;
  let objectTable: number;

  beforeAll(() => {
    const storyData = readFileSync(join(__dirname, '../fixtures/minimal.z3'));
    memory = new Memory(storyData);
    logger = new Logger(LogLevel.ERROR);
    objectTable = memory.getWord(0x0a);
  });

  it('can navigate object tree', () => {
    const obj1 = new GameObject(memory, logger, 3, objectTable, 1);
    const obj2 = obj1.child;

    expect(obj2).not.toBeNull();
    expect(obj2?.parent?.objnum).toBe(1);
  });
});
