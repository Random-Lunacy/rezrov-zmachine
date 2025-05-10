import { describe, expect, it, vi } from 'vitest';
import { opcode, Opcode, unimplementedOpcode } from '../../../../src/core/opcodes/base';
import { ZMachine } from '../../../../src/interpreter/ZMachine';

describe('Opcode Base', () => {
  describe('opcode function', () => {
    it('should create an opcode object with the correct structure', () => {
      // Create a mock implementation function
      const mockImpl = vi.fn();

      // Create an opcode
      const testOpcode = opcode('test_opcode', mockImpl);

      // Verify structure
      expect(testOpcode).toHaveProperty('mnemonic', 'test_opcode');
      expect(testOpcode).toHaveProperty('impl', mockImpl);
    });

    it('should create an opcode that can be executed', () => {
      // Create a mock machine
      const mockMachine = { state: { pc: 0x1000 } } as unknown as ZMachine;

      // Create a mock implementation that captures arguments
      const mockImpl = vi.fn();

      // Create an opcode
      const testOpcode = opcode('test_opcode', mockImpl);

      // Execute the opcode
      testOpcode.impl(mockMachine, 1, 2, 3);

      // Verify that the implementation was called with the correct arguments
      expect(mockImpl).toHaveBeenCalledTimes(1);
      expect(mockImpl).toHaveBeenCalledWith(mockMachine, 1, 2, 3);
    });
  });

  describe('unimplementedOpcode function', () => {
    it('should create an opcode that throws an error when executed', () => {
      // Create an unimplemented opcode
      const notImplemented = unimplementedOpcode('not_implemented');

      // Create a mock machine
      const mockMachine = { state: { pc: 0x1000 } } as unknown as ZMachine;

      // Verify structure
      expect(notImplemented).toHaveProperty('mnemonic', 'not_implemented');
      expect(notImplemented).toHaveProperty('impl');

      // Verify that it throws an error when executed
      expect(() => notImplemented.impl(mockMachine)).toThrow('Unimplemented opcode: not_implemented');
    });
  });

  describe('Opcode type', () => {
    it('should allow correct opcode objects', () => {
      // Define a function matching OpcodeFn signature
      const validImplementation = (machine: ZMachine, ...args: number[]): void => {
        // Implementation details not important for type testing
      };

      // Create a valid opcode object
      const validOpcode: Opcode = {
        mnemonic: 'valid_op',
        impl: validImplementation,
      };

      // No assertions needed - this is a type test
      // If the types are incorrect, TypeScript would fail to compile
      expect(validOpcode.mnemonic).toBe('valid_op');
      expect(typeof validOpcode.impl).toBe('function');
    });

    it('should support async opcode implementations', async () => {
      // Create a mock machine
      const mockMachine = { state: { pc: 0x1000 } } as unknown as ZMachine;

      // Create an async implementation
      const asyncImpl = async (machine: ZMachine, ...args: number[]): Promise<void> => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve();
          }, 10);
        });
      };

      // Create an opcode with the async implementation
      const asyncOpcode = opcode('async_op', asyncImpl);

      // Execute the opcode and await its completion
      await expect(asyncOpcode.impl(mockMachine, 1, 2)).resolves.toBeUndefined();
    });
  });
});
