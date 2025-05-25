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

    it('should calculate property data length correctly for V4+', () => {
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

    it('should get property length correctly', () => {
      // Setup for property length test
      mockMemory.getByte.mockImplementation((addr: number) => {
        if (addr === 0x200 + 11) return 0x52; // Size byte indicating length 2
        return 0;
      });

      expect(GameObject.getPropertyLength(mockMemory as any, 3, 0x200 + 12)).toBe(3);
      expect(GameObject.getPropertyLength(mockMemory as any, 3, 0)).toBe(0);
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
