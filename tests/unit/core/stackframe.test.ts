import { describe, expect, it } from 'vitest';
import { createStackFrame, deserializeStackFrame, serializeStackFrame } from '../../../src/core/execution/StackFrame';

describe('StackFrame', () => {
  describe('createStackFrame', () => {
    it('should create a stack frame with result variable when storesResult is true', () => {
      // Setup
      const returnPC = 0x1234;
      const previousSP = 10;
      const numLocals = 3;
      const storesResult = true;
      const resultVar = 5;
      const argumentCount = 2;
      const routineAddress = 0x5678;

      // Act
      const stackFrame = createStackFrame(
        returnPC,
        previousSP,
        numLocals,
        storesResult,
        resultVar,
        argumentCount,
        routineAddress
      );

      // Assert - frames allocate 15 slots (Z-machine max)
      expect(stackFrame).toEqual({
        returnPC,
        previousSP,
        locals: new Uint16Array(15),
        resultVariable: resultVar,
        argumentCount,
        routineAddress,
      });
    });

    it('should create a stack frame with null result variable when storesResult is false', () => {
      // Setup
      const returnPC = 0x1234;
      const previousSP = 10;
      const numLocals = 3;
      const storesResult = false;
      const resultVar = 5; // This should be ignored
      const argumentCount = 2;
      const routineAddress = 0x5678;

      // Act
      const stackFrame = createStackFrame(
        returnPC,
        previousSP,
        numLocals,
        storesResult,
        resultVar,
        argumentCount,
        routineAddress
      );

      // Assert - frames allocate 15 slots (Z-machine max)
      expect(stackFrame).toEqual({
        returnPC,
        previousSP,
        locals: new Uint16Array(15),
        resultVariable: null,
        argumentCount,
        routineAddress,
      });
    });

    it('should initialize locals as an empty array when numLocals is 0', () => {
      // Setup
      const returnPC = 0x1234;
      const previousSP = 10;
      const numLocals = 0;
      const storesResult = true;
      const resultVar = 5;
      const argumentCount = 0;
      const routineAddress = 0x5678;

      // Act
      const stackFrame = createStackFrame(
        returnPC,
        previousSP,
        numLocals,
        storesResult,
        resultVar,
        argumentCount,
        routineAddress
      );

      // Assert - allocate 15 slots (Z-machine max) for V6 compatibility
      expect(stackFrame.locals.length).toBe(15);
      expect(stackFrame.locals).toEqual(new Uint16Array(15));
    });

    it('should throw an error when numLocals is invalid', () => {
      // Setup
      const returnPC = 0x1234;
      const previousSP = 10;
      const numLocals = 16; // Z-Machine allows 0-15 locals
      const storesResult = true;
      const resultVar = 5;
      const argumentCount = 2;
      const routineAddress = 0x5678;

      // Act & Assert
      expect(() => {
        createStackFrame(returnPC, previousSP, numLocals, storesResult, resultVar, argumentCount, routineAddress);
      }).toThrow('Invalid number of locals: 16. Z-Machine allows 0-15 locals.');
    });

    it('should throw an error when numLocals is negative', () => {
      // Setup
      const returnPC = 0x1234;
      const previousSP = 10;
      const numLocals = -1;
      const storesResult = true;
      const resultVar = 5;
      const argumentCount = 2;
      const routineAddress = 0x5678;

      // Act & Assert
      expect(() => {
        createStackFrame(returnPC, previousSP, numLocals, storesResult, resultVar, argumentCount, routineAddress);
      }).toThrow('Invalid number of locals: -1. Z-Machine allows 0-15 locals.');
    });

    it('should preserve routine address correctly', () => {
      const routineAddress = 0x5678;
      const stackFrame = createStackFrame(
        0x1234, // returnPC
        10, // previousSP
        3, // numLocals
        true, // storesResult
        5, // resultVar
        2, // argumentCount
        routineAddress
      );

      expect(stackFrame.routineAddress).toBe(routineAddress);
    });

    describe('serializeStackFrame', () => {
      it('should correctly serialize a stack frame', () => {
        const stackFrame = createStackFrame(
          0x1234, // returnPC
          10, // previousSP
          3, // numLocals
          true, // storesResult
          5, // resultVar
          2, // argumentCount
          0x5678 // routineAddress
        );

        // Populate locals and frame stack for a more comprehensive test
        stackFrame.locals[0] = 42;
        stackFrame.locals[1] = 99;
        stackFrame.frameStack = [10, 20, 30];

        const serialized = serializeStackFrame(stackFrame);

        expect(serialized).toEqual({
          returnPC: 0x1234,
          discardResult: false,
          storeVariable: 5,
          argumentMask: [true, true],
          locals: [42, 99, 0, ...Array(12).fill(0)], // 15 slots
          stack: [10, 20, 30],
        });
      });

      it('should handle frames with no locals or frame stack', () => {
        const stackFrame = createStackFrame(
          0x1234, // returnPC
          10, // previousSP
          0, // numLocals
          false, // storesResult
          0, // resultVar
          0, // argumentCount
          0x5678 // routineAddress
        );

        const serialized = serializeStackFrame(stackFrame);

        expect(serialized).toEqual({
          returnPC: 0x1234,
          discardResult: true,
          storeVariable: 0,
          argumentMask: [],
          locals: Array(15).fill(0), // Allocate 15 slots (Z-machine max)
          stack: [],
        });
      });
    });

    describe('deserializeStackFrame', () => {
      it('should correctly deserialize a stack frame', () => {
        const serializedFrame = {
          returnPC: 0x1234,
          discardResult: false,
          storeVariable: 5,
          argumentMask: [true, true],
          locals: [42, 99, 0],
          stack: [10, 20, 30],
        };

        const deserialized = deserializeStackFrame(serializedFrame);

        expect(deserialized.returnPC).toBe(0x1234);
        expect(deserialized.resultVariable).toBe(5);
        expect(deserialized.locals).toEqual(new Uint16Array([42, 99, 0]));
        expect(deserialized.frameStack).toEqual([10, 20, 30]);
        expect(deserialized.previousSP).toBe(0);
        expect(deserialized.routineAddress).toBe(0);
        expect(deserialized.argumentCount).toBe(2);
      });

      it('should handle discarded result frames', () => {
        const serializedFrame = {
          returnPC: 0x5678,
          discardResult: true,
          storeVariable: 0,
          argumentMask: [],
          locals: [],
          stack: [],
        };

        const deserialized = deserializeStackFrame(serializedFrame);

        expect(deserialized.resultVariable).toBeNull();
      });
    });
  });
});
