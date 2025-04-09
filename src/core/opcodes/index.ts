/**
 * Exports all Z-machine opcode implementations
 * This provides a central point for accessing all opcodes
 */

import { mathOpcodes } from "./math";
import { objectOpcodes } from "./object";
import { stackOpcodes } from "./stack";
import { ioOpcodes } from "./io";

/**
 * Combined opcodes from all categories
 */
export const opcodes = {
  ...mathOpcodes,
  ...objectOpcodes,
  ...stackOpcodes,
  ...ioOpcodes,
};

// Re-export base types and utilities
export * from "./base";
