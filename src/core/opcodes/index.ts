// src/core/opcodes/index.ts - updated

import { mathOpcodes } from './math';
import { stackOpcodes } from './stack';
import { objectOpcodes } from './object';
import { stringOpcodes } from './string';
import { ioOpcodes } from './io';
import { gameOpcodes } from './game';
import { Opcode, opcode } from './base';

/**
 * Creates a placeholder opcode that throws a "not implemented" error
 * @param name Name of the opcode
 * @returns An opcode implementation that throws an error
 */
function unimplementedOpcode(name: string): Opcode {
  return opcode(name, () => {
    throw new Error(`Opcode ${name} is not implemented`);
  });
}

/**
 * Creates a no-operation opcode
 */
const nopcode = opcode("nop", () => {
  // Do nothing
});

// Combine all opcode implementations
const allOpcodes = {
  ...mathOpcodes,
  ...stackOpcodes,
  ...objectOpcodes,
  ...stringOpcodes,
  ...ioOpcodes,
  ...gameOpcodes,

  // Add placeholders for any missing opcodes
  piracy: opcode("piracy", (machine) => {
    const [offset, condfalse] = machine.getGameState().readBranchOffset();
    // Always indicate the game is genuine
    machine.getGameState().doBranch(true, condfalse, offset);
  }),

  // Extended opcodes (V5+)
  save_undo: unimplementedOpcode("save_undo"),
  restore_undo: unimplementedOpcode("restore_undo"),
  log_shift: unimplementedOpcode("log_shift"),
  art_shift: unimplementedOpcode("art_shift"),
  set_font: unimplementedOpcode("set_font"),
  draw_picture: unimplementedOpcode("draw_picture"),
  picture_data: unimplementedOpcode("picture_data"),
  erase_picture: unimplementedOpcode("erase_picture"),
  set_margins: unimplementedOpcode("set_margins"),
  print_unicode: unimplementedOpcode("print_unicode"),
  check_unicode: unimplementedOpcode("check_unicode"),
  set_true_colour: unimplementedOpcode("set_true_colour"),
  buffer_screen: unimplementedOpcode("buffer_screen"),
};

// Create opcode tables based on Z-machine specifications
const op0: Array<Opcode> = new Array(16).fill(unimplementedOpcode("illegal_0OP"));
const op1: Array<Opcode> = new Array(16).fill(unimplementedOpcode("illegal_1OP"));
const op2: Array<Opcode> = new Array(32).fill(unimplementedOpcode("illegal_2OP"));
const opv: Array<Opcode> = new Array(32).fill(unimplementedOpcode("illegal_VAR"));
const op3: Array<Opcode> = new Array(32).fill(unimplementedOpcode("illegal_3OP"));
const op4: Array<Opcode> = new Array(32).fill(unimplementedOpcode("illegal_4OP"));
const opext: Array<Opcode> = new Array(256).fill(unimplementedOpcode("illegal_EXT"));

// Fill in the opcode tables with implementations where available
// 0OP opcodes (0-15)
op0[0] = allOpcodes.rtrue || unimplementedOpcode("rtrue");
op0[1] = allOpcodes.rfalse || unimplementedOpcode("rfalse");
op0[2] = allOpcodes.print || unimplementedOpcode("print");
op0[3] = allOpcodes.print_ret || unimplementedOpcode("print_ret");
op0[4] = allOpcodes.nop || nopcode;
op0[5] = allOpcodes.save || unimplementedOpcode("save");
op0[6] = allOpcodes.restore || unimplementedOpcode("restore");
op0[7] = allOpcodes.restart || unimplementedOpcode("restart");
op0[8] = allOpcodes.ret_popped || unimplementedOpcode("ret_popped");
op0[9] = allOpcodes.pop || unimplementedOpcode("pop");
op0[10] = allOpcodes.quit || unimplementedOpcode("quit");
op0[11] = allOpcodes.new_line || unimplementedOpcode("new_line");
op0[12] = allOpcodes.show_status || unimplementedOpcode("show_status");
op0[13] = allOpcodes.verify || unimplementedOpcode("verify");
// 14 is extended opcode in Z-machine V5+
op0[15] = allOpcodes.piracy || unimplementedOpcode("piracy");

// 1OP opcodes (0-15)
op1[0] = allOpcodes.jz || unimplementedOpcode("jz");
op1[1] = allOpcodes.get_sibling || unimplementedOpcode("get_sibling");
op1[2] = allOpcodes.get_child || unimplementedOpcode("get_child");
op1[3] = allOpcodes.get_parent || unimplementedOpcode("get_parent");
op1[4] = allOpcodes.get_prop_len || unimplementedOpcode("get_prop_len");
op1[5] = allOpcodes.inc || unimplementedOpcode("inc");
op1[6] = allOpcodes.dec || unimplementedOpcode("dec");
op1[7] = allOpcodes.print_addr || unimplementedOpcode("print_addr");
op1[8] = allOpcodes.call_1s || unimplementedOpcode("call_1s");
op1[9] = allOpcodes.remove_obj || unimplementedOpcode("remove_obj");
op1[10] = allOpcodes.print_obj || unimplementedOpcode("print_obj");
op1[11] = allOpcodes.ret || unimplementedOpcode("ret");
op1[12] = allOpcodes.jump || unimplementedOpcode("jump");
op1[13] = allOpcodes.print_paddr || unimplementedOpcode("print_paddr");
op1[14] = allOpcodes.load || unimplementedOpcode("load");
op1[15] = allOpcodes.call_1n || unimplementedOpcode("call_1n");

// 2OP opcodes (0-31)
op2[0] = unimplementedOpcode("illegal_2OP_0");  // Opcode 0 is typically illegal
op2[1] = allOpcodes.je || unimplementedOpcode("je");
op2[2] = allOpcodes.jl || unimplementedOpcode("jl");
op2[3] = allOpcodes.jg || unimplementedOpcode("jg");
op2[4] = allOpcodes.dec_chk || unimplementedOpcode("dec_chk");
op2[5] = allOpcodes.inc_chk || unimplementedOpcode("inc_chk");
op2[6] = allOpcodes.jin || unimplementedOpcode("jin");
op2[7] = allOpcodes.test || unimplementedOpcode("test");
op2[8] = allOpcodes.or || unimplementedOpcode("or");
op2[9] = allOpcodes.and || unimplementedOpcode("and");
op2[10] = allOpcodes.test_attr || unimplementedOpcode("test_attr");
op2[11] = allOpcodes.set_attr || unimplementedOpcode("set_attr");
op2[12] = allOpcodes.clear_attr || unimplementedOpcode("clear_attr");
op2[13] = allOpcodes.store || unimplementedOpcode("store");
op2[14] = allOpcodes.insert_obj || unimplementedOpcode("insert_obj");
op2[15] = allOpcodes.loadw || unimplementedOpcode("loadw");
op2[16] = allOpcodes.loadb || unimplementedOpcode("loadb");
op2[17] = allOpcodes.get_prop || unimplementedOpcode("get_prop");
op2[18] = allOpcodes.get_prop_addr || unimplementedOpcode("get_prop_addr");
op2[19] = allOpcodes.get_next_prop || unimplementedOpcode("get_next_prop");
op2[20] = allOpcodes.add || unimplementedOpcode("add");
op2[21] = allOpcodes.sub || unimplementedOpcode("sub");
op2[22] = allOpcodes.mul || unimplementedOpcode("mul");
op2[23] = allOpcodes.div || unimplementedOpcode("div");
op2[24] = allOpcodes.mod || unimplementedOpcode("mod");
op2[25] = allOpcodes.call_2s || unimplementedOpcode("call_2s");
op2[26] = allOpcodes.call_2n || unimplementedOpcode("call_2n");
op2[27] = allOpcodes.set_color || unimplementedOpcode("set_color");
op2[28] = allOpcodes.throw || unimplementedOpcode("throw");
op2[29] = unimplementedOpcode("illegal_2OP_29");
op2[30] = unimplementedOpcode("illegal_2OP_30");
op2[31] = unimplementedOpcode("illegal_2OP_31");

// VAR opcodes (0-31)
opv[0] = allOpcodes.call || unimplementedOpcode("call");
opv[1] = allOpcodes.storew || unimplementedOpcode("storew");
opv[2] = allOpcodes.storeb || unimplementedOpcode("storeb");
opv[3] = allOpcodes.put_prop || unimplementedOpcode("put_prop");
opv[4] = allOpcodes.sread || unimplementedOpcode("sread");
opv[5] = allOpcodes.print_char || unimplementedOpcode("print_char");
opv[6] = allOpcodes.print_num || unimplementedOpcode("print_num");
opv[7] = allOpcodes.random || unimplementedOpcode("random");
opv[8] = allOpcodes.push || unimplementedOpcode("push");
opv[9] = allOpcodes.pull || unimplementedOpcode("pull");
opv[10] = allOpcodes.split_window || unimplementedOpcode("split_window");
opv[11] = allOpcodes.set_window || unimplementedOpcode("set_window");
opv[12] = allOpcodes.call_vs2 || unimplementedOpcode("call_vs2");
opv[13] = allOpcodes.erase_window || unimplementedOpcode("erase_window");
opv[14] = allOpcodes.erase_line || unimplementedOpcode("erase_line");
opv[15] = allOpcodes.set_cursor || unimplementedOpcode("set_cursor");
opv[16] = allOpcodes.get_cursor || unimplementedOpcode("get_cursor");
opv[17] = allOpcodes.set_text_style || unimplementedOpcode("set_text_style");
opv[18] = allOpcodes.buffer_mode || unimplementedOpcode("buffer_mode");
opv[19] = allOpcodes.output_stream || unimplementedOpcode("output_stream");
opv[20] = allOpcodes.input_stream || unimplementedOpcode("input_stream");
opv[21] = allOpcodes.sound_effect || unimplementedOpcode("sound_effect");
opv[22] = allOpcodes.read_char || unimplementedOpcode("read_char");
opv[23] = allOpcodes.scan_table || unimplementedOpcode("scan_table");
opv[24] = allOpcodes.not || unimplementedOpcode("not");
opv[25] = allOpcodes.call_vn || unimplementedOpcode("call_vn");
opv[26] = allOpcodes.call_vn2 || unimplementedOpcode("call_vn2");
opv[27] = allOpcodes.tokenise || unimplementedOpcode("tokenise");
opv[28] = unimplementedOpcode("encode_text");
opv[29] = unimplementedOpcode("copy_table");
opv[30] = allOpcodes.print_table || unimplementedOpcode("print_table");
opv[31] = allOpcodes.check_arg_count || unimplementedOpcode("check_arg_count");

// Extended opcodes (V5+)
// We'll add a few common ones as placeholders
opext[0] = unimplementedOpcode("save_ext");
opext[1] = unimplementedOpcode("restore_ext");
opext[2] = unimplementedOpcode("log_shift");
opext[3] = unimplementedOpcode("art_shift");
opext[4] = unimplementedOpcode("set_font");
// ... additional extended opcodes would go here

// Export the opcode tables and utilities
export {
  op0, op1, op2, op3, op4, opv, opext,
  nopcode, unimplementedOpcode
};

// Also re-export the base opcode utilities
export * from './base';
