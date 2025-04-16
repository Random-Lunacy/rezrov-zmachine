/**
 * This module consolidates all the opcodes from different modules and provides a unified interface for them.
 */
import { ZMachine } from '../../interpreter/ZMachine';
import { Opcode, unimplementedOpcode } from './base';
import { callOpcodes } from './call';
import { controlOpcodes } from './control';
import { gameOpcodes } from './game';
import { graphicsOpcodes } from './graphics';
import { ioOpcodes } from './io';
import { mathOpcodes } from './math';
import { memoryOpcodes } from './memory';
import { objectOpcodes } from './object';
import { stackOpcodes } from './stack';
import { stringOpcodes } from './string';

// Consolidate all opcodes
const allOpcodes = {
  ...callOpcodes,
  ...controlOpcodes,
  ...gameOpcodes,
  ...graphicsOpcodes,
  ...ioOpcodes,
  ...mathOpcodes,
  ...memoryOpcodes,
  ...objectOpcodes,
  ...stackOpcodes,
  ...stringOpcodes,
};

// Version-specific operations
const versionSpecificOps = {
  pop_catch: {
    v1to4: allOpcodes.pop,
    v5plus: allOpcodes.Catch, // 'catch' is a reserved word
  },
  not_call_1n: {
    v1to4: allOpcodes.not,
    v5plus: allOpcodes.call_1n,
  },
};

// Fill Zero operand opcode array
const op0: Array<Opcode> = new Array(16).fill(unimplementedOpcode('illegal_0OP'));
op0[0] = allOpcodes.rtrue;
op0[1] = allOpcodes.rfalse;
op0[2] = allOpcodes.print;
op0[3] = allOpcodes.print_ret;
op0[4] = allOpcodes.nop;
op0[5] = allOpcodes.save;
op0[6] = allOpcodes.restore;
op0[7] = allOpcodes.restart;
op0[8] = allOpcodes.ret_popped;
op0[9] = {
  // Handle pop_catch for different versions
  mnemonic: 'pop_catch',
  impl: (machine: ZMachine, ...args: Array<number>): void => {
    const version = machine.state.version;
    const implementation =
      version <= 4 ? versionSpecificOps.pop_catch.v1to4.impl : versionSpecificOps.pop_catch.v5plus.impl;
    implementation(machine, ...args);
  },
};
op0[10] = allOpcodes.quit;
op0[11] = allOpcodes.new_line;
op0[12] = allOpcodes.show_status;
op0[13] = allOpcodes.verify;
op0[15] = allOpcodes.piracy;

// Fill One operand opcode array
const op1: Array<Opcode> = new Array(16).fill(unimplementedOpcode('illegal_1OP'));
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
op1[15] = {
  // Handle not_call_1n for different versions
  mnemonic: 'not_call_1n',
  impl: (machine: ZMachine, ...args: Array<number>): void => {
    const version = machine.state.version;
    const implementation =
      version <= 4 ? versionSpecificOps.not_call_1n.v1to4.impl : versionSpecificOps.not_call_1n.v5plus.impl;
    implementation(machine, ...args);
  },
};

// Fill Two operand opcode array
const op2: Array<Opcode> = new Array(32).fill(unimplementedOpcode('illegal_2OP'));
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
op2[27] = allOpcodes.set_colour;
op2[28] = allOpcodes.Throw; // 'throw' is a reserved word

// Fill Variable operand opcode array
const opv: Array<Opcode> = new Array(32).fill(unimplementedOpcode('illegal_VAR'));
opv[0] = allOpcodes.call_vs; // 'call' in v1-3 and 'call_vs' in v4+. Functionality is the same.
opv[1] = allOpcodes.storew;
opv[2] = allOpcodes.storeb;
opv[3] = allOpcodes.put_prop;
opv[4] = allOpcodes.sread; // Handle sread/aread for different versions
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
opv[28] = allOpcodes.encode_text;
opv[29] = allOpcodes.copy_table;
opv[30] = allOpcodes.print_table;
opv[31] = allOpcodes.check_arg_count;

// Fill Extended opcode array
const opext: Array<Opcode> = new Array(32).fill(unimplementedOpcode('illegal_EXT'));
opext[0] = allOpcodes.save;
opext[1] = allOpcodes.restore;
opext[2] = allOpcodes.log_shift;
opext[3] = allOpcodes.art_shift;
opext[4] = allOpcodes.set_font;
opext[5] = allOpcodes.draw_picture;
opext[6] = allOpcodes.picture_data;
opext[7] = allOpcodes.erase_picture;
opext[8] = allOpcodes.set_margins;
opext[9] = allOpcodes.save_undo;
opext[10] = allOpcodes.restore_undo;
opext[11] = allOpcodes.print_unicode;
opext[12] = allOpcodes.check_unicode;
opext[13] = allOpcodes.set_true_colour;
opext[16] = allOpcodes.move_window;
opext[17] = allOpcodes.window_size;
opext[18] = allOpcodes.window_style;
opext[19] = allOpcodes.get_wind_prop;
opext[20] = allOpcodes.scroll_window;
opext[21] = allOpcodes.pop_stack;
opext[22] = allOpcodes.read_mouse;
opext[23] = allOpcodes.mouse_window;
opext[24] = allOpcodes.push_stack;
opext[25] = allOpcodes.put_wind_prop;
opext[26] = allOpcodes.print_form;
opext[27] = allOpcodes.make_menu;
opext[28] = allOpcodes.picture_table;
opext[29] = allOpcodes.buffer_screen;

export { op0, op1, op2, opext as opExt, opv as opV, unimplementedOpcode };

export * from './base';
