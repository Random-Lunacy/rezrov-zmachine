import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameObjectFactory } from '../../../src/core/objects/GameObjectFactory';
import { Logger, LogLevel } from '../../../src/utils/log';
import { MockMemory } from '../../mocks/MockMemory';

describe('GameObjectFactory', () => {
  let mockMemory: MockMemory;
  let mockLogger: Logger;
  let factory: GameObjectFactory;
  const objTableAddr = 0x100;
  const version = 3;

  function setupFactoryMemoryMock() {
    mockMemory.getByte.mockImplementation((addr: number) => {
      // Calculate object entry start based on Z-machine spec
      const objEntriesStart = objTableAddr + 31 * 2;

      // Is this address in the object entries area?
      if (addr >= objEntriesStart) {
        const objNum = Math.floor((addr - objEntriesStart) / 9) + 1;
        // Calculate the base address of this specific object
        const objBase = objEntriesStart + (objNum - 1) * 9;
        // Calculate offset within this object
        const objOffset = addr - objBase;

        if (objOffset < 4) {
          // First 4 bytes are attribute flags
          if (objOffset === 0) {
            if (objNum % 3 === 0) return 0b10000000; // Set attribute 0
            if (objNum % 5 === 0) return 0b01000000; // Set attribute 1
          }
          return 0;
        }

        // Parent object number (byte 4)
        if (objOffset === 4) {
          if (objNum <= 3) return 0;
          return Math.ceil(objNum / 3);
        }

        // Sibling object number (byte 5)
        if (objOffset === 5) {
          const parentGroup = Math.ceil(objNum / 3);
          const indexInGroup = (objNum - 1) % 3;

          if (indexInGroup < 2) {
            return objNum + 1;
          }
          return 0;
        }

        // Child object number (byte 6)
        if (objOffset === 6) {
          if (objNum <= 3) {
            return objNum * 3 + 1;
          }
          return 0;
        }
      }

      // Property table handling
      // For V3, each property table starts with a name length byte,
      // then the encoded name (length * 2 bytes),
      // then the property entries

      // Check if this is accessing a property table
      const propTableStart = 0x200; // Base address for property tables
      if (addr >= propTableStart) {
        // Determine which object's property table this is
        const objNum = Math.floor((addr - propTableStart) / 0x20) + 1;
        const objPropBase = propTableStart + (objNum - 1) * 0x20;

        // First byte in property table is name length
        if (addr === objPropBase) {
          return 5; // Name length in words (could be any value)
        }

        // After name comes property entries
        // Property 1 entry at offset 11
        if (addr === objPropBase + 11) {
          return 0x21; // Property 1: size byte (0x90 | 0x02)
        }

        // Property 2 entry at offset 14
        if (addr === objPropBase + 14) {
          // Only even numbered objects have property 2
          if (objNum % 2 === 0) {
            return 0x82; // Property 2: size byte (0x80 | 0x02)
          }
        }

        // End of property list marker
        if (addr === objPropBase + 16) {
          return 0; // End marker
        }
      }

      return 0;
    });

    mockMemory.getWord.mockImplementation((addr: number) => {
      // Calculate object entry start based on Z-machine spec
      const objEntriesStart = objTableAddr + 31 * 2;

      // Handle property table pointers in object entries
      if (addr >= objEntriesStart) {
        const objRelativeAddr = addr - objEntriesStart;
        if (objRelativeAddr % 9 === 7) {
          const objNum = Math.floor(objRelativeAddr / 9) + 1;
          return 0x200 + objNum * 0x20;
        }
      }

      // Property values
      const propTableStart = 0x200;
      if (addr >= propTableStart) {
        const objNum = Math.floor((addr - propTableStart) / 0x20) + 1;
        const objPropBase = propTableStart + (objNum - 1) * 0x20;

        // Property 1 value at offset 12
        if (addr === objPropBase + 12) {
          return 0x1234;
        }

        // Property 2 value at offset 15
        if (addr === objPropBase + 15) {
          if (objNum % 2 === 0) {
            return 0x5678;
          }
        }
      }

      return 0;
    });
  }

  beforeEach(() => {
    mockMemory = new MockMemory();
    mockLogger = new Logger('TestLogger');
    Logger.setLevel(LogLevel.DEBUG);

    vi.spyOn(mockLogger, 'debug');
    vi.spyOn(mockLogger, 'warn');
    vi.spyOn(mockLogger, 'error');

    setupFactoryMemoryMock();

    factory = new GameObjectFactory(mockMemory as any, version, objTableAddr, { logger: mockLogger });

    // Clear mock call history after setup
    vi.mocked(mockLogger.debug).mockClear();
  });

  describe('Object creation and retrieval', () => {
    it('should create objects with correct object numbers', () => {
      const obj1 = factory.getObject(1);
      const obj2 = factory.getObject(2);

      expect(obj1).not.toBeNull();
      expect(obj2).not.toBeNull();

      expect(obj1?.objNum).toBe(1);
      expect(obj2?.objNum).toBe(2);
    });

    it('should return null for invalid object numbers', () => {
      expect(factory.getObject(0)).toBeNull();
      expect(factory.getObject(-1)).toBeNull();
      expect(factory.getObject(256)).toBeNull(); // V3 max is 255

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid object number'));
    });

    it('should cache objects and reuse them', () => {
      const obj1First = factory.getObject(1);
      const obj1Again = factory.getObject(1);

      expect(obj1First).toBe(obj1Again); // Same instance from cache
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Creating new object 1'));

      // Debug should only be called once for creation
      expect(mockLogger.debug).toHaveBeenCalledTimes(1);
    });

    it('should reset the cache when requested', () => {
      const obj1First = factory.getObject(1);
      factory.resetCache();
      const obj1Again = factory.getObject(1);

      expect(obj1First).not.toBe(obj1Again);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Object cache cleared'));
    });
  });

  describe('Finding objects', () => {
    it('should find objects with specific attributes', () => {
      Logger.setLevel(LogLevel.ERROR);
      const objsWithAttr0 = factory.findObjectsWithAttribute(0);

      // Based on our mock, objects 3, 6, 9... have attribute 0
      expect(objsWithAttr0.length).toBeGreaterThan(0);
      expect(objsWithAttr0[0].objNum % 3).toBe(0);

      const objsWithAttr1 = factory.findObjectsWithAttribute(1);

      // Based on our mock, objects 5, 10... have attribute 1
      expect(objsWithAttr1.length).toBeGreaterThan(0);
      expect(objsWithAttr1[0].objNum % 5).toBe(0);
    });

    it('should find objects with specific properties', () => {
      const objsWithProp1 = factory.findObjectsWithProperty(1);

      // All objects have property 1
      expect(objsWithProp1.length).toBeGreaterThan(0);

      const objsWithProp2 = factory.findObjectsWithProperty(2);

      // Even-numbered objects have property 2
      expect(objsWithProp2.length).toBeGreaterThan(0);
      expect(objsWithProp2.every((obj) => obj.objNum % 2 === 0)).toBe(true);
    });

    it('should find root objects', () => {
      const rootObjs = factory.findRootObjects();

      // First 3 objects are roots
      expect(rootObjs.length).toBe(3);
      expect(rootObjs[0].objNum).toBe(1);
      expect(rootObjs[1].objNum).toBe(2);
      expect(rootObjs[2].objNum).toBe(3);
    });
  });

  describe('Version-specific behavior', () => {
    it('should return correct max objects for different versions', () => {
      expect(factory.getMaxObjects()).toBe(255); // V3

      const factoryV4 = new GameObjectFactory(mockMemory as any, 4, objTableAddr, { logger: mockLogger });
      expect(factoryV4.getMaxObjects()).toBe(65535); // V4+
    });

    it('should handle different object entry sizes for different versions', () => {
      // V3 uses 9-byte object entries
      const obj3 = factory.getObject(3);
      expect(obj3).not.toBeNull();

      // Create a V4 factory to test 14-byte object handling
      // This would need different memory mocking
      const factoryV4 = new GameObjectFactory(mockMemory as any, 4, objTableAddr, { logger: mockLogger });

      // Mock memory to handle V4 object format (14 bytes)
      const v4ObjExtension = vi.spyOn(mockMemory, 'getWord');
      v4ObjExtension.mockImplementation((addr: number) => {
        if ((addr - objTableAddr) % 14 === 12) {
          // Property table addr in V4
          const objNum = Math.floor((addr - objTableAddr) / 14) + 1;
          return 0x200 + objNum * 0x20;
        }
        return 0;
      });

      const obj4 = factoryV4.getObject(3);
      expect(obj4).not.toBeNull();
    });
  });

  describe('Comprehensive object tree', () => {
    it('should return all objects', () => {
      const allObjects = factory.getAllObjects();

      // Should return all valid objects (1-255 for V3)
      expect(allObjects.length).toBe(255);
      expect(allObjects[0].objNum).toBe(1);
      expect(allObjects[allObjects.length - 1].objNum).toBe(255);
    });
  });
});
