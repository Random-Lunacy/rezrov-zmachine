import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameObject } from '../../../../src/core/objects/GameObject';
import { objectOpcodes } from '../../../../src/core/opcodes/object';
import { ZMachine } from '../../../../src/interpreter/ZMachine';
import { createMockZMachine } from '../../../mocks';

describe('Object Opcodes', () => {
  // Using a type cast to ZMachine to satisfy the TypeScript compiler
  let machine: ZMachine;
  let mockMachine: ReturnType<typeof createMockZMachine>;

  // Mock objects with getters for name
  let mockObject: Partial<GameObject> & { name: string };
  let mockParentObject: Partial<GameObject>;
  let mockSiblingObject: Partial<GameObject>;
  let mockChildObject: Partial<GameObject>;

  beforeEach(() => {
    // Create a mock ZMachine
    mockMachine = createMockZMachine();

    // Create mock GameObject instances
    mockObject = {
      objNum: 5,
      parent: null,
      sibling: null,
      child: null,
      hasAttribute: vi.fn(),
      setAttribute: vi.fn(),
      clearAttribute: vi.fn(),
      unlink: vi.fn(),
      getProperty: vi.fn(),
      getPropertyAddress: vi.fn(),
      getNextProperty: vi.fn(),
      putProperty: vi.fn(),
      name: 'Test Object', // This is now defined as part of the type, not set later
    };

    mockParentObject = {
      objNum: 3,
      parent: null,
      sibling: null,
      child: null,
    };

    mockSiblingObject = {
      objNum: 6,
      parent: null,
      sibling: null,
      child: null,
    };

    mockChildObject = {
      objNum: 7,
      parent: null,
      sibling: null,
      child: null,
    };

    // Create a properly mock state object with required methods
    mockMachine.state = {
      ...mockMachine.state,
      readByte: vi.fn().mockReturnValue(42), // Result variable
      storeVariable: vi.fn(),
      readBranchOffset: vi.fn().mockReturnValue([10, false]), // offset, branchOnFalse
      doBranch: vi.fn(),
      getObject: vi.fn().mockImplementation((objNum) => {
        switch (objNum) {
          case 5:
            return mockObject as unknown as GameObject;
          case 3:
            return mockParentObject as GameObject;
          case 6:
            return mockSiblingObject as GameObject;
          case 7:
            return mockChildObject as GameObject;
          default:
            return null;
        }
      }),
      version: 5,
      pc: 0x5000,
    };

    // Add executor with op_pc property
    mockMachine.executor = {
      op_pc: 0x1234,
    } as any;

    // Set up static methods on GameObject
    vi.spyOn(GameObject, 'getPropertyLength').mockReturnValue(2);

    // Cast to ZMachine type to satisfy TypeScript
    machine = mockMachine as unknown as ZMachine;
  });

  describe('test_attr', () => {
    it('should branch when attribute is set', () => {
      // Arrange
      const obj = 5;
      const attribute = 3;
      (mockObject.hasAttribute as any).mockReturnValue(true);

      // Act
      objectOpcodes.test_attr.impl(machine, obj, attribute);

      // Assert
      expect(mockMachine.state.readBranchOffset).toHaveBeenCalled();
      expect(mockObject.hasAttribute).toHaveBeenCalledWith(attribute);
      expect(mockMachine.state.doBranch).toHaveBeenCalledWith(true, false, 10);
    });

    it('should not branch when attribute is not set', () => {
      // Arrange
      const obj = 5;
      const attribute = 3;
      (mockObject.hasAttribute as any).mockReturnValue(false);

      // Act
      objectOpcodes.test_attr.impl(machine, obj, attribute);

      // Assert
      expect(mockObject.hasAttribute).toHaveBeenCalledWith(attribute);
      expect(mockMachine.state.doBranch).toHaveBeenCalledWith(false, false, 10);
    });

    it('should not branch and log error when object is null', () => {
      // Arrange
      const obj = 99; // Non-existent object
      const attribute = 3;

      // Act
      objectOpcodes.test_attr.impl(machine, obj, attribute);

      // Assert
      expect(mockMachine.logger.error).toHaveBeenCalledWith('Object null in test_attr');
      expect(mockMachine.state.doBranch).toHaveBeenCalledWith(false, false, 10);
    });
  });

  describe('set_attr', () => {
    it('should set attribute on object', () => {
      // Arrange
      const obj = 5;
      const attribute = 3;

      // Act
      objectOpcodes.set_attr.impl(machine, obj, attribute);

      // Assert
      expect(mockObject.setAttribute).toHaveBeenCalledWith(attribute);
    });

    it('should log error when object is null', () => {
      // Arrange
      const obj = 99; // Non-existent object
      const attribute = 3;

      // Act
      objectOpcodes.set_attr.impl(machine, obj, attribute);

      // Assert
      expect(mockMachine.logger.error).toHaveBeenCalledWith('Object null in set_attr');
      expect(mockObject.setAttribute).not.toHaveBeenCalled();
    });
  });

  describe('clear_attr', () => {
    it('should clear attribute on object', () => {
      // Arrange
      const obj = 5;
      const attribute = 3;

      // Act
      objectOpcodes.clear_attr.impl(machine, obj, attribute);

      // Assert
      expect(mockObject.clearAttribute).toHaveBeenCalledWith(attribute);
    });

    it('should log error when object is null', () => {
      // Arrange
      const obj = 99; // Non-existent object
      const attribute = 3;

      // Act
      objectOpcodes.clear_attr.impl(machine, obj, attribute);

      // Assert
      expect(mockMachine.logger.error).toHaveBeenCalledWith('Object null in clear_attr');
      expect(mockObject.clearAttribute).not.toHaveBeenCalled();
    });
  });

  describe('jin', () => {
    it('should branch when obj1 is inside obj2', () => {
      // Arrange
      const obj1 = 5;
      const obj2 = 3;
      mockObject.parent = mockParentObject as GameObject;

      // Act
      objectOpcodes.jin.impl(machine, obj1, obj2);

      // Assert
      expect(mockMachine.state.readBranchOffset).toHaveBeenCalled();
      expect(mockMachine.state.doBranch).toHaveBeenCalledWith(true, false, 10);
    });

    it('should not branch when obj1 is not inside obj2', () => {
      // Arrange
      const obj1 = 5;
      const obj2 = 7; // Not the parent
      mockObject.parent = mockParentObject as GameObject;

      // Act
      objectOpcodes.jin.impl(machine, obj1, obj2);

      // Assert
      expect(mockMachine.state.doBranch).toHaveBeenCalledWith(false, false, 10);
    });

    it('should not branch when obj1 has no parent', () => {
      // Arrange
      const obj1 = 5;
      const obj2 = 3;
      mockObject.parent = null;

      // Act
      objectOpcodes.jin.impl(machine, obj1, obj2);

      // Assert
      expect(mockMachine.state.doBranch).toHaveBeenCalledWith(false, false, 10);
    });

    it('should log error and not branch when obj1 is null', () => {
      // Arrange
      const obj1 = 99; // Non-existent object
      const obj2 = 3;

      // Act
      objectOpcodes.jin.impl(machine, obj1, obj2);

      // Assert
      expect(mockMachine.logger.error).toHaveBeenCalledWith('Child object is null in jin');
      expect(mockMachine.state.doBranch).toHaveBeenCalledWith(false, false, 10);
    });
  });

  describe('insert_obj', () => {
    it('should insert object into destination', () => {
      // Arrange
      const obj = 5;
      const destination = 3;

      // Set a parent so that unlink() will be called
      mockObject.parent = mockParentObject as GameObject;

      // Set up initial state of parent object
      mockParentObject.child = null;

      // Act
      objectOpcodes.insert_obj.impl(machine, obj, destination);

      // Assert
      // Check if object is unlinked from its current parent
      expect(mockObject.unlink).toHaveBeenCalled();

      // Check if object is properly inserted
      expect(mockObject.sibling).toBe(null); // Since parent had no children initially
      expect(mockObject.parent).toBe(mockParentObject);
      expect(mockParentObject.child).toBe(mockObject);
    });

    it('should insert object at the head of existing children', () => {
      // Arrange
      const obj = 5;
      const destination = 3;

      // Set up initial state - parent already has a child
      mockParentObject.child = mockChildObject as GameObject;

      // Act
      objectOpcodes.insert_obj.impl(machine, obj, destination);

      // Assert
      // Check if object is properly inserted at the head of the child list
      expect(mockObject.sibling).toBe(mockChildObject);
      expect(mockObject.parent).toBe(mockParentObject);
      expect(mockParentObject.child).toBe(mockObject);
    });

    it('should log error when object is null', () => {
      // Arrange
      const obj = 99; // Non-existent object
      const destination = 3;

      // Act
      objectOpcodes.insert_obj.impl(machine, obj, destination);

      // Assert
      expect(mockMachine.logger.error).toHaveBeenCalledWith('Object null in insert_obj');
    });

    it('should log error when destination is null', () => {
      // Arrange
      const obj = 5;
      const destination = 99; // Non-existent object

      // Act
      objectOpcodes.insert_obj.impl(machine, obj, destination);

      // Assert
      expect(mockMachine.logger.error).toHaveBeenCalledWith('Destination object null in insert_obj');
    });
  });

  describe('get_prop', () => {
    it('should get property from object and store result', () => {
      // Arrange
      const obj = 5;
      const property = 3;
      const propValue = 0x1234;
      (mockObject.getProperty as any).mockReturnValue(propValue);

      // Act
      objectOpcodes.get_prop.impl(machine, obj, property);

      // Assert
      expect(mockMachine.state.readByte).toHaveBeenCalled();
      expect(mockObject.getProperty).toHaveBeenCalledWith(property);
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, propValue);
    });

    it('should store 0 and log warning when object is null', () => {
      // Arrange
      const obj = 99; // Non-existent object
      const property = 3;

      // Act
      objectOpcodes.get_prop.impl(machine, obj, property);

      // Assert
      expect(mockMachine.logger.warn).toHaveBeenCalledWith('get_prop called on null object');
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, 0);
    });
  });

  describe('get_prop_addr', () => {
    it('should get property address from object and store result', () => {
      // Arrange
      const obj = 5;
      const property = 3;
      const propAddr = 0x1000;
      (mockObject.getPropertyAddress as any).mockReturnValue(propAddr);

      // Act
      objectOpcodes.get_prop_addr.impl(machine, obj, property);

      // Assert
      expect(mockMachine.state.readByte).toHaveBeenCalled();
      expect(mockObject.getPropertyAddress).toHaveBeenCalledWith(property);
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, propAddr);
    });

    it('should store 0 and log warning when object is null', () => {
      // Arrange
      const obj = 99; // Non-existent object
      const property = 3;

      // Act
      objectOpcodes.get_prop_addr.impl(machine, obj, property);

      // Assert
      expect(mockMachine.logger.warn).toHaveBeenCalledWith('get_prop_addr called on null object');
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, 0);
    });
  });

  describe('get_next_prop', () => {
    it('should get next property from object and store result', () => {
      // Arrange
      const obj = 5;
      const property = 3;
      const nextProp = 4;
      (mockObject.getNextProperty as any).mockReturnValue(nextProp);

      // Act
      objectOpcodes.get_next_prop.impl(machine, obj, property);

      // Assert
      expect(mockMachine.state.readByte).toHaveBeenCalled();
      expect(mockObject.getNextProperty).toHaveBeenCalledWith(property);
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, nextProp);
    });

    it('should store 0 and log warning when object is null', () => {
      // Arrange
      const obj = 99; // Non-existent object
      const property = 3;

      // Act
      objectOpcodes.get_next_prop.impl(machine, obj, property);

      // Assert
      expect(mockMachine.logger.warn).toHaveBeenCalledWith('get_next_prop called on null object');
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, 0);
    });
  });

  describe('get_sibling', () => {
    it('should get sibling of object, store result, and branch when sibling exists', () => {
      // Arrange
      const obj = 5;
      mockObject.sibling = mockSiblingObject as GameObject;

      // Act
      objectOpcodes.get_sibling.impl(machine, obj);

      // Assert
      expect(mockMachine.state.readByte).toHaveBeenCalled();
      expect(mockMachine.state.readBranchOffset).toHaveBeenCalled();
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, mockSiblingObject.objNum);
      expect(mockMachine.state.doBranch).toHaveBeenCalledWith(true, false, 10);
    });

    it('should store 0 and not branch when object has no sibling', () => {
      // Arrange
      const obj = 5;
      mockObject.sibling = null;

      // Act
      objectOpcodes.get_sibling.impl(machine, obj);

      // Assert
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, 0);
      expect(mockMachine.state.doBranch).toHaveBeenCalledWith(false, false, 10);
    });

    it('should store 0, log warning, and not branch when object is null', () => {
      // Arrange
      const obj = 99; // Non-existent object

      // Act
      objectOpcodes.get_sibling.impl(machine, obj);

      // Assert
      expect(mockMachine.logger.warn).toHaveBeenCalledWith('object is 0 in get_sibling');
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, 0);
      expect(mockMachine.state.doBranch).toHaveBeenCalledWith(false, false, 10);
    });
  });

  describe('get_child', () => {
    it('should get child of object, store result, and branch when child exists', () => {
      // Arrange
      const obj = 5;
      mockObject.child = mockChildObject as GameObject;

      // Act
      objectOpcodes.get_child.impl(machine, obj);

      // Assert
      expect(mockMachine.state.readByte).toHaveBeenCalled();
      expect(mockMachine.state.readBranchOffset).toHaveBeenCalled();
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, mockChildObject.objNum);
      expect(mockMachine.state.doBranch).toHaveBeenCalledWith(true, false, 10);
    });

    it('should store 0 and not branch when object has no child', () => {
      // Arrange
      const obj = 5;
      mockObject.child = null;

      // Act
      objectOpcodes.get_child.impl(machine, obj);

      // Assert
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, 0);
      expect(mockMachine.state.doBranch).toHaveBeenCalledWith(false, false, 10);
    });

    it('should store 0, log warning, and not branch when object is null', () => {
      // Arrange
      const obj = 99; // Non-existent object

      // Act
      objectOpcodes.get_child.impl(machine, obj);

      // Assert
      expect(mockMachine.logger.warn).toHaveBeenCalledWith('object is 0 in get_child');
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, 0);
      expect(mockMachine.state.doBranch).toHaveBeenCalledWith(false, false, 10);
    });
  });

  describe('get_parent', () => {
    it('should get parent of object and store result', () => {
      // Arrange
      const obj = 5;
      mockObject.parent = mockParentObject as GameObject;

      // Act
      objectOpcodes.get_parent.impl(machine, obj);

      // Assert
      expect(mockMachine.state.readByte).toHaveBeenCalled();
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, mockParentObject.objNum);
    });

    it('should store 0 when object has no parent', () => {
      // Arrange
      const obj = 5;
      mockObject.parent = null;

      // Act
      objectOpcodes.get_parent.impl(machine, obj);

      // Assert
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, 0);
    });

    it('should store 0 and log error when object is null', () => {
      // Arrange
      const obj = 99; // Non-existent object

      // Act
      objectOpcodes.get_parent.impl(machine, obj);

      // Assert
      expect(mockMachine.logger.error).toHaveBeenCalledWith('object null in get_parent');
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, 0);
    });
  });

  describe('remove_obj', () => {
    it('should remove object from parent', () => {
      // Arrange
      const obj = 5;

      // Act
      objectOpcodes.remove_obj.impl(machine, obj);

      // Assert
      expect(mockObject.unlink).toHaveBeenCalled();
    });

    it('should log error when object is null', () => {
      // Arrange
      const obj = 99; // Non-existent object

      // Act
      objectOpcodes.remove_obj.impl(machine, obj);

      // Assert
      expect(mockMachine.logger.error).toHaveBeenCalledWith('object null in remove_obj');
    });
  });

  describe('put_prop', () => {
    it('should set property value for object', () => {
      // Arrange
      const obj = 5;
      const property = 3;
      const value = 0x1234;

      // Act
      objectOpcodes.put_prop.impl(machine, obj, property, value);

      // Assert
      expect(mockObject.putProperty).toHaveBeenCalledWith(property, value);
    });

    it('should log warning when object is null', () => {
      // Arrange
      const obj = 99; // Non-existent object
      const property = 3;
      const value = 0x1234;

      // Act
      objectOpcodes.put_prop.impl(machine, obj, property, value);

      // Assert
      expect(mockMachine.logger.warn).toHaveBeenCalledWith('put_prop called on null object');
    });
  });

  describe('get_prop_len', () => {
    it('should get property length and store result', () => {
      // Arrange
      const propDataAddr = 0x1000;
      const length = 2;

      // Act
      objectOpcodes.get_prop_len.impl(machine, propDataAddr);

      // Assert
      expect(mockMachine.state.readByte).toHaveBeenCalled();
      expect(GameObject.getPropertyLength).toHaveBeenCalledWith(
        mockMachine.state.memory,
        mockMachine.state.version,
        propDataAddr
      );
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, length);
    });
  });

  describe('print_obj', () => {
    it('should print object name', () => {
      // Arrange
      const obj = 5;
      // No need to set name here as it's already set in the mockObject

      // Act
      objectOpcodes.print_obj.impl(machine, obj);

      // Assert
      expect(machine.screen.print).toHaveBeenCalledWith(machine, mockObject.name);
    });

    it('should log warning when object is null', () => {
      // Arrange
      const obj = 99; // Non-existent object

      // Act
      objectOpcodes.print_obj.impl(machine, obj);

      // Assert
      expect(mockMachine.logger.warn).toHaveBeenCalledWith(`print_obj: object ${obj} not found`);
      expect(machine.screen.print).not.toHaveBeenCalled();
    });
  });
});
