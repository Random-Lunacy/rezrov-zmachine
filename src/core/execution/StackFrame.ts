/**
 * Represents a stack frame in the Z-Machine.
 * Each stack frame contains information about the current execution context,
 * including the return address, local variables, and the routine being executed.
 */
export interface StackFrame {
  // The PC to return to when the routine completes
  returnPC: number;

  // Stack pointer value at the time of call (for restoring on return)
  previousSP: number;

  // Local variables for the routine (0-15)
  locals: Uint16Array;

  // Variable to store the result in (null if no return value)
  resultVariable: number | null;

  // Number of arguments passed
  argumentCount: number;

  // Address of the routine being executed
  routineAddress: number;
}

export function createStackFrame(
  returnPC: number,
  previousSP: number,
  numLocals: number,
  resultVariable: number | null,
  argumentCount: number,
  routineAddress: number
): StackFrame {
  if (numLocals < 0 || numLocals > 15) {
    throw new Error(`Invalid number of locals: ${numLocals}. Z-Machine allows 0-15 locals.`);
  }

  // Create array for local variables
  const locals = new Uint16Array(numLocals);

  return {
    returnPC,
    previousSP,
    locals,
    resultVariable,
    argumentCount,
    routineAddress,
  };
}
