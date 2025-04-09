/**
 * Exports all Z-machine opcode implementations
 * This provides a central point for accessing all opcodes
 */

import { mathOpcodes } from "./math";
import { objectOpcodes } from "./object";
import { stackOpcodes } from "./stack";
import { ioOpcodes } from "./io";
import { controlOpcodes } from "./control";
import { Opcode, opcode, unimplementedOpcode } from "./base";

/**
 * Combined opcodes from all categories
 */
const allOpcodes = {
  ...mathOpcodes,
  ...objectOpcodes,
  ...stackOpcodes,
  ...ioOpcodes,
  ...controlOpcodes,
};

// Create the opcode tables
const op0: Array<Opcode> = new Array(16).fill(unimplementedOpcode("illegal_0OP"));
const op1: Array<Opcode> = new Array(16).fill(unimplementedOpcode("illegal_1OP"));
const op2: Array<Opcode> = new Array(32).fill(unimplementedOpcode("illegal_2OP"));
const op3: Array<Opcode> = new Array(32).fill(unimplementedOpcode("illegal_3OP"));
const op4: Array<Opcode> = new Array(32).fill(unimplementedOpcode("illegal_4OP"));
const opv: Array<Opcode> = new Array(32).fill(unimplementedOpcode("illegal_VAR"));
const opext: Array<Opcode> = new Array(256).fill(unimplementedOpcode("illegal_EXT"));

// Fill in the opcode tables based on the opcode definitions
// We would need to define all the opcodes and their indices in the respective tables

// 0OP opcodes (op0)
op0[0] = allOpcodes.rtrue;
op0[1] = allOpcodes.rfalse;
op0[2] = allOpcodes.print;
op0[3] = allOpcodes.print_ret;
op0[4] = allOpcodes.nop || unimplementedOpcode("nop");
op0[5] = allOpcodes.save;
op0[6] = allOpcodes.restore;
op0[7] = allOpcodes.restart || unimplementedOpcode("restart");
op0[8] = allOpcodes.ret_popped;
op0[9] = allOpcodes.pop;
op0[10] = allOpcodes.quit;
op0[11] = allOpcodes.new_line;
op0[12] = allOpcodes.show_status;
op0[13] = allOpcodes.verify;
// ... and so on for all opcodes

// 1OP opcodes (op1)
op1[0] = allOpcodes.jz;
op1[1] = allOpcodes.get_sibling;
op1[2] = allOpcodes.get_child;
op1[3] = allOpcodes.get_parent;
op1[4] = allOpcodes.get_prop_len;
op1[5] = allOpcodes.inc;
op1[6] = allOpcodes.dec;
op1[7] = allOpcodes.print_addr;
// ... and so on for all opcodes

// 2OP opcodes (op2)
op2[0] = unimplementedOpcode("illegal_2OP_0"); // Opcode 0 is typically illegal
op2[1] = allOpcodes.je;
op2[2] = allOpcodes.jl;
op2[3] = allOpcodes.jg;
op2[4] = allOpcodes.dec_chk;
op2[5] = allOpcodes.inc_chk;
op2[6] = allOpcodes.jin;
op2[7] = allOpcodes.test;
op2[8] = allOpcodes.or;
op2[9] = allOpcodes.and;
// ... and so on for all opcodes

// VAR opcodes (opv)
opv[0] = allOpcodes.call;
opv[1] = allOpcodes.storew;
opv[2] = allOpcodes.storeb;
opv[3] = allOpcodes.put_prop;
opv[4] = allOpcodes.sread;
opv[5] = allOpcodes.print_char;
// ... and so on for all opcodes

// Export both the combined opcodes and the tables
export {
  allOpcodes,
  op0, op1, op2, op3, op4, opv, opext
};

// Re-export base types and utilities
export * from "./base";
