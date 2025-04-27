import { describe, expect, it } from 'vitest';
import { createStackFrame } from '../../../src/core/execution/StackFrame';

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

      // Assert
      expect(stackFrame).toEqual({
        returnPC,
        previousSP,
        locals: new Uint16Array(numLocals),
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

      // Assert
      expect(stackFrame).toEqual({
        returnPC,
        previousSP,
        locals: new Uint16Array(numLocals),
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

      // Assert
      expect(stackFrame.locals).toEqual(new Uint16Array(0));
      expect(stackFrame.locals.length).toBe(0);
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
  });
});
