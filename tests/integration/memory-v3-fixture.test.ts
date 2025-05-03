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
    objectFactory = new GameObjectFactory(memory, 3, memory.getWord(HeaderLocation.ObjectTable), { logger });
  });

  describe('Memory structure', () => {
    it('correctly identifies Z-machine version', () => {
      expect(memory.version).toBe(3);
    });

    it('has valid memory address layout', () => {
      const objTableAddr = memory.getWord(HeaderLocation.ObjectTable);
      const dictAddr = memory.getWord(HeaderLocation.Dictionary);
      const globalsAddr = memory.getWord(HeaderLocation.GlobalVariables);
      const staticMemAddr = memory.getWord(HeaderLocation.StaticMemBase);
      const highMemAddr = memory.getWord(HeaderLocation.HighMemBase);

      expect(objTableAddr).toBe(0x10a);
      expect(dictAddr).toBe(0x4ed);
      expect(globalsAddr).toBe(0x30b);
      expect(staticMemAddr).toBe(0x4eb);
      expect(highMemAddr).toBe(0x510);

      // Verify memory section boundaries
      expect(staticMemAddr).toBeGreaterThan(globalsAddr);
      expect(highMemAddr).toBeGreaterThan(staticMemAddr);
    });

    it('correctly identifies memory regions', () => {
      // Test dynamic memory
      expect(memory.isDynamicMemory(0x100)).toBe(true);
      expect(memory.isDynamicMemory(0x4ea)).toBe(true);
      expect(memory.isDynamicMemory(0x4eb)).toBe(false);

      // Test static memory
      expect(memory.isStaticMemory(0x4eb)).toBe(true);
      expect(memory.isStaticMemory(0x50f)).toBe(true);
      expect(memory.isStaticMemory(0x510)).toBe(false);

      // Test high memory
      expect(memory.isHighMemory(0x510)).toBe(true);
      expect(memory.isHighMemory(0x4ea)).toBe(false);
    });

    it('enforces memory protection', () => {
      // Should be able to write to dynamic memory
      const testAddr = 0x100;
      const origVal = memory.getByte(testAddr);

      expect(() => memory.setByte(testAddr, 0xaa)).not.toThrow();
      expect(memory.getByte(testAddr)).toBe(0xaa);

      // Restore original value
      memory.setByte(testAddr, origVal);

      // Should not be able to write to static memory
      const staticAddr = memory.getWord(HeaderLocation.StaticMemBase);
      expect(() => memory.setByte(staticAddr, 0)).toThrow(/Cannot write to read-only memory/);

      // Should not be able to write to high memory
      const highAddr = memory.getWord(HeaderLocation.HighMemBase);
      expect(() => memory.setByte(highAddr, 0)).toThrow(/Cannot write to read-only memory/);
    });
  });

  describe('Object system', () => {
    it('correctly loads individual objects', () => {
      // Check compiler-generated objects
      for (let i = 1; i <= 4; i++) {
        const obj = objectFactory.getObject(i);
        expect(obj).not.toBeNull();
      }

      // Check our game objects
      const room = objectFactory.getObject(5);
      const box = objectFactory.getObject(6);
      const key = objectFactory.getObject(7);

      expect(room).not.toBeNull();
      expect(box).not.toBeNull();
      expect(key).not.toBeNull();
    });

    it('correctly identifies object attributes', () => {
      const room = objectFactory.getObject(5);
      const box = objectFactory.getObject(6);
      const key = objectFactory.getObject(7);

      // Test Room has the 'light' attribute (0)
      expect(room?.hasAttribute(0)).toBe(true);

      // small box has 'container' (1) and 'openable' (2) attributes
      expect(box?.hasAttribute(1)).toBe(true);
      expect(box?.hasAttribute(2)).toBe(true);

      // brass key has no attributes set
      if (key) {
        for (let i = 0; i < 32; i++) {
          expect(key.hasAttribute(i)).toBe(false);
        }
      }
    });

    it('correctly retrieves object names', () => {
      const room = objectFactory.getObject(5);
      const box = objectFactory.getObject(6);
      const key = objectFactory.getObject(7);

      expect(room?.name).toBe('Test Room');
      expect(box?.name).toBe('small box');
      expect(key?.name).toBe('brass key');
    });

    it('correctly provides object relationships', () => {
      const room = objectFactory.getObject(5);
      const box = objectFactory.getObject(6);
      const key = objectFactory.getObject(7);

      if (room && box && key) {
        // Test Room contains small box
        expect(room.child?.objNum).toBe(6);

        // small box is in Test Room
        expect(box.parent?.objNum).toBe(5);

        // small box contains brass key
        expect(box.child?.objNum).toBe(7);

        // brass key is in small box
        expect(key.parent?.objNum).toBe(6);

        // No siblings in this simple object tree
        expect(room.sibling).toBeNull();
        expect(box.sibling).toBeNull();
        expect(key.sibling).toBeNull();
      }
    });
  });

  describe('Memory operations', () => {
    it('can copy memory blocks', () => {
      // Find a safe area in dynamic memory for testing
      const sourceAddr = 0x100;
      const destAddr = 0x200;
      const length = 10;

      // Save original values - explicitly type the array
      const origValues: number[] = [];
      for (let i = 0; i < length; i++) {
        origValues.push(memory.getByte(destAddr + i));
      }

      // Set some test data
      for (let i = 0; i < length; i++) {
        memory.setByte(sourceAddr + i, 0xa0 + i);
      }

      // Copy the block
      memory.copyBlock(sourceAddr, destAddr, length);

      // Verify the copy worked
      for (let i = 0; i < length; i++) {
        expect(memory.getByte(destAddr + i)).toBe(0xa0 + i);
      }

      // Restore original values
      for (let i = 0; i < length; i++) {
        memory.setByte(destAddr + i, origValues[i]);
        memory.setByte(sourceAddr + i, 0); // Clear source too
      }
    });

    it('handles word operations correctly', () => {
      // Test in dynamic memory
      const testAddr = 0x100;
      const origValue = memory.getWord(testAddr);

      // Test setting and reading a word
      memory.setWord(testAddr, 0xabcd);
      expect(memory.getWord(testAddr)).toBe(0xabcd);

      // Verify byte ordering (big endian)
      expect(memory.getByte(testAddr)).toBe(0xab);
      expect(memory.getByte(testAddr + 1)).toBe(0xcd);

      // Restore original value
      memory.setWord(testAddr, origValue);
    });
  });
});
