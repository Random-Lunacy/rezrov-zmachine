import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Memory } from '../../../src/core/memory/Memory';
import { GameObject } from '../../../src/core/objects/GameObject';
import { GameObjectFactory } from '../../../src/core/objects/GameObjectFactory';
import { MAX_ATTRIBUTES_V3, MAX_ATTRIBUTES_V4 } from '../../../src/utils/constants';
import { Logger, LogLevel } from '../../../src/utils/log';
import { MockMemory } from '../../mocks/MockMemory';

class MockGameObject extends GameObject {
  // A simple map to store object relationships
  private objectMap = new Map<number, GameObject | null>();

  constructor(memory: Memory, version: number, objTable: number, objNum: number, options?: { logger?: Logger }) {
    super(memory, version, objTable, objNum, options);
  }

  // Override the protected getObject method
  protected getObject(objNum: number): GameObject | null {
    return this.objectMap.get(objNum) || null;
  }

  // Simple method to set up object relationships
  public setupRelationships(relationships: Map<number, GameObject | null>): void {
    this.objectMap = new Map(relationships);
  }
}

describe('GameObject', () => {
  let mockMemory: MockMemory;
  let mockLogger: Logger;
  let testObject: GameObject;
  const objNum = 5;
  const objTableAddr = 0x100;
  const version = 3;

  beforeEach(() => {
    mockMemory = new MockMemory();
    mockLogger = new Logger('TestLogger');
    Logger.setLevel(LogLevel.DEBUG);

    mockLogger.warn = vi.fn();
    mockLogger.error = vi.fn();
    mockLogger.debug = vi.fn();

    // Setup default mock implementation for most tests
    setupObjectMemoryMock();

    // Create a mock getObject function we can use
    const mockGetObject = (num: number) => {
      if (num === 0) return null;
      const mockObj = new GameObject(mockMemory as any, version, objTableAddr, num, { logger: mockLogger });
      // Set up the mockObj to use our mockGetObject function
      Object.defineProperty(mockObj, 'getObject', {
        value: mockGetObject,
        configurable: true,
      });
      return mockObj;
    };

    // Create the test object with our mock getObject function
    testObject = new GameObject(mockMemory as any, version, objTableAddr, objNum, { logger: mockLogger });

    // Set up the test object to use our mockGetObject function
    Object.defineProperty(testObject, 'getObject', {
      value: mockGetObject,
      configurable: true,
    });
  });

  function setupObjectMemoryMock() {
    // Default mock implementation for object tests
    mockMemory.getByte.mockImplementation((addr: number) => {
      const calculatedObjAddr = objTableAddr + 31 * 2 + (objNum - 1) * 9;

      // Attribute bytes
      if (addr === calculatedObjAddr) return 0b10101010;
      if (addr === calculatedObjAddr + 1) return 0b01010101;
      if (addr === calculatedObjAddr + 2) return 0b11001100;
      if (addr === calculatedObjAddr + 3) return 0b00110011;

      // Parent, sibling, child
      if (addr === calculatedObjAddr + 4) return 10;
      if (addr === calculatedObjAddr + 5) return 20;
      if (addr === calculatedObjAddr + 6) return 30;

      // Property table setup
      const propTable = 0x200;
      if (addr === propTable) return 5; // Length of name

      // Property 10 (size byte + 2 bytes data)
      if (addr === propTable + 11) return 0x2a;
      if (addr === propTable + 12) return 0x12;
      if (addr === propTable + 13) return 0x34;

      // Property 5 (size byte + 1 byte data)
      if (addr === propTable + 14) return 0x05;
      if (addr === propTable + 15) return 0x56;

      // End of properties
      if (addr === propTable + 16) return 0;

      return 0;
    });

    mockMemory.getWord.mockImplementation((addr: number) => {
      const calculatedObjAddr = objTableAddr + 31 * 2 + (objNum - 1) * 9;

      // Property table address
      if (addr === calculatedObjAddr + 7) return 0x200;

      // Property values as words
      if (addr === 0x200 + 12) return 0x1234;
      if (addr === 0x200 + 15) return 0x56;

      // Default property values
      if (addr >= objTableAddr && addr < objTableAddr + 31 * 2) {
        // Calculate property number from address
        const propNum = Math.floor((addr - objTableAddr) / 2) + 1;
        return 0x1000 + propNum;
      }

      return 0;
    });

    mockMemory.getZString.mockReturnValue(['T', 'e', 's', 't', ' ', 'O', 'b', 'j', 'e', 'c', 't']);
  }

  describe('Constructor', () => {
    it('should calculate object address correctly for V3', () => {
      const v3Obj = new GameObject(mockMemory as any, 3, objTableAddr, 1, { logger: mockLogger });
      // V3: objTable + 31*2 + (objNum-1)*9
      const expectedAddr = objTableAddr + 31 * 2 + (1 - 1) * 9;
      expect(mockMemory.getByte).toHaveBeenCalledWith(expectedAddr);
    });

    it('should calculate object address correctly for V4+', () => {
      mockMemory.getByte.mockReset();
      const v4Obj = new GameObject(mockMemory as any, 4, objTableAddr, 1, { logger: mockLogger });
      // V4+: objTable + 63*2 + (objNum-1)*14
      const expectedAddr = objTableAddr + 63 * 2 + (1 - 1) * 14;
      expect(mockMemory.getByte).toHaveBeenCalledWith(expectedAddr);
    });

    it('should calculate object address correctly for V4+ with different object numbers', () => {
      mockMemory.getByte.mockReset();
      const objNum = 10;
      const v4Obj = new GameObject(mockMemory as any, 5, objTableAddr, objNum, { logger: mockLogger });
      // V4+: objTable + 63*2 + (objNum-1)*14
      const expectedAddr = objTableAddr + 63 * 2 + (objNum - 1) * 14;
      expect(mockMemory.getByte).toHaveBeenCalledWith(expectedAddr);
    });

    it('should throw error when object address is invalid', () => {
      mockMemory.getByte.mockImplementation(() => {
        throw new Error('Invalid memory address');
      });

      expect(() => {
        new GameObject(mockMemory as any, version, objTableAddr, objNum, { logger: mockLogger });
      }).toThrow('Invalid object address for object 5');
    });

    it('should throw error with correct object number in error message', () => {
      mockMemory.getByte.mockImplementation(() => {
        throw new Error('Memory out of bounds');
      });

      expect(() => {
        new GameObject(mockMemory as any, version, objTableAddr, 99, { logger: mockLogger });
      }).toThrow('Invalid object address for object 99');
    });
  });

  describe('Object attributes', () => {
    it('should correctly check if an attribute is set', () => {
      // First byte attributes
      expect(testObject.hasAttribute(0)).toBe(true);
      expect(testObject.hasAttribute(2)).toBe(true);
      expect(testObject.hasAttribute(4)).toBe(true);
      expect(testObject.hasAttribute(6)).toBe(true);

      // Second byte attributes
      expect(testObject.hasAttribute(9)).toBe(true);
      expect(testObject.hasAttribute(11)).toBe(true);
      expect(testObject.hasAttribute(13)).toBe(true);
      expect(testObject.hasAttribute(15)).toBe(true);

      // Attributes that should NOT be set
      expect(testObject.hasAttribute(1)).toBe(false);
      expect(testObject.hasAttribute(3)).toBe(false);
      expect(testObject.hasAttribute(8)).toBe(false);
      expect(testObject.hasAttribute(10)).toBe(false);
    });

    it('should throw an error for out-of-range attributes', () => {
      expect(() => testObject.hasAttribute(-1)).toThrow('Attribute number out of range');
      expect(() => testObject.hasAttribute(MAX_ATTRIBUTES_V3)).toThrow('Attribute number out of range');
    });

    it('should set attributes correctly', () => {
      testObject.setAttribute(8);

      // For attribute 8 (first bit of the second byte)
      const calculatedObjAddr = objTableAddr + 31 * 2 + (objNum - 1) * 9;
      expect(mockMemory.setByte).toHaveBeenCalledWith(calculatedObjAddr + 1, 0b01010101 | 0b10000000);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Set attribute 8'));
    });

    it('should clear attributes correctly', () => {
      testObject.clearAttribute(0);

      // Should clear bit 7 in byte at index 0
      const calculatedObjAddr = objTableAddr + 31 * 2 + (objNum - 1) * 9;
      expect(mockMemory.setByte).toHaveBeenCalledWith(calculatedObjAddr, 0b10101010 & 0b01111111);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Cleared attribute 0'));
    });

    it('should handle maximum attribute correctly for version', () => {
      // Create a V4+ object with more attributes
      const v4Object = new GameObject(mockMemory as any, 4, objTableAddr, objNum, { logger: mockLogger });

      expect(testObject.getMaxAttributes()).toBe(MAX_ATTRIBUTES_V3);
      expect(v4Object.getMaxAttributes()).toBe(MAX_ATTRIBUTES_V4);
    });

    describe('V4+ attributes', () => {
      let v4Object: GameObject;
      const v4Version = 4;
      const v4ObjNum = 5;

      beforeEach(() => {
        mockMemory.getByte.mockReset();
        mockMemory.setByte.mockReset();

        // Setup V4+ object memory (6 attribute bytes)
        const calculatedObjAddr = objTableAddr + 63 * 2 + (v4ObjNum - 1) * 14;

        mockMemory.getByte.mockImplementation((addr: number) => {
          // Attribute bytes (6 bytes for V4+)
          if (addr === calculatedObjAddr) return 0b10101010;
          if (addr === calculatedObjAddr + 1) return 0b01010101;
          if (addr === calculatedObjAddr + 2) return 0b11001100;
          if (addr === calculatedObjAddr + 3) return 0b00110011;
          if (addr === calculatedObjAddr + 4) return 0b11110000;
          if (addr === calculatedObjAddr + 5) return 0b10001111; // Bit 7 set for attribute 40

          // Property table
          if (addr === 0x200) return 5; // Name length
          if (addr === 0x200 + 11) return 0x2a; // Property
          if (addr === 0x200 + 12) return 0x12;
          if (addr === 0x200 + 13) return 0x34;
          if (addr === 0x200 + 14) return 0x05;
          if (addr === 0x200 + 15) return 0x56;
          if (addr === 0x200 + 16) return 0;

          return 0;
        });

        mockMemory.getWord.mockImplementation((addr: number) => {
          const calculatedObjAddr = objTableAddr + 63 * 2 + (v4ObjNum - 1) * 14;
          if (addr === calculatedObjAddr + 12) return 0x200; // Property table
          if (addr === 0x200 + 12) return 0x1234;
          if (addr === 0x200 + 15) return 0x56;
          return 0;
        });

        mockMemory.getZString.mockReturnValue(['T', 'e', 's', 't', ' ', 'O', 'b', 'j', 'e', 'c', 't']);

        const mockGetObject = (num: number) => {
          if (num === 0) return null;
          const mockObj = new GameObject(mockMemory as any, v4Version, objTableAddr, num, { logger: mockLogger });
          Object.defineProperty(mockObj, 'getObject', {
            value: mockGetObject,
            configurable: true,
          });
          return mockObj;
        };

        v4Object = new GameObject(mockMemory as any, v4Version, objTableAddr, v4ObjNum, { logger: mockLogger });
        Object.defineProperty(v4Object, 'getObject', {
          value: mockGetObject,
          configurable: true,
        });
      });

      it('should check attributes correctly for V4+ (48 attributes)', () => {
        // Test attributes in all 6 bytes
        // Byte 0: 0b10101010 = bits 7,5,3,1 set
        // Byte 1: 0b01010101 = bits 6,4,2,0 set (attributes 8,10,12,14)
        // Byte 4: 0b11110000 = bits 7,6,5,4 set (attributes 32,33,34,35)
        // Byte 5: 0b10001111 = bits 7,3,2,1,0 set (attributes 40,43,44,45,46)
        expect(v4Object.hasAttribute(0)).toBe(true); // First byte, bit 7
        expect(v4Object.hasAttribute(2)).toBe(true); // First byte, bit 5
        expect(v4Object.hasAttribute(9)).toBe(true); // Second byte (byte 1), bit 1 (attribute 9 = 8+1)
        expect(v4Object.hasAttribute(32)).toBe(true); // Fifth byte (byte 4), bit 7 (attribute 32)
        expect(v4Object.hasAttribute(40)).toBe(true); // Sixth byte (byte 5), bit 7 (attribute 40)

        expect(v4Object.hasAttribute(1)).toBe(false); // First byte, bit 6 (not set in 0b10101010)
        expect(v4Object.hasAttribute(47)).toBe(true); // Last attribute (last byte, bit 0), should be true
      });

      it('should throw error for out-of-range attributes in V4+', () => {
        expect(() => v4Object.hasAttribute(-1)).toThrow('Attribute number out of range');
        expect(() => v4Object.hasAttribute(MAX_ATTRIBUTES_V4)).toThrow('Attribute number out of range');
        expect(() => v4Object.hasAttribute(48)).toThrow('Attribute number out of range');
      });

      it('should set attributes correctly for V4+', () => {
        const calculatedObjAddr = objTableAddr + 63 * 2 + (v4ObjNum - 1) * 14;
        v4Object.setAttribute(40);

        // Attribute 40 is in byte 5, bit 7
        expect(mockMemory.setByte).toHaveBeenCalledWith(calculatedObjAddr + 5, 0b00001111 | 0b10000000);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Set attribute 40'));
      });

      it('should clear attributes correctly for V4+', () => {
        const calculatedObjAddr = objTableAddr + 63 * 2 + (v4ObjNum - 1) * 14;
        v4Object.clearAttribute(32);

        // Attribute 32 is in byte 4, bit 7
        expect(mockMemory.setByte).toHaveBeenCalledWith(calculatedObjAddr + 4, 0b11110000 & 0b01111111);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Cleared attribute 32'));
      });
    });
  });

  describe('Object relationships', () => {
    it('should get parent object correctly', () => {
      const parent = testObject.parent;
      expect(parent).not.toBeNull();
      expect(parent?.objNum).toBe(10);
    });

    it('should get sibling object correctly', () => {
      const sibling = testObject.sibling;
      expect(sibling).not.toBeNull();
      expect(sibling?.objNum).toBe(20);
    });

    it('should get child object correctly', () => {
      const child = testObject.child;
      expect(child).not.toBeNull();
      expect(child?.objNum).toBe(30);
    });

    it('should set parent correctly', () => {
      const newParent = new GameObject(mockMemory as any, version, objTableAddr, 15, { logger: mockLogger });
      testObject.parent = newParent;

      const calculatedObjAddr = objTableAddr + 31 * 2 + (objNum - 1) * 9;
      expect(mockMemory.setByte).toHaveBeenCalledWith(calculatedObjAddr + 4, 15);
    });

    it('should set parent to null correctly', () => {
      testObject.parent = null;
      const calculatedObjAddr = objTableAddr + 31 * 2 + (objNum - 1) * 9;
      expect(mockMemory.setByte).toHaveBeenCalledWith(calculatedObjAddr + 4, 0);
    });

    it('should set child correctly', () => {
      const newChild = new GameObject(mockMemory as any, version, objTableAddr, 25, { logger: mockLogger });
      testObject.child = newChild;

      const calculatedObjAddr = objTableAddr + 31 * 2 + (objNum - 1) * 9;
      expect(mockMemory.setByte).toHaveBeenCalledWith(calculatedObjAddr + 6, 25);
    });

    it('should set sibling correctly', () => {
      const newSibling = new GameObject(mockMemory as any, version, objTableAddr, 35, { logger: mockLogger });
      testObject.sibling = newSibling;

      const calculatedObjAddr = objTableAddr + 31 * 2 + (objNum - 1) * 9;
      expect(mockMemory.setByte).toHaveBeenCalledWith(calculatedObjAddr + 5, 35);
    });

    describe('V4+ relationships', () => {
      let v4Object: GameObject;
      const v4Version = 4;
      const v4ObjNum = 5;
      const v4ObjTableAddr = 0x100;

      beforeEach(() => {
        mockMemory.getByte.mockReset();
        mockMemory.getWord.mockReset();
        mockMemory.setByte.mockReset();
        mockMemory.setWord.mockReset();

        // Setup V4+ object memory (14-byte entries, 63 default properties)
        const calculatedObjAddr = v4ObjTableAddr + 63 * 2 + (v4ObjNum - 1) * 14;

        mockMemory.getByte.mockImplementation((addr: number) => {
          // Attribute bytes (6 bytes for V4+)
          if (addr >= calculatedObjAddr && addr < calculatedObjAddr + 6) {
            return 0xaa;
          }
          return 0;
        });

        mockMemory.getWord.mockImplementation((addr: number) => {
          // Parent at offset 6 (word)
          if (addr === calculatedObjAddr + 6) return 10;
          // Sibling at offset 8 (word)
          if (addr === calculatedObjAddr + 8) return 20;
          // Child at offset 10 (word)
          if (addr === calculatedObjAddr + 10) return 30;
          // Property table address at offset 12
          if (addr === calculatedObjAddr + 12) return 0x200;
          return 0;
        });

        // Create mock getObject for V4
        const mockGetObject = (num: number) => {
          if (num === 0) return null;
          const mockObj = new GameObject(mockMemory as any, v4Version, v4ObjTableAddr, num, { logger: mockLogger });
          Object.defineProperty(mockObj, 'getObject', {
            value: mockGetObject,
            configurable: true,
          });
          return mockObj;
        };

        v4Object = new GameObject(mockMemory as any, v4Version, v4ObjTableAddr, v4ObjNum, { logger: mockLogger });
        Object.defineProperty(v4Object, 'getObject', {
          value: mockGetObject,
          configurable: true,
        });
      });

      it('should get parent object correctly for V4+', () => {
        const parent = v4Object.parent;
        expect(parent).not.toBeNull();
        expect(parent?.objNum).toBe(10);
        expect(mockMemory.getWord).toHaveBeenCalledWith(v4ObjTableAddr + 63 * 2 + (v4ObjNum - 1) * 14 + 6);
      });

      it('should get sibling object correctly for V4+', () => {
        const sibling = v4Object.sibling;
        expect(sibling).not.toBeNull();
        expect(sibling?.objNum).toBe(20);
        expect(mockMemory.getWord).toHaveBeenCalledWith(v4ObjTableAddr + 63 * 2 + (v4ObjNum - 1) * 14 + 8);
      });

      it('should get child object correctly for V4+', () => {
        const child = v4Object.child;
        expect(child).not.toBeNull();
        expect(child?.objNum).toBe(30);
        expect(mockMemory.getWord).toHaveBeenCalledWith(v4ObjTableAddr + 63 * 2 + (v4ObjNum - 1) * 14 + 10);
      });

      it('should set parent correctly for V4+', () => {
        const newParent = new GameObject(mockMemory as any, v4Version, v4ObjTableAddr, 15, { logger: mockLogger });
        v4Object.parent = newParent;

        const calculatedObjAddr = v4ObjTableAddr + 63 * 2 + (v4ObjNum - 1) * 14;
        expect(mockMemory.setWord).toHaveBeenCalledWith(calculatedObjAddr + 6, 15);
      });

      it('should set parent to null correctly for V4+', () => {
        v4Object.parent = null;
        const calculatedObjAddr = v4ObjTableAddr + 63 * 2 + (v4ObjNum - 1) * 14;
        expect(mockMemory.setWord).toHaveBeenCalledWith(calculatedObjAddr + 6, 0);
      });

      it('should set child correctly for V4+', () => {
        const newChild = new GameObject(mockMemory as any, v4Version, v4ObjTableAddr, 25, { logger: mockLogger });
        v4Object.child = newChild;

        const calculatedObjAddr = v4ObjTableAddr + 63 * 2 + (v4ObjNum - 1) * 14;
        expect(mockMemory.setWord).toHaveBeenCalledWith(calculatedObjAddr + 10, 25);
      });

      it('should set sibling correctly for V4+', () => {
        const newSibling = new GameObject(mockMemory as any, v4Version, v4ObjTableAddr, 35, { logger: mockLogger });
        v4Object.sibling = newSibling;

        const calculatedObjAddr = v4ObjTableAddr + 63 * 2 + (v4ObjNum - 1) * 14;
        expect(mockMemory.setWord).toHaveBeenCalledWith(calculatedObjAddr + 8, 35);
      });

      it('should return null when parent is 0 for V4+', () => {
        mockMemory.getWord.mockImplementation((addr: number) => {
          const calculatedObjAddr = v4ObjTableAddr + 63 * 2 + (v4ObjNum - 1) * 14;
          if (addr === calculatedObjAddr + 6) return 0; // Parent is 0
          return 0;
        });

        expect(v4Object.parent).toBeNull();
      });

      it('should return null when sibling is 0 for V4+', () => {
        mockMemory.getWord.mockImplementation((addr: number) => {
          const calculatedObjAddr = v4ObjTableAddr + 63 * 2 + (v4ObjNum - 1) * 14;
          if (addr === calculatedObjAddr + 8) return 0; // Sibling is 0
          return 0;
        });

        expect(v4Object.sibling).toBeNull();
      });

      it('should return null when child is 0 for V4+', () => {
        mockMemory.getWord.mockImplementation((addr: number) => {
          const calculatedObjAddr = v4ObjTableAddr + 63 * 2 + (v4ObjNum - 1) * 14;
          if (addr === calculatedObjAddr + 10) return 0; // Child is 0
          return 0;
        });

        expect(v4Object.child).toBeNull();
      });
    });

    describe('Relationship error handling', () => {
      it('should handle errors when getting parent and return null', () => {
        // Setup memory so constructor succeeds
        const calculatedObjAddr = objTableAddr + 31 * 2 + (objNum - 1) * 9;
        mockMemory.getByte.mockImplementation((addr: number) => {
          // Allow constructor to succeed
          if (addr === calculatedObjAddr) return 0xaa;
          // Throw error when reading parent
          if (addr === calculatedObjAddr + 4) {
            throw new Error('Memory access error');
          }
          return 0;
        });

        const errorObject = new GameObject(mockMemory as any, version, objTableAddr, objNum, { logger: mockLogger });
        Object.defineProperty(errorObject, 'getObject', {
          value: () => {
            throw new Error('getObject error');
          },
          configurable: true,
        });

        const parent = errorObject.parent;
        expect(parent).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Error accessing parent'));
      });

      it('should handle errors when getting sibling and return null', () => {
        // Setup memory so constructor succeeds
        const calculatedObjAddr = objTableAddr + 31 * 2 + (objNum - 1) * 9;
        mockMemory.getByte.mockImplementation((addr: number) => {
          // Allow constructor to succeed
          if (addr === calculatedObjAddr) return 0xaa;
          // Throw error when reading sibling
          if (addr === calculatedObjAddr + 5) {
            throw new Error('Memory access error');
          }
          return 0;
        });

        const errorObject = new GameObject(mockMemory as any, version, objTableAddr, objNum, { logger: mockLogger });
        Object.defineProperty(errorObject, 'getObject', {
          value: () => {
            throw new Error('getObject error');
          },
          configurable: true,
        });

        const sibling = errorObject.sibling;
        expect(sibling).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Error accessing sibling'));
      });

      it('should handle errors when getting child and return null', () => {
        // Setup memory so constructor succeeds
        const calculatedObjAddr = objTableAddr + 31 * 2 + (objNum - 1) * 9;
        mockMemory.getByte.mockImplementation((addr: number) => {
          // Allow constructor to succeed
          if (addr === calculatedObjAddr) return 0xaa;
          // Throw error when reading child
          if (addr === calculatedObjAddr + 6) {
            throw new Error('Memory access error');
          }
          return 0;
        });

        const errorObject = new GameObject(mockMemory as any, version, objTableAddr, objNum, { logger: mockLogger });
        Object.defineProperty(errorObject, 'getObject', {
          value: () => {
            throw new Error('getObject error');
          },
          configurable: true,
        });

        const child = errorObject.child;
        expect(child).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Error accessing child'));
      });
    });
  });

  describe('Object properties', () => {
    it('should get property correctly', () => {
      // Verify property 10 with value 0x1234 and property 5 with value 0x56
      expect(testObject.getProperty(10)).toBe(0x1234);
      expect(testObject.getProperty(5)).toBe(0x56);
    });

    it('should get default property when property not found', () => {
      // Property 3 not defined in our object, should get default from object table
      expect(testObject.getProperty(3)).toBe(0x1000 + 3);
    });

    it('should get property address correctly', () => {
      expect(testObject.getPropertyAddress(10)).toBe(0x200 + 12);
      expect(testObject.getPropertyAddress(5)).toBe(0x200 + 15);
      expect(testObject.getPropertyAddress(3)).toBe(0); // Not found
    });

    it('should put property value correctly', () => {
      testObject.putProperty(10, 0x9876);

      expect(mockMemory.setWord).toHaveBeenCalledWith(0x200 + 12, 0x9876);
    });

    it('should throw error when putting non-existent property', () => {
      expect(() => testObject.putProperty(3, 0x9876)).toThrow('Property 3 not found');
    });

    it('should get next property correctly', () => {
      expect(testObject.getNextProperty(0)).toBe(10); // First property
      expect(testObject.getNextProperty(10)).toBe(5); // Next property
      expect(testObject.getNextProperty(5)).toBe(0); // No more properties
    });

    it('should throw error getting next of non-existent property', () => {
      expect(() => testObject.getNextProperty(3)).toThrow('Property 3 not found');
    });

    describe('Property edge cases', () => {
      it('should handle 1-byte property in putProperty', () => {
        // Property 5 is a 1-byte property (size byte 0x05)
        testObject.putProperty(5, 0xab);

        expect(mockMemory.setByte).toHaveBeenCalledWith(0x200 + 15, 0xab);
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });

      it('should handle 3+ byte property in getProperty', () => {
        // Setup a 4-byte property (0x6a = 01101010, top 3 bits = 011, length = 3 + 1 = 4)
        mockMemory.getByte.mockImplementation((addr: number) => {
          const calculatedObjAddr = objTableAddr + 31 * 2 + (objNum - 1) * 9;
          const propTable = 0x200;

          // Attribute bytes
          if (addr >= calculatedObjAddr && addr < calculatedObjAddr + 4) return 0xaa;

          // Parent, sibling, child
          if (addr === calculatedObjAddr + 4) return 0;
          if (addr === calculatedObjAddr + 5) return 0;
          if (addr === calculatedObjAddr + 6) return 0;

          // Property table
          if (addr === propTable) return 5; // Name length

          // Property 10 with 4-byte data (size byte 0x6a = 01101010, length = (011 >> 5) + 1 = 4)
          if (addr === propTable + 11) return 0x6a; // Size byte indicating 4-byte property
          if (addr === propTable + 12) return 0x12;
          if (addr === propTable + 13) return 0x34;
          if (addr === propTable + 14) return 0x56;
          if (addr === propTable + 15) return 0x78;

          // End of properties
          if (addr === propTable + 16) return 0;

          return 0;
        });

        mockMemory.getWord.mockImplementation((addr: number) => {
          const calculatedObjAddr = objTableAddr + 31 * 2 + (objNum - 1) * 9;
          if (addr === calculatedObjAddr + 7) return 0x200;
          // Return word value for 4-byte property (should read first 2 bytes)
          if (addr === 0x200 + 12) return 0x3412; // Little-endian word
          return 0;
        });

        const value = testObject.getProperty(10);
        // Should read as word (first 2 bytes)
        expect(value).toBe(0x3412);
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Reading 4-byte property as word'));
      });

      it('should handle 3+ byte property in putProperty', () => {
        // Setup a 4-byte property
        mockMemory.getByte.mockImplementation((addr: number) => {
          const calculatedObjAddr = objTableAddr + 31 * 2 + (objNum - 1) * 9;
          const propTable = 0x200;

          // Attribute bytes
          if (addr >= calculatedObjAddr && addr < calculatedObjAddr + 4) return 0xaa;

          // Parent, sibling, child
          if (addr === calculatedObjAddr + 4) return 0;
          if (addr === calculatedObjAddr + 5) return 0;
          if (addr === calculatedObjAddr + 6) return 0;

          // Property table
          if (addr === propTable) return 5; // Name length

          // Property 10 with 4-byte property
          if (addr === propTable + 11) return 0x6a; // Size byte
          if (addr === propTable + 12) return 0x12;
          if (addr === propTable + 13) return 0x34;
          if (addr === propTable + 14) return 0x56;
          if (addr === propTable + 15) return 0x78;

          // End of properties
          if (addr === propTable + 16) return 0;

          return 0;
        });

        mockMemory.getWord.mockImplementation((addr: number) => {
          const calculatedObjAddr = objTableAddr + 31 * 2 + (objNum - 1) * 9;
          if (addr === calculatedObjAddr + 7) return 0x200;
          return 0;
        });

        testObject.putProperty(10, 0x9876);

        // Should write as word (first 2 bytes)
        expect(mockMemory.setWord).toHaveBeenCalledWith(0x200 + 12, 0x9876);
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Writing to 4-byte property 10'));
      });

      it('should throw error when putting non-existent property', () => {
        expect(() => testObject.putProperty(99, 0x9876)).toThrow('Property 99 not found');
      });
    });

    describe('Default property value errors', () => {
      it('should throw error for property number 0', () => {
        expect(() => testObject.getProperty(0)).toThrow('Invalid property number: 0');
      });

      it('should throw error for negative property number', () => {
        expect(() => testObject.getProperty(-1)).toThrow('Invalid property number: -1');
      });

      it('should throw error for property number > MAX_PROPERTIES_V3', () => {
        expect(() => testObject.getProperty(32)).toThrow('Invalid property number: 32');
      });

      it('should throw error for property number > MAX_PROPERTIES_V4', () => {
        const v4Object = new GameObject(mockMemory as any, 4, objTableAddr, objNum, { logger: mockLogger });
        expect(() => v4Object.getProperty(64)).toThrow('Invalid property number: 64');
      });
    });
  });

  describe('Object unlinking', () => {
    it("should unlink from parent when it is parent's child", () => {
      // Clear previous mocks
      mockMemory.getByte.mockReset();
      mockMemory.setByte.mockReset();

      const parentObjNum = 10;
      const childObjNum = 5;

      // Calculate base addresses
      const parentBase = objTableAddr + 31 * 2 + (parentObjNum - 1) * 9;
      const childBase = objTableAddr + 31 * 2 + (childObjNum - 1) * 9;

      // Create objects
      const parentObject = new MockGameObject(mockMemory as any, version, objTableAddr, parentObjNum);
      const testObject = new MockGameObject(mockMemory as any, version, objTableAddr, childObjNum);

      // Set up relationships using the public setupRelationships method
      const relationships = new Map<number, GameObject | null>();
      relationships.set(parentObjNum, parentObject);
      relationships.set(0, null);
      testObject.setupRelationships(relationships);

      const parentRelationships = new Map<number, GameObject | null>();
      parentRelationships.set(childObjNum, testObject);
      parentRelationships.set(0, null);
      parentObject.setupRelationships(parentRelationships);

      // Mock memory to return proper parent-child relationships
      mockMemory.getByte.mockImplementation((addr: number) => {
        // Calculate the parent and child object addresses
        const parentBase = objTableAddr + 31 * 2 + (parentObjNum - 1) * 9;
        const childBase = objTableAddr + 31 * 2 + (childObjNum - 1) * 9;

        // When reading parent's child field (at offset 6), return child's object number
        if (addr === parentBase + 6) return childObjNum;

        // When reading child's parent field (at offset 4), return parentObjNum;
        if (addr === childBase + 4) return parentObjNum;

        return 0;
      });

      // Perform the unlink operation
      testObject.unlink();

      // We expect these calls to have happened:
      // - Child's parent field set to 0
      // - Parent's child field set to 0
      expect(mockMemory.setByte).toHaveBeenCalledWith(childBase + 4, 0); // Child's parent = 0
      expect(mockMemory.setByte).toHaveBeenCalledWith(parentBase + 6, 0); // Parent's child = 0
    });

    it('should handle unlinking when object is a sibling', () => {
      // Clear previous mocks
      mockMemory.getByte.mockReset();
      mockMemory.setByte.mockReset();

      const parentObjNum = 10;
      const siblingObjNum = 20;
      const objNum = 5;

      // Calculate base addresses
      const parentBase = objTableAddr + 31 * 2 + (parentObjNum - 1) * 9;
      const siblingBase = objTableAddr + 31 * 2 + (siblingObjNum - 1) * 9;
      const objBase = objTableAddr + 31 * 2 + (objNum - 1) * 9;

      // Create objects
      const parentObject = new MockGameObject(mockMemory as any, version, objTableAddr, parentObjNum);
      const siblingObject = new MockGameObject(mockMemory as any, version, objTableAddr, siblingObjNum);
      const testObject = new MockGameObject(mockMemory as any, version, objTableAddr, objNum);

      // Set up relationships
      const objRelationships = new Map<number, GameObject | null>();
      objRelationships.set(parentObjNum, parentObject);
      objRelationships.set(siblingObjNum, siblingObject);
      objRelationships.set(0, null);
      testObject.setupRelationships(objRelationships);

      const siblingRelationships = new Map<number, GameObject | null>();
      siblingRelationships.set(parentObjNum, parentObject);
      siblingRelationships.set(objNum, testObject);
      siblingRelationships.set(0, null);
      siblingObject.setupRelationships(siblingRelationships);

      const parentRelationships = new Map<number, GameObject | null>();
      parentRelationships.set(siblingObjNum, siblingObject);
      parentRelationships.set(0, null);
      parentObject.setupRelationships(parentRelationships);

      // Mock memory to return proper relationship structure
      mockMemory.getByte.mockImplementation((addr: number) => {
        // Parent's child field points to siblingObject
        if (addr === parentBase + 6) return siblingObjNum;

        // Sibling's parent field points to parent
        if (addr === siblingBase + 4) return parentObjNum;

        // Sibling's sibling field points to testObject
        if (addr === siblingBase + 5) return objNum;

        // TestObject's parent field points to parent
        if (addr === objBase + 4) return parentObjNum;

        return 0;
      });

      // Verify relationships are set up correctly
      expect(parentObject.child?.objNum).toBe(siblingObjNum);
      expect(siblingObject.parent?.objNum).toBe(parentObjNum);
      expect(siblingObject.sibling?.objNum).toBe(objNum);
      expect(testObject.parent?.objNum).toBe(parentObjNum);

      // Perform the unlink operation
      testObject.unlink();

      // Check memory updates - we expect the child's parent and sibling pointers to be cleared,
      // and the sibling's sibling pointer to be cleared
      expect(mockMemory.setByte).toHaveBeenCalledWith(objBase + 4, 0); // Test object's parent field
      expect(mockMemory.setByte).toHaveBeenCalledWith(objBase + 5, 0); // Test object's sibling field
      expect(mockMemory.setByte).toHaveBeenCalledWith(siblingBase + 5, 0); // Sibling's sibling field
    });

    it('should do nothing when object has no parent', () => {
      // Clear previous mocks
      mockMemory.getByte.mockReset();
      mockMemory.setByte.mockReset();

      const objNum = 5;
      const objBase = objTableAddr + 31 * 2 + (objNum - 1) * 9;

      // Create test object
      const testObject = new MockGameObject(mockMemory as any, version, objTableAddr, objNum);

      // Set up relationships - in this case, no parent
      const relationships = new Map<number, GameObject | null>();
      relationships.set(0, null);
      testObject.setupRelationships(relationships);

      // Mock memory to return 0 for parent field (no parent)
      mockMemory.getByte.mockImplementation((addr: number) => {
        // Object's parent field is 0 (no parent)
        if (addr === objBase + 4) return 0;
        return 0;
      });

      // Verify initial state
      expect(testObject.parent).toBeNull();

      // Perform the unlink operation
      testObject.unlink();

      // Since there was no parent, no memory updates should have happened
      expect(mockMemory.setByte).not.toHaveBeenCalled();
    });

    describe('Unlink error handling', () => {
      it('should handle errors when accessing parent during unlink', () => {
        mockMemory.getByte.mockReset();
        mockMemory.setByte.mockReset();

        const objNum = 5;
        const objBase = objTableAddr + 31 * 2 + (objNum - 1) * 9;

        const testObject = new MockGameObject(mockMemory as any, version, objTableAddr, objNum);
        const relationships = new Map<number, GameObject | null>();
        relationships.set(0, null);
        testObject.setupRelationships(relationships);

        // Mock memory to throw error when reading parent
        mockMemory.getByte.mockImplementation((addr: number) => {
          if (addr === objBase + 4) {
            throw new Error('Memory access error');
          }
          return 0;
        });

        // Should not throw, but handle gracefully
        expect(() => testObject.unlink()).not.toThrow();
      });

      it('should handle errors when accessing child during unlink', () => {
        mockMemory.getByte.mockReset();
        mockMemory.setByte.mockReset();

        const parentObjNum = 10;
        const childObjNum = 5;
        const parentBase = objTableAddr + 31 * 2 + (parentObjNum - 1) * 9;
        const childBase = objTableAddr + 31 * 2 + (childObjNum - 1) * 9;

        const parentObject = new MockGameObject(mockMemory as any, version, objTableAddr, parentObjNum);
        const testObject = new MockGameObject(mockMemory as any, version, objTableAddr, childObjNum);

        const objRelationships = new Map<number, GameObject | null>();
        objRelationships.set(parentObjNum, parentObject);
        objRelationships.set(0, null);
        testObject.setupRelationships(objRelationships);

        const parentRelationships = new Map<number, GameObject | null>();
        parentRelationships.set(childObjNum, testObject);
        parentRelationships.set(0, null);
        parentObject.setupRelationships(parentRelationships);

        // Mock memory to throw error when reading child
        mockMemory.getByte.mockImplementation((addr: number) => {
          if (addr === childBase + 4) return parentObjNum;
          if (addr === parentBase + 6) {
            throw new Error('Memory access error');
          }
          return 0;
        });

        // Should handle error gracefully
        expect(() => testObject.unlink()).not.toThrow();
      });

      it('should handle errors when accessing sibling during unlink', () => {
        mockMemory.getByte.mockReset();
        mockMemory.setByte.mockReset();

        const parentObjNum = 10;
        const siblingObjNum = 20;
        const objNum = 5;
        const parentBase = objTableAddr + 31 * 2 + (parentObjNum - 1) * 9;
        const siblingBase = objTableAddr + 31 * 2 + (siblingObjNum - 1) * 9;
        const objBase = objTableAddr + 31 * 2 + (objNum - 1) * 9;

        const parentObject = new MockGameObject(mockMemory as any, version, objTableAddr, parentObjNum);
        const siblingObject = new MockGameObject(mockMemory as any, version, objTableAddr, siblingObjNum);
        const testObject = new MockGameObject(mockMemory as any, version, objTableAddr, objNum);

        const objRelationships = new Map<number, GameObject | null>();
        objRelationships.set(parentObjNum, parentObject);
        objRelationships.set(siblingObjNum, siblingObject);
        objRelationships.set(0, null);
        testObject.setupRelationships(objRelationships);

        const siblingRelationships = new Map<number, GameObject | null>();
        siblingRelationships.set(parentObjNum, parentObject);
        siblingRelationships.set(objNum, testObject);
        siblingRelationships.set(0, null);
        siblingObject.setupRelationships(siblingRelationships);

        const parentRelationships = new Map<number, GameObject | null>();
        parentRelationships.set(siblingObjNum, siblingObject);
        parentRelationships.set(0, null);
        parentObject.setupRelationships(parentRelationships);

        // Mock memory to throw error when reading sibling
        mockMemory.getByte.mockImplementation((addr: number) => {
          if (addr === parentBase + 6) return siblingObjNum;
          if (addr === siblingBase + 4) return parentObjNum;
          if (addr === siblingBase + 5) {
            throw new Error('Memory access error');
          }
          if (addr === objBase + 4) return parentObjNum;
          return 0;
        });

        // Should handle error gracefully
        expect(() => testObject.unlink()).not.toThrow();
      });
    });
  });

  describe('Static utility methods', () => {
    beforeEach(() => {
      // Reset mocks before each test
      mockMemory.getByte.mockReset();
    });
    it('should calculate property data length correctly for V3', () => {
      // In V3, the property length is (sizeByte >> 5) & 0x7) + 1
      // 0x92 = 10010010, so (0x92 >> 5) & 0x7 = 100 & 111 = 100 = 4
      // Length should be 4 + 1 = 5
      mockMemory.getByte.mockImplementation((addr: number) => {
        if (addr === 0x200 + 11) return 0x92; // Size byte with length 5
        return 0;
      });

      expect(GameObject['_propDataLen'](mockMemory as any, 3, 0x200 + 11)).toBe(5);
    });

    it('should calculate property data length correctly for V4+ with high bit set', () => {
      // In V4+ with high bit set, the length is in bits 0-5 of second byte
      // 0xc0 = 11000000 (first byte with high bit set, property number 0)
      // 0x82 = 10000010 (second byte with high bit set, length 2)
      mockMemory.getByte.mockImplementation((addr: number) => {
        if (addr === 0x300) return 0xc0;
        if (addr === 0x301) return 0x82; // This should be 0x82 for length 2
        return 0;
      });

      expect(GameObject['_propDataLen'](mockMemory as any, 5, 0x300)).toBe(2);
    });

    it('should calculate property data length correctly for V4+ simple format (bit 7 clear)', () => {
      // V4+ simple format: bit 7 clear, length in top 2 bits + 1
      // 0x40 = 01000000 (bit 7 clear, top 2 bits = 01, so length = 1 + 1 = 2)
      mockMemory.getByte.mockImplementation((addr: number) => {
        if (addr === 0x300) return 0x40;
        return 0;
      });

      expect(GameObject['_propDataLen'](mockMemory as any, 4, 0x300)).toBe(2);
    });

    it('should calculate property data length correctly for V4+ simple format with different lengths', () => {
      // Test various lengths in simple format
      // 0x80 = 10000000 (bit 7 set, so not simple format)
      // 0x00 = 00000000 (bit 7 clear, top 2 bits = 00, length = 0 + 1 = 1)
      mockMemory.getByte.mockImplementation((addr: number) => {
        if (addr === 0x300) return 0x00;
        return 0;
      });

      expect(GameObject['_propDataLen'](mockMemory as any, 4, 0x300)).toBe(1);

      // Test length 2: 0x40 = 01000000 (bit 7 clear, top 2 bits = 01, length = 1 + 1 = 2)
      mockMemory.getByte.mockImplementation((addr: number) => {
        if (addr === 0x300) return 0x40;
        return 0;
      });

      expect(GameObject['_propDataLen'](mockMemory as any, 4, 0x300)).toBe(2);
    });

    it('should return 64 when V4+ long format size byte is 0', () => {
      // V4+ long format: bit 7 set, size in second byte
      // If size byte is 0, should return 64
      mockMemory.getByte.mockImplementation((addr: number) => {
        if (addr === 0x300) return 0x80; // High bit set
        if (addr === 0x301) return 0x00; // Size byte is 0
        return 0;
      });

      expect(GameObject['_propDataLen'](mockMemory as any, 4, 0x300)).toBe(64);
    });

    it('should get entry from data pointer correctly', () => {
      // For V3 test
      mockMemory.getByte.mockImplementation((addr: number) => {
        if (addr === 0x200 + 11) return 0x2a; // Size byte for V3
        // For V4+ test with high bit set in first byte
        if (addr === 0x301) return 0x80 | 0x00; // High bit set
        return 0;
      });

      // V3 format - simply subtracts 1 from data pointer
      expect(GameObject.entryFromDataPtr(0x200 + 12, mockMemory as any, 3)).toBe(0x200 + 11);

      // V4+ format with high bit set - subtract 2 from data pointer
      expect(GameObject.entryFromDataPtr(0x300 + 2, mockMemory as any, 5)).toBe(0x300);
    });

    it('should get entry from data pointer correctly for V4+ with bit 7 clear', () => {
      // V4+ with bit 7 clear - should subtract 1 (like V3)
      mockMemory.getByte.mockImplementation((addr: number) => {
        if (addr === 0x300 - 1) return 0x40; // Bit 7 clear
        return 0;
      });

      expect(GameObject.entryFromDataPtr(0x300, mockMemory as any, 4)).toBe(0x300 - 1);
    });

    it('should get entry from data pointer correctly for V3 when previous byte has bit 7 set', () => {
      // V3 should always subtract 1, even if previous byte has bit 7 set
      mockMemory.getByte.mockImplementation((addr: number) => {
        if (addr === 0x200 + 11) return 0x2a; // Size byte for V3
        return 0;
      });

      expect(GameObject.entryFromDataPtr(0x200 + 12, mockMemory as any, 3)).toBe(0x200 + 11);
    });

    it('should get property length correctly', () => {
      // Setup for property length test
      mockMemory.getByte.mockImplementation((addr: number) => {
        if (addr === 0x200 + 11) return 0x52; // Size byte indicating length 2
        return 0;
      });

      expect(GameObject.getPropertyLength(mockMemory as any, 3, 0x200 + 12)).toBe(3);
      expect(GameObject.getPropertyLength(mockMemory as any, 3, 0)).toBe(0);
    });

    it('should get property length correctly for V4+ with simple format', () => {
      // V4+ simple format: bit 7 clear
      mockMemory.getByte.mockImplementation((addr: number) => {
        if (addr === 0x300 - 1) return 0x40; // Bit 7 clear, size in top 2 bits
        return 0;
      });

      expect(GameObject.getPropertyLength(mockMemory as any, 4, 0x300)).toBe(2);
    });

    it('should get property length correctly for V4+ with long format', () => {
      // V4+ long format: bit 7 set, size in next byte
      // Flow: getPropertyLength(0x300) -> entryFromDataPtr(0x300) -> _propDataLen(entry)
      // entryFromDataPtr checks 0x300 - 1 = 0x2ff, if bit 7 set, returns 0x300 - 2 = 0x2fe
      // _propDataLen(0x2fe) reads 0x2fe (entry), if bit 7 set, reads 0x2ff (size)
      mockMemory.getByte.mockImplementation((addr: number) => {
        if (addr === 0x2fe) return 0x80; // Entry byte (bit 7 set)
        if (addr === 0x2ff) return 0x85; // Check byte (bit 7 set for entryFromDataPtr) AND size byte (size = 5)
        return 0;
      });

      // getPropertyLength(0x300):
      // 1. entryFromDataPtr checks 0x2ff, sees 0x85 (bit 7 set), returns 0x2fe
      // 2. _propDataLen(0x2fe) reads 0x2fe, gets 0x80 (bit 7 set), reads 0x2ff, gets 0x85 & 0x3f = 5
      expect(GameObject.getPropertyLength(mockMemory as any, 4, 0x300)).toBe(5);
    });
  });

  describe('V4+ property handling', () => {
    let v4Object: GameObject;
    const v4Version = 4;
    const v4ObjNum = 5;
    const propTable = 0x200;

    beforeEach(() => {
      mockMemory.getByte.mockReset();
      mockMemory.getWord.mockReset();
      mockMemory.setByte.mockReset();
      mockMemory.setWord.mockReset();

      const calculatedObjAddr = objTableAddr + 63 * 2 + (v4ObjNum - 1) * 14;
      const propTable = 0x200;

      mockMemory.getByte.mockImplementation((addr: number) => {
        // Attribute bytes
        if (addr >= calculatedObjAddr && addr < calculatedObjAddr + 6) return 0xaa;

        // Parent, sibling, child (not used in these tests)
        if (addr >= calculatedObjAddr + 6 && addr < calculatedObjAddr + 12) return 0;

        // Property table
        if (addr === propTable) return 5; // Name length

        // Property 10 with long format (bit 7 set): size byte at propTable+11, data starts at propTable+13
        if (addr === propTable + 11) return 0x8a; // High bit set, property 10
        if (addr === propTable + 12) return 0x02; // Size byte: length 2
        if (addr === propTable + 13) return 0x12; // Data byte 1
        if (addr === propTable + 14) return 0x34; // Data byte 2

        // Property 5 with simple format (bit 7 clear): size byte at propTable+15, data at propTable+16
        if (addr === propTable + 15) return 0x05; // Bit 7 clear, property 5, length 1
        if (addr === propTable + 16) return 0x56; // Data byte

        // End of properties
        if (addr === propTable + 17) return 0;

        return 0;
      });

      mockMemory.getWord.mockImplementation((addr: number) => {
        if (addr === calculatedObjAddr + 12) return propTable;
        if (addr === propTable + 13) return 0x3412; // Property 10 value
        if (addr === propTable + 16) return 0x56; // Property 5 value
        return 0;
      });

      mockMemory.getZString.mockReturnValue(['T', 'e', 's', 't', ' ', 'O', 'b', 'j', 'e', 'c', 't']);

      const mockGetObject = (num: number) => {
        if (num === 0) return null;
        const mockObj = new GameObject(mockMemory as any, v4Version, objTableAddr, num, { logger: mockLogger });
        Object.defineProperty(mockObj, 'getObject', {
          value: mockGetObject,
          configurable: true,
        });
        return mockObj;
      };

      v4Object = new GameObject(mockMemory as any, v4Version, objTableAddr, v4ObjNum, { logger: mockLogger });
      Object.defineProperty(v4Object, 'getObject', {
        value: mockGetObject,
        configurable: true,
      });
    });

    it('should get property correctly for V4+ with long format', () => {
      // Property 10 uses long format (bit 7 set), so data pointer is propAddr + 2
      const value = v4Object.getProperty(10);
      expect(value).toBe(0x3412);
      // Should read from propTable + 13 (propAddr + 2)
      expect(mockMemory.getWord).toHaveBeenCalledWith(propTable + 13);
    });

    it('should get property correctly for V4+ with simple format', () => {
      // Property 5 uses simple format (bit 7 clear), so data pointer is propAddr + 1
      const value = v4Object.getProperty(5);
      expect(value).toBe(0x56);
      // Should read from propTable + 16 (propAddr + 1)
      expect(mockMemory.getByte).toHaveBeenCalledWith(propTable + 16);
    });

    it('should get property address correctly for V4+ long format', () => {
      const addr = v4Object.getPropertyAddress(10);
      // Long format: propAddr + 2 = propTable + 11 + 2 = propTable + 13
      expect(addr).toBe(propTable + 13);
    });

    it('should get property address correctly for V4+ simple format', () => {
      const addr = v4Object.getPropertyAddress(5);
      // Simple format: propAddr + 1 = propTable + 15 + 1 = propTable + 16
      expect(addr).toBe(propTable + 16);
    });

    it('should put property correctly for V4+ long format', () => {
      v4Object.putProperty(10, 0x9876);
      // Should write to propTable + 13
      expect(mockMemory.setWord).toHaveBeenCalledWith(propTable + 13, 0x9876);
    });

    it('should put property correctly for V4+ simple format', () => {
      v4Object.putProperty(5, 0xab);
      // Should write to propTable + 16
      expect(mockMemory.setByte).toHaveBeenCalledWith(propTable + 16, 0xab);
    });

    it('should get next property correctly for V4+', () => {
      // Properties are in descending order: 10, then 5
      expect(v4Object.getNextProperty(0)).toBe(10);
      expect(v4Object.getNextProperty(10)).toBe(5);
      expect(v4Object.getNextProperty(5)).toBe(0);
    });
  });

  describe('Name getter', () => {
    it('should return invalid object message when property table address is 0', () => {
      mockMemory.getWord.mockImplementation((addr: number) => {
        const calculatedObjAddr = objTableAddr + 31 * 2 + (objNum - 1) * 9;
        if (addr === calculatedObjAddr + 7) return 0; // Property table address is 0
        return 0;
      });

      const name = testObject.name;
      expect(name).toBe(`[Invalid Object ${objNum}]`);
    });

    it('should return unnamed object message when name length is 0', () => {
      mockMemory.getByte.mockImplementation((addr: number) => {
        const calculatedObjAddr = objTableAddr + 31 * 2 + (objNum - 1) * 9;
        const propTable = 0x200;

        // Attribute bytes
        if (addr >= calculatedObjAddr && addr < calculatedObjAddr + 4) return 0xaa;

        // Parent, sibling, child
        if (addr === calculatedObjAddr + 4) return 0;
        if (addr === calculatedObjAddr + 5) return 0;
        if (addr === calculatedObjAddr + 6) return 0;

        // Property table - name length is 0
        if (addr === propTable) return 0;

        return 0;
      });

      mockMemory.getWord.mockImplementation((addr: number) => {
        const calculatedObjAddr = objTableAddr + 31 * 2 + (objNum - 1) * 9;
        if (addr === calculatedObjAddr + 7) return 0x200;
        return 0;
      });

      const name = testObject.name;
      expect(name).toBe(`[Unnamed Object ${objNum}]`);
    });

    it('should handle memory access errors when reading name words', () => {
      mockMemory.getByte.mockImplementation((addr: number) => {
        const calculatedObjAddr = objTableAddr + 31 * 2 + (objNum - 1) * 9;
        const propTable = 0x200;

        // Attribute bytes
        if (addr >= calculatedObjAddr && addr < calculatedObjAddr + 4) return 0xaa;

        // Parent, sibling, child
        if (addr === calculatedObjAddr + 4) return 0;
        if (addr === calculatedObjAddr + 5) return 0;
        if (addr === calculatedObjAddr + 6) return 0;

        // Property table
        if (addr === propTable) return 5; // Name length

        return 0;
      });

      mockMemory.getWord.mockImplementation((addr: number) => {
        const calculatedObjAddr = objTableAddr + 31 * 2 + (objNum - 1) * 9;
        if (addr === calculatedObjAddr + 7) return 0x200;

        // Throw error when reading name words
        if (addr >= 0x200 + 1 && addr < 0x200 + 11) {
          throw new Error('Memory access error');
        }

        return 0;
      });

      const name = testObject.name;
      expect(name).toBe(`[Object ${objNum} - Name Error]`);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Name Error'));
    });

    it('should handle property table access errors', () => {
      mockMemory.getWord.mockImplementation((addr: number) => {
        const calculatedObjAddr = objTableAddr + 31 * 2 + (objNum - 1) * 9;
        if (addr === calculatedObjAddr + 7) {
          throw new Error('Property table access error');
        }
        return 0;
      });

      const name = testObject.name;
      expect(name).toBe(`[Object ${objNum} - Property Table Error]`);
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Property Table Error'));
    });

    it('should decode name correctly when all conditions are met', () => {
      // This is already tested implicitly, but let's make it explicit
      const name = testObject.name;
      expect(name).not.toContain('Invalid');
      expect(name).not.toContain('Unnamed');
      expect(name).not.toContain('Error');
    });
  });

  describe('Dump methods', () => {
    it('should dump property data correctly', () => {
      // Property 10 has 2 bytes of data: 0x12, 0x34
      const propEntry = 0x200 + 11;
      const dumpResult = testObject.dumpPropData(propEntry);

      // hexString pads to 4 digits, so 0x12 becomes 0x0012
      expect(dumpResult).toContain('0x0012');
      expect(dumpResult).toContain('0x0034');
    });

    it('should dump property data for 1-byte property', () => {
      // Property 5 has 1 byte of data: 0x56
      const propEntry = 0x200 + 14;
      const dumpResult = testObject.dumpPropData(propEntry);

      // hexString pads to 4 digits
      expect(dumpResult).toBe('0x0056');
    });

    it('should dump object information correctly', () => {
      testObject.dump();

      // Should log object number and name
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`[${objNum}]`));
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Attributes:'));
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Properties:'));
    });

    it('should dump object with indentation', () => {
      testObject.dump(2);

      // Should include indentation
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(' .  . '));
    });

    it('should dump children recursively', () => {
      // Setup a child object
      mockMemory.getByte.mockImplementation((addr: number) => {
        const calculatedObjAddr = objTableAddr + 31 * 2 + (objNum - 1) * 9;
        const childObjAddr = objTableAddr + 31 * 2 + (30 - 1) * 9;
        const propTable = 0x200;
        const childPropTable = 0x300;

        // Attribute bytes
        if (addr >= calculatedObjAddr && addr < calculatedObjAddr + 4) return 0xaa;
        if (addr >= childObjAddr && addr < childObjAddr + 4) return 0xbb;

        // Parent, sibling, child
        if (addr === calculatedObjAddr + 4) return 0;
        if (addr === calculatedObjAddr + 5) return 0;
        if (addr === calculatedObjAddr + 6) return 30; // Child is object 30

        if (addr === childObjAddr + 4) return objNum; // Child's parent
        if (addr === childObjAddr + 5) return 0;
        if (addr === childObjAddr + 6) return 0;

        // Property tables
        if (addr === propTable) return 5;
        if (addr === childPropTable) return 4;

        // Properties
        if (addr === propTable + 11) return 0x2a;
        if (addr === propTable + 12) return 0x12;
        if (addr === propTable + 13) return 0x34;
        if (addr === propTable + 14) return 0x05;
        if (addr === propTable + 15) return 0x56;
        if (addr === propTable + 16) return 0;

        if (addr === childPropTable + 9) return 0x21;
        if (addr === childPropTable + 10) return 0x78;
        if (addr === childPropTable + 11) return 0;

        return 0;
      });

      mockMemory.getWord.mockImplementation((addr: number) => {
        const calculatedObjAddr = objTableAddr + 31 * 2 + (objNum - 1) * 9;
        const childObjAddr = objTableAddr + 31 * 2 + (30 - 1) * 9;
        if (addr === calculatedObjAddr + 7) return 0x200;
        if (addr === childObjAddr + 7) return 0x300;
        if (addr === 0x200 + 12) return 0x1234;
        if (addr === 0x200 + 15) return 0x56;
        if (addr === 0x300 + 10) return 0x5678;
        return 0;
      });

      mockMemory.getZString.mockReturnValue(['C', 'h', 'i', 'l', 'd']);

      const mockGetObject = (num: number) => {
        if (num === 0) return null;
        if (num === 30) {
          const childObj = new GameObject(mockMemory as any, version, objTableAddr, 30, { logger: mockLogger });
          Object.defineProperty(childObj, 'getObject', {
            value: mockGetObject,
            configurable: true,
          });
          return childObj;
        }
        const mockObj = new GameObject(mockMemory as any, version, objTableAddr, num, { logger: mockLogger });
        Object.defineProperty(mockObj, 'getObject', {
          value: mockGetObject,
          configurable: true,
        });
        return mockObj;
      };

      Object.defineProperty(testObject, 'getObject', {
        value: mockGetObject,
        configurable: true,
      });

      testObject.dump();

      // Should dump child object
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('[30]'));
    });
  });

  describe('Integration Tests', () => {
    it('should correctly parse the object tree from a memory image', () => {
      // This test would use a realistic memory setup mimicking a minimal Z-machine story file
      // We could either construct this manually or load a small test story file

      // For brevity, let's focus on mocking the key parts
      const staticMemory = 0x500;
      const objTable = 0x100;
      const objEntriesStart = objTable + 31 * 2;

      // Setup memory mocks for a simple tree:
      // Object 1 (parent=0, child=2, sibling=0) - root
      //   Object 2 (parent=1, child=3, sibling=0) - child of 1
      //     Object 3 (parent=2, child=0, sibling=0) - child of 2

      // Clear mocks
      mockMemory.getWord.mockReset();
      mockMemory.getByte.mockReset();

      // Static memory
      mockMemory.getWord.mockImplementation((addr: number) => {
        if (addr === 0x0e) return staticMemory;

        // Property tables
        if (addr === objEntriesStart + 7) return 0x300; // Obj 1
        if (addr === objEntriesStart + 9 + 7) return 0x320; // Obj 2
        if (addr === objEntriesStart + 18 + 7) return 0x340; // Obj 3

        return 0;
      });

      mockMemory.getByte.mockImplementation((addr: number) => {
        // Object 1
        if (addr === objEntriesStart + 4) return 0; // Parent
        if (addr === objEntriesStart + 5) return 0; // Sibling
        if (addr === objEntriesStart + 6) return 2; // Child

        // Object 2
        if (addr === objEntriesStart + 9 + 4) return 1; // Parent
        if (addr === objEntriesStart + 9 + 5) return 0; // Sibling
        if (addr === objEntriesStart + 9 + 6) return 3; // Child

        // Object 3
        if (addr === objEntriesStart + 18 + 4) return 2; // Parent
        if (addr === objEntriesStart + 18 + 5) return 0; // Sibling
        if (addr === objEntriesStart + 18 + 6) return 0; // Child

        // Property tables
        if (addr === 0x300 || addr === 0x320 || addr === 0x340) return 5; // Name length
        if (addr === 0x300 + 11 || addr === 0x320 + 11 || addr === 0x340 + 11) return 0x21; // Property size

        return 0;
      });

      // Create factory with these mocks
      const factory = new GameObjectFactory(mockMemory as any, version, objTable, { logger: mockLogger });

      // Get root objects
      const roots = factory.findRootObjects();

      // Validate object tree structure
      expect(roots.length).toBe(1);
      expect(roots[0].objNum).toBe(1);

      const child = roots[0].child;
      expect(child).not.toBeNull();
      expect(child?.objNum).toBe(2);

      const grandchild = child?.child;
      expect(grandchild).not.toBeNull();
      expect(grandchild?.objNum).toBe(3);
    });
  });
});
