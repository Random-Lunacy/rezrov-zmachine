import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toI16, toU16 } from '../../../../src/core/memory/cast16';
import { stackOpcodes } from '../../../../src/core/opcodes/stack';
import { ZMachine } from '../../../../src/interpreter/ZMachine';
import { createMockZMachine } from '../../../mocks';

describe('Stack Opcodes', () => {
  // Using a type cast to ZMachine to satisfy the TypeScript compiler
  let machine: ZMachine;
  let mockMachine: ReturnType<typeof createMockZMachine>;
  let mockUserStackManager: { pushStack: any; pullStack: any; popStack: any };

  beforeEach(() => {
    // Create a mock ZMachine
    mockMachine = createMockZMachine();

    // Create mock UserStackManager
    mockUserStackManager = {
      pushStack: vi.fn().mockReturnValue(true),
      pullStack: vi.fn().mockReturnValue(42),
      popStack: vi.fn(),
    };

    // Create a properly mock state object with required methods
    mockMachine.state = {
      ...mockMachine.state,
      version: 5, // Default version
      readByte: vi.fn().mockReturnValue(42), // Result variable
      pushStack: vi.fn(),
      popStack: vi.fn().mockReturnValue(99), // Default popped value
      storeVariable: vi.fn(),
      loadVariable: vi.fn().mockReturnValue(10), // Default variable value
      readBranchOffset: vi.fn().mockReturnValue([10, false]), // offset, branchOnFalse
      doBranch: vi.fn(),
      pc: 0x5000,
    };

    // Add executor with op_pc property
    mockMachine.executor = {
      op_pc: 0x1234,
    } as any;

    // Add getUserStackManager method
    mockMachine.getUserStackManager = vi.fn().mockReturnValue(mockUserStackManager);

    // Cast to ZMachine type to satisfy TypeScript
    machine = mockMachine as unknown as ZMachine;
  });

  describe('push', () => {
    it('should push a value onto the stack', () => {
      // Arrange
      const value = 0x1234;

      // Act
      stackOpcodes.push.impl(machine, [], value);

      // Assert
      expect(mockMachine.state.pushStack).toHaveBeenCalledWith(value);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`push ${value}`);
    });
  });

  describe('pop', () => {
    it('should pop a value from the stack', () => {
      // Act
      stackOpcodes.pop.impl(machine, []);

      // Assert
      expect(mockMachine.state.popStack).toHaveBeenCalled();
      expect(mockMachine.logger.debug).toHaveBeenCalledWith('pop');
    });
  });

  describe('pull', () => {
    it('should pull a value from the system stack and store it', () => {
      // Arrange
      const variable = 3;
      const stackValue = 99;

      // Act
      stackOpcodes.pull.impl(machine, [], variable);

      // Assert
      expect(mockMachine.state.popStack).toHaveBeenCalled();
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(variable, stackValue);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`1234 pull ${variable} `);
    });

    it('should pull a value from a user stack in V6', () => {
      // Arrange
      const variable = 3;
      const stackAddr = 0x2000;
      const stackValue = 42;
      mockMachine.state.version = 6;

      // Act
      stackOpcodes.pull.impl(machine, [], variable, stackAddr);

      // Assert
      expect(mockMachine.getUserStackManager).toHaveBeenCalled();
      expect(mockUserStackManager.pullStack).toHaveBeenCalledWith(stackAddr);
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(variable, stackValue);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`1234 pull ${variable} ${stackAddr}`);
    });

    it('should ignore stackAddr if not V6', () => {
      // Arrange
      const variable = 3;
      const stackAddr = 0x2000;
      mockMachine.state.version = 5;

      // Act
      stackOpcodes.pull.impl(machine, [], variable, stackAddr);

      // Assert
      expect(mockMachine.getUserStackManager).not.toHaveBeenCalled();
      expect(mockUserStackManager.pullStack).not.toHaveBeenCalled();
      expect(mockMachine.state.popStack).toHaveBeenCalled();
    });

    it('should throw error when user stack is empty', () => {
      // Arrange
      const variable = 3;
      const stackAddr = 0x2000;
      mockMachine.state.version = 6;
      mockUserStackManager.pullStack.mockReturnValue(undefined);

      // Act & Assert
      expect(() => {
        stackOpcodes.pull.impl(machine, [], variable, stackAddr);
      }).toThrow('User stack underflow at address 8192');

      // Verify the user stack manager was called
      expect(mockUserStackManager.pullStack).toHaveBeenCalledWith(stackAddr);

      // Verify storeVariable was NOT called since we threw an error
      expect(mockMachine.state.storeVariable).not.toHaveBeenCalled();
    });
  });

  describe('load', () => {
    it('should load a value from a variable and store it', () => {
      // Arrange
      const variable = 3;
      const value = 10;
      const resultVar = 42;

      // Act
      stackOpcodes.load.impl(machine, [], variable);

      // Assert
      expect(mockMachine.state.readByte).toHaveBeenCalled();
      expect(mockMachine.state.loadVariable).toHaveBeenCalledWith(variable);
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(resultVar, value);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`1234 load ${variable} -> (${resultVar})`);
    });
  });

  describe('store', () => {
    it('should store a value in a variable', () => {
      // Arrange
      const variable = 3;
      const value = 0x1234;

      // Act
      stackOpcodes.store.impl(machine, [], variable, value);

      // Assert
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(variable, value);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`1234 store ${variable} ${value}`);
    });
  });

  describe('inc', () => {
    it('should increment a variable by 1', () => {
      // Arrange
      const variable = 3;
      const currentValue = 10;
      const expectedNewValue = toU16(toI16(currentValue) + 1);

      // Act
      stackOpcodes.inc.impl(machine, [], variable);

      // Assert
      expect(mockMachine.state.loadVariable).toHaveBeenCalledWith(variable);
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(variable, expectedNewValue);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`1234 inc ${variable} ${currentValue}`);
    });

    it('should handle signed 16-bit overflow', () => {
      // Arrange
      const variable = 3;
      const currentValue = 0x7fff; // Maximum positive 16-bit signed value
      mockMachine.state.loadVariable = vi.fn().mockReturnValue(currentValue);

      // Act
      stackOpcodes.inc.impl(machine, [], variable);

      // Assert
      // Should wrap around to -32768
      const expectedNewValue = toU16(toI16(currentValue) + 1);
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(variable, expectedNewValue);
      expect(toI16(expectedNewValue)).toBe(-32768);
    });
  });

  describe('dec', () => {
    it('should decrement a variable by 1', () => {
      // Arrange
      const variable = 3;
      const currentValue = 10;
      const expectedNewValue = toU16(toI16(currentValue) - 1);

      // Act
      stackOpcodes.dec.impl(machine, [], variable);

      // Assert
      expect(mockMachine.state.loadVariable).toHaveBeenCalledWith(variable);
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(variable, expectedNewValue);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`1234 dec ${variable} ${currentValue}`);
    });

    it('should handle signed 16-bit underflow', () => {
      // Arrange
      const variable = 3;
      const currentValue = 0x8000; // Minimum negative 16-bit signed value (-32768)
      mockMachine.state.loadVariable = vi.fn().mockReturnValue(currentValue);

      // Act
      stackOpcodes.dec.impl(machine, [], variable);

      // Assert
      // Should wrap around to 32767
      const expectedNewValue = toU16(toI16(currentValue) - 1);
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(variable, expectedNewValue);
      expect(toI16(expectedNewValue)).toBe(32767);
    });
  });

  describe('inc_chk', () => {
    it('should increment variable and branch when greater than value', () => {
      // Arrange
      const variable = 3;
      const testValue = 5;
      const currentValue = 5; // Will be 6 after increment
      mockMachine.state.loadVariable = vi.fn().mockReturnValue(currentValue);

      // Act
      stackOpcodes.inc_chk.impl(machine, [], variable, testValue);

      // Assert
      expect(mockMachine.state.readBranchOffset).toHaveBeenCalled();
      expect(mockMachine.state.loadVariable).toHaveBeenCalledWith(variable);

      const newValue = toI16(currentValue) + 1;
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(variable, toU16(newValue));
      expect(mockMachine.state.doBranch).toHaveBeenCalledWith(true, false, 10);
    });

    it('should increment variable and not branch when not greater than value', () => {
      // Arrange
      const variable = 3;
      const testValue = 10;
      const currentValue = 5; // Will be 6 after increment
      mockMachine.state.loadVariable = vi.fn().mockReturnValue(currentValue);

      // Act
      stackOpcodes.inc_chk.impl(machine, [], variable, testValue);

      // Assert
      const newValue = toI16(currentValue) + 1;
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(variable, toU16(newValue));
      expect(mockMachine.state.doBranch).toHaveBeenCalledWith(false, false, 10);
    });

    it('should correctly compare signed values', () => {
      // Arrange
      const variable = 3;
      const testValue = toU16(-5); // Negative test value
      const currentValue = toU16(-7); // Negative current value, will be -6 after increment
      mockMachine.state.loadVariable = vi.fn().mockReturnValue(currentValue);

      // Act
      stackOpcodes.inc_chk.impl(machine, [], variable, testValue);

      // Assert
      const newValue = toI16(currentValue) + 1;
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(variable, toU16(newValue));
      // -6 is not greater than -5, so should not branch
      expect(mockMachine.state.doBranch).toHaveBeenCalledWith(false, false, 10);
    });
  });

  describe('dec_chk', () => {
    it('should decrement variable and branch when less than value', () => {
      // Arrange
      const variable = 3;
      const testValue = 10;
      const currentValue = 10; // Will be 9 after decrement
      mockMachine.state.loadVariable = vi.fn().mockReturnValue(currentValue);

      // Act
      stackOpcodes.dec_chk.impl(machine, [], variable, testValue);

      // Assert
      expect(mockMachine.state.readBranchOffset).toHaveBeenCalled();
      expect(mockMachine.state.loadVariable).toHaveBeenCalledWith(variable);

      const newValue = toI16(currentValue) - 1;
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(variable, toU16(newValue));
      expect(mockMachine.state.doBranch).toHaveBeenCalledWith(true, false, 10);
    });

    it('should decrement variable and not branch when not less than value', () => {
      // Arrange
      const variable = 3;
      const testValue = 5;
      const currentValue = 10; // Will be 9 after decrement
      mockMachine.state.loadVariable = vi.fn().mockReturnValue(currentValue);

      // Act
      stackOpcodes.dec_chk.impl(machine, [], variable, testValue);

      // Assert
      const newValue = toI16(currentValue) - 1;
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(variable, toU16(newValue));
      expect(mockMachine.state.doBranch).toHaveBeenCalledWith(false, false, 10);
    });

    it('should correctly compare signed values', () => {
      // Arrange
      const variable = 3;
      const testValue = toU16(-5); // Negative test value
      const currentValue = toU16(-4); // Negative current value, will be -5 after decrement
      mockMachine.state.loadVariable = vi.fn().mockReturnValue(currentValue);

      // Act
      stackOpcodes.dec_chk.impl(machine, [], variable, testValue);

      // Assert
      const newValue = toI16(currentValue) - 1;
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(variable, toU16(newValue));
      // -5 is not less than -5, so should not branch
      expect(mockMachine.state.doBranch).toHaveBeenCalledWith(false, false, 10);
    });
  });

  describe('pop_stack', () => {
    it('should pop items from system stack in V6', () => {
      // Arrange
      const items = 3;
      mockMachine.state.version = 6;

      // Act
      stackOpcodes.pop_stack.impl(machine, [], items);

      // Assert
      expect(mockMachine.state.popStack).toHaveBeenCalledTimes(3);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`1234 pop_stack ${items} `);
    });

    it('should pop items from user stack in V6 when stack address provided', () => {
      // Arrange
      const items = 3;
      const stackAddr = 0x2000;
      mockMachine.state.version = 6;

      // Act
      stackOpcodes.pop_stack.impl(machine, [], items, stackAddr);

      // Assert
      expect(mockMachine.getUserStackManager).toHaveBeenCalled();
      expect(mockUserStackManager.popStack).toHaveBeenCalledWith(stackAddr, items);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`1234 pop_stack ${items} ${stackAddr}`);
    });

    it('should warn and do nothing if not V6', () => {
      // Arrange
      const items = 3;
      mockMachine.state.version = 5;

      // Act
      stackOpcodes.pop_stack.impl(machine, [], items);

      // Assert
      expect(mockMachine.logger.warn).toHaveBeenCalledWith('pop_stack opcode only available in Version 6');
      expect(mockMachine.state.popStack).not.toHaveBeenCalled();
      expect(mockUserStackManager.popStack).not.toHaveBeenCalled();
    });
  });

  describe('push_stack', () => {
    it('should push value to user stack and branch if successful in V6', () => {
      // Arrange
      const value = 0x1234;
      const stackAddr = 0x2000;
      mockMachine.state.version = 6;
      mockUserStackManager.pushStack.mockReturnValue(true);

      // Act
      stackOpcodes.push_stack.impl(machine, [], value, stackAddr);

      // Assert
      expect(mockMachine.state.readBranchOffset).toHaveBeenCalled();
      expect(mockMachine.getUserStackManager).toHaveBeenCalled();
      expect(mockUserStackManager.pushStack).toHaveBeenCalledWith(stackAddr, value);
      expect(mockMachine.state.doBranch).toHaveBeenCalledWith(true, false, 10);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`1234 push_stack ${value} ${stackAddr}`);
    });

    it('should not branch if push unsuccessful in V6', () => {
      // Arrange
      const value = 0x1234;
      const stackAddr = 0x2000;
      mockMachine.state.version = 6;
      mockUserStackManager.pushStack.mockReturnValue(false);

      // Act
      stackOpcodes.push_stack.impl(machine, [], value, stackAddr);

      // Assert
      expect(mockUserStackManager.pushStack).toHaveBeenCalledWith(stackAddr, value);
      expect(mockMachine.state.doBranch).toHaveBeenCalledWith(false, false, 10);
    });

    it('should warn and do nothing if not V6', () => {
      // Arrange
      const value = 0x1234;
      const stackAddr = 0x2000;
      mockMachine.state.version = 5;

      // Act
      stackOpcodes.push_stack.impl(machine, [], value, stackAddr);

      // Assert
      expect(mockMachine.logger.warn).toHaveBeenCalledWith('push_stack opcode only available in Version 6');
      expect(mockUserStackManager.pushStack).not.toHaveBeenCalled();
    });
  });
});
