import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toI16, toU16 } from '../../../../src/core/memory/cast16';
import { stackOpcodes } from '../../../../src/core/opcodes/stack';
import { ZMachine } from '../../../../src/interpreter/ZMachine';
import { OperandType } from '../../../../src/types';
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
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`1234 pull ${variable}`);
    });

    it('should pull a value from a user stack in V6', () => {
      // Arrange: in V6, first operand IS the user stack address; result var comes from readByte()
      const stackAddr = 0x2000;
      const resultVar = 42; // readByte() returns 42 in mock setup
      const stackValue = 42; // pullStack() returns 42 in mock setup
      mockMachine.state.version = 6;

      // Act
      stackOpcodes.pull.impl(machine, [], stackAddr);

      // Assert
      expect(mockMachine.state.readByte).toHaveBeenCalled(); // reads result variable from bytecode
      expect(mockMachine.getUserStackManager).toHaveBeenCalled();
      expect(mockUserStackManager.pullStack).toHaveBeenCalledWith(stackAddr);
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(resultVar, stackValue);
      expect(mockMachine.logger.debug).toHaveBeenCalledWith(`1234 pull (0x${stackAddr.toString(16)}) -> (${resultVar}) = ${stackValue}`);
    });

    it('should pull from game stack when user stack address is 0 in V6', () => {
      // Arrange: user stack address 0 means use the game stack
      const resultVar = 42; // readByte() returns 42 in mock setup
      const stackValue = 99; // popStack() returns 99 in mock setup
      mockMachine.state.version = 6;

      // Act
      stackOpcodes.pull.impl(machine, [], 0);

      // Assert
      expect(mockMachine.state.readByte).toHaveBeenCalled();
      expect(mockMachine.getUserStackManager).not.toHaveBeenCalled();
      expect(mockMachine.state.popStack).toHaveBeenCalled();
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(resultVar, stackValue);
    });

    it('should ignore extra args and use game stack in V1-V5', () => {
      // Arrange
      const variable = 3;
      mockMachine.state.version = 5;

      // Act
      stackOpcodes.pull.impl(machine, [], variable);

      // Assert
      expect(mockMachine.getUserStackManager).not.toHaveBeenCalled();
      expect(mockUserStackManager.pullStack).not.toHaveBeenCalled();
      expect(mockMachine.state.popStack).toHaveBeenCalled();
    });

    it('should throw error when user stack is empty in V6', () => {
      // Arrange: in V6, first operand is user stack address
      const stackAddr = 0x2000;
      mockMachine.state.version = 6;
      mockUserStackManager.pullStack.mockReturnValue(undefined);

      // Act & Assert
      expect(() => {
        stackOpcodes.pull.impl(machine, [], stackAddr);
      }).toThrow('User stack underflow at address 0x2000');

      // Verify the user stack manager was called with the stack address
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

    it('should peek stack top in place for direct var=0 (Z-spec §6.3.4)', () => {
      // Arrange: stack has [99, 88], load from variable 0 (stack)
      mockMachine.state.stack = [99, 88];

      // Act
      stackOpcodes.load.impl(machine, [], 0);

      // Assert: should read stack top (88) without popping
      expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, 88);
      expect(mockMachine.state.stack).toEqual([99, 88]); // Stack unchanged
      expect(mockMachine.state.popStack).not.toHaveBeenCalled();
    });

    it('should throw error for direct var=0 when stack empty', () => {
      mockMachine.state.stack = [];

      expect(() => {
        stackOpcodes.load.impl(machine, [], 0);
      }).toThrow('Illegal operation: load from stack pointer when stack is empty');
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

    it('should overwrite stack top in place for direct var=0 (Z-spec §6.3.4)', () => {
      // Arrange: stack has [99, 88], store 77 to variable 0 (stack)
      mockMachine.state.stack = [99, 88];

      // Act
      stackOpcodes.store.impl(machine, [], 0, 77);

      // Assert: should overwrite stack top without pushing
      expect(mockMachine.state.stack).toEqual([99, 77]); // Top replaced, size unchanged
      expect(mockMachine.state.pushStack).not.toHaveBeenCalled();
      expect(mockMachine.state.storeVariable).not.toHaveBeenCalled();
    });

    it('should throw error for direct var=0 when stack empty', () => {
      mockMachine.state.stack = [];

      expect(() => {
        stackOpcodes.store.impl(machine, [], 0, 77);
      }).toThrow('Illegal operation: store to stack pointer when stack is empty');
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

  describe('Indirect variable references', () => {
    beforeEach(() => {
      // Setup a variable that contains a target variable number
      mockMachine.state.loadVariable = vi.fn().mockImplementation((varNum) => {
        if (varNum === 5) return 10; // Variable 5 contains 10 (target variable)
        if (varNum === 6) return 0; // Variable 6 contains 0 (stack pointer)
        if (varNum === 10) return 42; // Variable 10 contains value 42
        return 0;
      });
    });

    describe('load indirect', () => {
      it('should load from indirect variable reference', () => {
        // Variable 5 contains 10, variable 10 contains 42
        stackOpcodes.load.impl(machine, [OperandType.Variable], 5);

        // Should load variable 5 to get target (10), then load from variable 10
        expect(mockMachine.state.loadVariable).toHaveBeenCalledWith(5); // Get target
        expect(mockMachine.state.loadVariable).toHaveBeenCalledWith(10); // Load value
        expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, 42); // Store result
        expect(mockMachine.logger.debug).toHaveBeenCalledWith('1234 load (5) -> (42)');
      });

      it('should handle indirect reference to stack pointer', () => {
        // Variable 6 contains 0 (stack pointer), stack has [99, 88]
        mockMachine.state.stack = [99, 88];

        stackOpcodes.load.impl(machine, [OperandType.Variable], 6);

        // Should load variable 6 to get target (0)
        expect(mockMachine.state.loadVariable).toHaveBeenCalledWith(6);
        // Should NOT call loadVariable again - directly accesses stack
        expect(mockMachine.state.loadVariable).toHaveBeenCalledTimes(1);

        // Should store the top stack value (88) in result variable (42)
        expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(42, 88);
        expect(mockMachine.logger.debug).toHaveBeenCalledWith('1234 load (6) -> (42)');

        // Stack should remain unchanged (no pop occurred)
        expect(mockMachine.state.stack).toEqual([99, 88]);
      });

      it('should throw error for indirect stack pointer when stack empty', () => {
        mockMachine.state.stack = [];

        expect(() => {
          stackOpcodes.load.impl(machine, [OperandType.Variable], 6);
        }).toThrow('Illegal operation: load from stack pointer when stack is empty');
      });
    });

    describe('store indirect', () => {
      it('should store to indirect variable reference', () => {
        // Variable 5 contains 10, store 123 to variable 10
        stackOpcodes.store.impl(machine, [OperandType.Variable], 5, 123);

        expect(mockMachine.state.loadVariable).toHaveBeenCalledWith(5); // Get target (10)
        expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(10, 123);
        expect(mockMachine.logger.debug).toHaveBeenCalledWith('1234 store (5) 123');
      });

      it('should handle indirect store to stack pointer', () => {
        // Variable 6 contains 0 (stack pointer), stack has [99, 88]
        mockMachine.state.stack = [99, 88];

        stackOpcodes.store.impl(machine, [OperandType.Variable], 6, 77);

        expect(mockMachine.state.loadVariable).toHaveBeenCalledWith(6); // Get target (0)
        // Should modify top of stack in place
        expect(mockMachine.state.stack).toEqual([99, 77]);
        expect(mockMachine.logger.debug).toHaveBeenCalledWith('1234 store (6) 77 (stack top in place)');
      });

      it('should throw error for indirect stack pointer store when stack empty', () => {
        mockMachine.state.stack = [];

        expect(() => {
          stackOpcodes.store.impl(machine, [OperandType.Variable], 6, 123);
        }).toThrow('Illegal operation: store to stack pointer when stack is empty');
      });
    });

    it('should pop and discard when called with no operand in V1-V5', () => {
      // This handles the 0-operand encoding edge case in V1-V5 (undefined variableRef)
      mockMachine.state.version = 5;
      stackOpcodes.pull.impl(machine, []);

      expect(mockMachine.state.popStack).toHaveBeenCalled();
      expect(mockMachine.state.storeVariable).not.toHaveBeenCalled();
    });

    describe('pull indirect', () => {
      it('should throw error for indirect pull with stack pointer as target', () => {
        // Variable 6 contains 0 (stack pointer) - logical impossibility
        expect(() => {
          stackOpcodes.pull.impl(machine, [OperandType.Variable], 6);
        }).toThrow('Illegal operation: indirect pull with stack pointer as target creates logical impossibility');
      });

      it('should pull to indirect variable reference', () => {
        // Variable 5 contains 10, pull stack value to variable 10
        stackOpcodes.pull.impl(machine, [OperandType.Variable], 5);

        expect(mockMachine.state.loadVariable).toHaveBeenCalledWith(5); // Get target (10)
        expect(mockMachine.state.popStack).toHaveBeenCalled();
        expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(10, 99);
        expect(mockMachine.logger.debug).toHaveBeenCalledWith('1234 pull (5)');
      });
    });

    describe('inc indirect', () => {
      it('should increment indirect variable reference', () => {
        // Variable 5 contains 10, variable 10 contains 42
        stackOpcodes.inc.impl(machine, [OperandType.Variable], 5);

        expect(mockMachine.state.loadVariable).toHaveBeenCalledWith(5); // Get target (10)
        expect(mockMachine.state.loadVariable).toHaveBeenCalledWith(10); // Get current value (42)
        expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(10, toU16(43)); // Store incremented
        expect(mockMachine.logger.debug).toHaveBeenCalledWith('1234 inc (5) 42');
      });

      it('should handle indirect increment of stack pointer', () => {
        // Variable 6 contains 0 (stack pointer), stack has [99, 88]
        mockMachine.state.stack = [99, 88];

        stackOpcodes.inc.impl(machine, [OperandType.Variable], 6);

        expect(mockMachine.state.loadVariable).toHaveBeenCalledWith(6); // Get target (0)
        // Should increment top of stack in place
        expect(mockMachine.state.stack).toEqual([99, 89]);
        expect(mockMachine.logger.debug).toHaveBeenCalledWith('1234 inc (6) 88 (stack top in place)');
      });

      it('should throw error for indirect stack pointer increment when stack empty', () => {
        mockMachine.state.stack = [];

        expect(() => {
          stackOpcodes.inc.impl(machine, [OperandType.Variable], 6);
        }).toThrow('Illegal operation: indirect increment of stack pointer when stack is empty');
      });
    });

    describe('dec indirect', () => {
      it('should decrement indirect variable reference', () => {
        // Variable 5 contains 10, variable 10 contains 42
        stackOpcodes.dec.impl(machine, [OperandType.Variable], 5);

        expect(mockMachine.state.loadVariable).toHaveBeenCalledWith(5); // Get target (10)
        expect(mockMachine.state.loadVariable).toHaveBeenCalledWith(10); // Get current value (42)
        expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(10, toU16(41)); // Store decremented
        expect(mockMachine.logger.debug).toHaveBeenCalledWith('1234 dec (5) 42');
      });

      it('should handle indirect decrement of stack pointer', () => {
        // Variable 6 contains 0 (stack pointer), stack has [99, 88]
        mockMachine.state.stack = [99, 88];

        stackOpcodes.dec.impl(machine, [OperandType.Variable], 6);

        expect(mockMachine.state.loadVariable).toHaveBeenCalledWith(6); // Get target (0)
        // Should decrement top of stack in place
        expect(mockMachine.state.stack).toEqual([99, 87]);
        expect(mockMachine.logger.debug).toHaveBeenCalledWith('1234 dec (6) 88 (stack top in place)');
      });

      it('should throw error for indirect stack pointer decrement when stack empty', () => {
        mockMachine.state.stack = [];

        expect(() => {
          stackOpcodes.dec.impl(machine, [OperandType.Variable], 6);
        }).toThrow('Illegal operation: indirect decrement of stack pointer when stack is empty');
      });
    });

    describe('inc_chk indirect', () => {
      it('should increment and check indirect variable reference', () => {
        // Variable 5 contains 10, variable 10 contains 5, check > 3
        stackOpcodes.inc_chk.impl(machine, [OperandType.Variable], 5, 3);

        expect(mockMachine.state.loadVariable).toHaveBeenCalledWith(5); // Get target (10)
        expect(mockMachine.state.loadVariable).toHaveBeenCalledWith(10); // Get current value (42)
        expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(10, toU16(43)); // Store incremented
        expect(mockMachine.state.doBranch).toHaveBeenCalledWith(true, false, 10); // 43 > 3 = true
      });

      it('should handle indirect inc_chk of stack pointer', () => {
        // Variable 6 contains 0 (stack pointer), stack has [99, 5], check > 3
        mockMachine.state.stack = [99, 5];

        stackOpcodes.inc_chk.impl(machine, [OperandType.Variable], 6, 3);

        expect(mockMachine.state.loadVariable).toHaveBeenCalledWith(6); // Get target (0)
        // Should increment top of stack in place: 5 -> 6
        expect(mockMachine.state.stack).toEqual([99, 6]);
        expect(mockMachine.state.doBranch).toHaveBeenCalledWith(true, false, 10); // 6 > 3 = true
        expect(mockMachine.logger.debug).toHaveBeenCalledWith('1234 inc_chk (6) 5 > 3 = true (stack top in place)');
      });

      it('should throw error for indirect stack pointer inc_chk when stack empty', () => {
        mockMachine.state.stack = [];

        expect(() => {
          stackOpcodes.inc_chk.impl(machine, [OperandType.Variable], 6, 3);
        }).toThrow('Illegal operation: indirect inc_chk of stack pointer when stack is empty');
      });
    });

    describe('dec_chk indirect', () => {
      it('should decrement and check indirect variable reference', () => {
        // Variable 5 contains 10, variable 10 contains 5, check < 3
        stackOpcodes.dec_chk.impl(machine, [OperandType.Variable], 5, 3);

        expect(mockMachine.state.loadVariable).toHaveBeenCalledWith(5); // Get target (10)
        expect(mockMachine.state.loadVariable).toHaveBeenCalledWith(10); // Get current value (42)
        expect(mockMachine.state.storeVariable).toHaveBeenCalledWith(10, toU16(41)); // Store decremented
        expect(mockMachine.state.doBranch).toHaveBeenCalledWith(false, false, 10); // 41 < 3 = false
      });

      it('should handle indirect dec_chk of stack pointer', () => {
        // Variable 6 contains 0 (stack pointer), stack has [99, 5], check < 7
        mockMachine.state.stack = [99, 5];

        stackOpcodes.dec_chk.impl(machine, [OperandType.Variable], 6, 7);

        expect(mockMachine.state.loadVariable).toHaveBeenCalledWith(6); // Get target (0)
        // Should decrement top of stack in place: 5 -> 4
        expect(mockMachine.state.stack).toEqual([99, 4]);
        expect(mockMachine.state.doBranch).toHaveBeenCalledWith(true, false, 10); // 4 < 7 = true
        expect(mockMachine.logger.debug).toHaveBeenCalledWith('1234 dec_chk (6) 5 < 7 = true (stack top in place)');
      });

      it('should throw error for indirect stack pointer dec_chk when stack empty', () => {
        mockMachine.state.stack = [];

        expect(() => {
          stackOpcodes.dec_chk.impl(machine, [OperandType.Variable], 6, 7);
        }).toThrow('Illegal operation: indirect dec_chk of stack pointer when stack is empty');
      });
    });
  });
});
