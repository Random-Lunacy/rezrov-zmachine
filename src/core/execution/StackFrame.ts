/**
 * Represents a stack frame in the Z-Machine.
 * Each stack frame contains information about the current execution context,
 * including the return address, local variables, and the routine being executed.
 */
export interface StackFrame {
  // Core execution properties
  returnPC: number;
  previousSP: number;
  locals: Uint16Array;
  resultVariable: number | null;
  argumentCount: number;
  routineAddress: number;

  // Optional properties used for serialization
  frameStack?: number[]; // For stack values specific to this frame
}

/**
 * Creates a stack frame for a routine call
 *
 * @param returnPC Address to return to when routine completes
 * @param previousSP Stack pointer value before this call
 * @param numLocals Number of local variables (0-15)
 * @param resultVar Variable to store result in (or null if discarding)
 * @param argumentCount Number of arguments passed to the routine
 * @param routineAddress Starting address of the routine
 * @returns A new stack frame
 */
export function createStackFrame(
  returnPC: number,
  previousSP: number,
  numLocals: number,
  storesResult: boolean,
  resultVar: number,
  argumentCount: number,
  routineAddress: number
): StackFrame {
  if (numLocals < 0 || numLocals > 15) {
    throw new Error(`Invalid number of locals: ${numLocals}. Z-Machine allows 0-15 locals.`);
  }

  // Create array for locals (16-bit values)
  const locals = new Uint16Array(numLocals);

  return {
    returnPC,
    previousSP,
    locals,
    resultVariable: storesResult ? resultVar : null,
    argumentCount,
    routineAddress,
  };
}

// Helper function to convert StackFrame to a serializable object
export function serializeStackFrame(frame: StackFrame): SerializedStackFrame {
  return {
    returnPC: frame.returnPC,
    discardResult: frame.resultVariable === null,
    storeVariable: frame.resultVariable !== null ? frame.resultVariable : 0,
    argumentMask: Array(frame.argumentCount).fill(true),
    locals: Array.from(frame.locals),
    stack: frame.frameStack || [],
  };
}

// Helper function to deserialize a StackFrame
export function deserializeStackFrame(serialized: SerializedStackFrame): StackFrame {
  return {
    returnPC: serialized.returnPC,
    previousSP: 0, // This would need to be calculated during restoration
    locals: new Uint16Array(serialized.locals),
    resultVariable: serialized.discardResult ? null : serialized.storeVariable,
    argumentCount: serialized.argumentMask.length,
    routineAddress: 0, // This would need to be reconstructed during restoration
    frameStack: serialized.stack,
  };
}

// The serialized version used in storage
export interface SerializedStackFrame {
  returnPC: number;
  discardResult: boolean;
  storeVariable: number;
  argumentMask: boolean[];
  locals: number[];
  stack: number[];
}
