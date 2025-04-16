/**
 * Represents a stack frame in the Z-Machine.
 * Each stack frame contains information about the current execution context,
 * including the return address, local variables, and the routine being executed.
 */
export interface StackFrame {
  // Return address to resume at when routine finishes
  returnPC: number;

  // Original stack pointer value when frame was created
  previousSP: number;

  // Local variables for this routine (0-15)
  locals: Uint16Array;

  // Variable to store result in (or null if discarding)
  resultVariable: number | null;

  // Number of arguments passed to the routine
  argumentCount: number;

  // Starting address of the routine (for debugging)
  routineAddress: number;
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
