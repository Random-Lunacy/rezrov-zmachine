/**
 * Exports all Z-machine opcode implementations
 * This provides a central point for accessing all opcodes
 */

import { mathOpcodes } from "./math";
import { objectOpcodes } from "./object";
import { stackOpcodes } from "./stack";
import { ioOpcodes } from "./io";
import { controlOpcodes } from "./control";
import { callOpcodes } from "./call";
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
  ...callOpcodes,
};

// Create the opcode tables
const op0: Array<Opcode> = new Array(16).fill(
  unimplementedOpcode("illegal_0OP")
);
const op1: Array<Opcode> = new Array(16).fill(
  unimplementedOpcode("illegal_1OP")
);
const op2: Array<Opcode> = new Array(32).fill(
  unimplementedOpcode("illegal_2OP")
);
const op3: Array<Opcode> = new Array(32).fill(
  unimplementedOpcode("illegal_3OP")
);
const op4: Array<Opcode> = new Array(32).fill(
  unimplementedOpcode("illegal_4OP")
);
const opv: Array<Opcode> = new Array(32).fill(
  unimplementedOpcode("illegal_VAR")
);
const opext: Array<Opcode> = new Array(256).fill(
  unimplementedOpcode("illegal_EXT")
);

// Fill in the opcode tables based on the opcode definitions
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
op0[13] = allOpcodes.zCatch;
op0[14] = allOpcodes.verify;
op0[15] = unimplementedOpcode("piracy");

// 1OP opcodes (op1)
op1[0] = allOpcodes.jz;
op1[1] = allOpcodes.get_sibling;
op1[2] = allOpcodes.get_child;
op1[3] = allOpcodes.get_parent;
op1[4] = allOpcodes.get_prop_len;
op1[5] = allOpcodes.inc;
op1[6] = allOpcodes.dec;
op1[7] = allOpcodes.print_addr;
op1[8] = allOpcodes.call_1s;
op1[9] = allOpcodes.remove_obj;
op1[10] = allOpcodes.print_obj;
op1[11] = allOpcodes.ret;
op1[12] = allOpcodes.jump;
op1[13] = allOpcodes.print_paddr;
op1[14] = allOpcodes.load;
op1[15] = allOpcodes.call_1n;

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
op2[10] = allOpcodes.test_attr;
op2[11] = allOpcodes.set_attr;
op2[12] = allOpcodes.clear_attr;
op2[13] = allOpcodes.store;
op2[14] = allOpcodes.insert_obj;
op2[15] = allOpcodes.loadw;
op2[16] = allOpcodes.loadb;
op2[17] = allOpcodes.get_prop;
op2[18] = allOpcodes.get_prop_addr;
op2[19] = allOpcodes.get_next_prop;
op2[20] = allOpcodes.add;
op2[21] = allOpcodes.sub;
op2[22] = allOpcodes.mul;
op2[23] = allOpcodes.div;
op2[24] = allOpcodes.mod;
op2[25] = allOpcodes.call_2s;
op2[26] = allOpcodes.call_2n;
op2[27] = allOpcodes.set_color;
op2[28] = allOpcodes.zThrow;
op2[29] = unimplementedOpcode("illegal_2OP_29");
op2[30] = unimplementedOpcode("illegal_2OP_30");
op2[31] = unimplementedOpcode("illegal_2OP_31");

// VAR opcodes (opv)
opv[0] = allOpcodes.call;
opv[1] = allOpcodes.storew;
opv[2] = allOpcodes.storeb;
opv[3] = allOpcodes.put_prop;
opv[4] = allOpcodes.sread;
opv[5] = allOpcodes.print_char;
opv[6] = allOpcodes.print_num;
opv[7] = allOpcodes.random;
opv[8] = allOpcodes.push;
opv[9] = allOpcodes.pull;
opv[10] = allOpcodes.split_window;
opv[11] = allOpcodes.set_window;
opv[12] = allOpcodes.call_vs2;
opv[13] = allOpcodes.erase_window;
opv[14] = allOpcodes.erase_line;
opv[15] = allOpcodes.set_cursor;
opv[16] = allOpcodes.get_cursor;
opv[17] = allOpcodes.set_text_style;
opv[18] = allOpcodes.buffer_mode;
opv[19] = allOpcodes.output_stream;
opv[20] = allOpcodes.input_stream;
opv[21] = allOpcodes.sound_effect;
opv[22] = allOpcodes.read_char;
opv[23] = allOpcodes.scan_table;
opv[24] = allOpcodes.not;
opv[25] = allOpcodes.call_vn;
opv[26] = allOpcodes.call_vn2;
opv[27] = allOpcodes.tokenise;
opv[28] = unimplementedOpcode("encode_text");
opv[29] = unimplementedOpcode("copy_table");
opv[30] = allOpcodes.print_table;
opv[31] = allOpcodes.check_arg_count;

// Export both the combined opcodes and the tables
export { allOpcodes, op0, op1, op2, op3, op4, opv, opext };

// Re-export base types and utilities
export * from "./base";
