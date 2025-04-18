import { join } from 'path';
import { beforeAll, describe, expect, it } from 'vitest';
import { Memory } from '../../src/core/memory/Memory';
import { GameObjectFactory } from '../../src/core/objects/GameObjectFactory';
import { HeaderLocation } from '../../src/utils/constants';
import { Logger, LogLevel } from '../../src/utils/log';

describe('Memory with minimal.z3 fixture', () => {
  let memory: Memory;
  let logger: Logger;
  let objectFactory: GameObjectFactory;

  Logger.setLevel(LogLevel.DEBUG);

  beforeAll(() => {
    memory = Memory.fromFile(join(__dirname, '../fixtures/minimal.z3'));
    logger = new Logger('MemoryTest');
    objectFactory = new GameObjectFactory(memory, logger, 3, memory.getWord(HeaderLocation.ObjectTable));
  });

  it('correctly reads header values', () => {
    expect(memory.version).toBe(3);
    expect(memory.getWord(HeaderLocation.ObjectTable)).toBe(0x10a);
    expect(memory.getWord(HeaderLocation.StaticMemBase)).toBe(0x4eb);
    expect(memory.getWord(HeaderLocation.HighMemBase)).toBe(0x510);
  });

  it('can read object attributes directly from memory', () => {
    const objTableAddr = memory.getWord(HeaderLocation.ObjectTable);
    const propDefaultsSize = 31 * 2;

    // Object 5 (Test Room)
    const obj5Addr = objTableAddr + propDefaultsSize + (5 - 1) * 9;

    // First attribute byte - should have bit 0 (light) set
    const attr0 = memory.getByte(obj5Addr);
    // Test if the most significant bit (bit 0) is set
    expect((attr0 & 0x80) !== 0).toBe(true);

    // Object 6 (small box)
    const obj6Addr = objTableAddr + propDefaultsSize + (6 - 1) * 9;

    // First attribute byte - should have bits 1 and 2 set (container, openable)
    const attr0_box = memory.getByte(obj6Addr);
    // Test if bits 1 and 2 (second and third most significant bits) are set
    expect((attr0_box & 0x40) !== 0).toBe(true); // container (bit 1)
    expect((attr0_box & 0x20) !== 0).toBe(true); // openable (bit 2)
  });

  describe('GameObject behavior', () => {
    it('should correctly identify object 5 attributes', () => {
      const room = objectFactory.getObject(5);
      expect(room).not.toBeNull();

      if (room) {
        // Test if light (attribute 0) is set
        const hasLight = room.hasAttribute(0);
        console.log(`Object 5 (Test Room) has light attribute: ${hasLight}`);
        expect(hasLight).toBe(true);
      }
    });

    it('should correctly identify object 6 attributes', () => {
      const box = objectFactory.getObject(6);
      expect(box).not.toBeNull();

      if (box) {
        // Test container (attribute 1) and openable (attribute 2)
        const hasContainer = box.hasAttribute(1);
        const hasOpenable = box.hasAttribute(2);
        console.log(`Object 6 (small box) has container attribute: ${hasContainer}`);
        console.log(`Object 6 (small box) has openable attribute: ${hasOpenable}`);

        expect(hasContainer).toBe(true);
        expect(hasOpenable).toBe(true);
      }
    });

    it('should safely retrieve object names', () => {
      try {
        const room = objectFactory.getObject(5);
        if (room) {
          console.log(`Object 5 name: "${room.name}"`);
          // This may fail if there's an issue with name retrieval
          expect(room.name.toLowerCase()).toContain('test room');
        }

        const box = objectFactory.getObject(6);
        if (box) {
          console.log(`Object 6 name: "${box.name}"`);
          expect(box.name.toLowerCase()).toContain('box');
        }

        const key = objectFactory.getObject(7);
        if (key) {
          console.log(`Object 7 name: "${key.name}"`);
          expect(key.name.toLowerCase()).toContain('key');
        }
      } catch (error) {
        console.error(`Error retrieving object names: ${error}`);
        throw error;
      }
    });

    it('should correctly navigate object relationships', () => {
      const room = objectFactory.getObject(5);
      const box = objectFactory.getObject(6);
      const key = objectFactory.getObject(7);

      if (room && box && key) {
        // The following tests might fail if there's an issue with relationship navigation
        try {
          expect(room.child?.objNum).toBe(6);
          expect(box.parent?.objNum).toBe(5);
          expect(key.parent?.objNum).toBe(6);
        } catch (error) {
          console.error(`Error navigating object relationships: ${error}`);
          throw error;
        }
      }
    });
  });
});
