/**
 * Represents a Z-Machine stack frame according to the 1.1 specification.
 * Each routine call creates a new stack frame to track execution context.
 */
export interface StackFrame {
  // The return program counter (where execution will resume after return)
  returnPC: number;

  // Previous stack pointer (points to the previous frame's location)
  previousSP: number;

  // Storage for up to 15 local variables (0-14)
  locals: Uint16Array; // Fixed size of 15

  // Whether a result is expected from this routine call
  storesResult: boolean;

  // Where to store the result value (variable number)
  resultVariable: number;

  // Number of arguments originally passed to the routine
  argumentCount: number;

  // Optional: For debugging/introspection purposes
  routineAddress: number;
}

/**
 * Factory function to create a new stack frame
 */
export function createStackFrame(
  returnPC: number,
  previousSP: number,
  numLocals: number,
  storesResult: boolean,
  resultVariable: number,
  argumentCount: number,
  routineAddress: number
): StackFrame {
  // Ensure numLocals is within the Z-Machine specification limit (0-15)
  if (numLocals < 0 || numLocals > 15) {
    throw new Error(`Invalid number of locals: ${numLocals}. Z-Machine allows 0-15 locals.`);
  }

  // Create local variables storage with the proper size
  const locals = new Uint16Array(15);

  return {
    returnPC,
    previousSP,
    locals,
    storesResult,
    resultVariable,
    argumentCount,
    routineAddress
  };
}
