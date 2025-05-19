import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import {
  decodeZString,
  HeaderLocation,
  InstructionForm,
  Logger,
  LogLevel,
  Memory,
  OperandType,
} from '../dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class ZCodeDisassembler {
  private memory: Memory;
  private version: number;
  private logger: Logger;
  private highMemStart: number;
  private staticMemStart: number;
  private routineAddresses: Set<number> = new Set();
  private stringAddresses: Set<number> = new Set();
  private routineCalls: Map<number, Set<number>> = new Map(); // Maps called routine address to caller addresses

  // Opcode maps for different forms
  private opcodeNames0: Map<number, string> = new Map();
  private opcodeNames1: Map<number, string> = new Map();
  private opcodeNames2: Map<number, string> = new Map();
  private opcodeNamesV: Map<number, string> = new Map();
  private opcodeNamesExt: Map<number, string> = new Map();

  constructor(memory: Memory, logger: Logger) {
    this.memory = memory;
    this.version = memory.version;
    this.logger = logger;
    this.highMemStart = memory.highMemoryStart;
    this.staticMemStart = memory.dynamicMemoryEnd;

    // Initialize opcode name maps
    this.initOpcodeNames();
  }

  private initOpcodeNames(): void {
    // 0OP opcodes
    this.opcodeNames0.set(0, 'RTRUE');
    this.opcodeNames0.set(1, 'RFALSE');
    this.opcodeNames0.set(2, 'PRINT');
    this.opcodeNames0.set(3, 'PRINT_RET');
    this.opcodeNames0.set(4, 'NOP');
    this.opcodeNames0.set(5, 'SAVE');
    this.opcodeNames0.set(6, 'RESTORE');
    this.opcodeNames0.set(7, 'RESTART');
    this.opcodeNames0.set(8, 'RET_POPPED');
    this.opcodeNames0.set(9, this.version <= 4 ? 'POP' : 'CATCH');
    this.opcodeNames0.set(10, 'QUIT');
    this.opcodeNames0.set(11, 'NEW_LINE');
    this.opcodeNames0.set(12, 'SHOW_STATUS');
    this.opcodeNames0.set(13, 'VERIFY');
    this.opcodeNames0.set(14, 'EXTENDED');
    this.opcodeNames0.set(15, 'PIRACY');

    // 1OP opcodes
    this.opcodeNames1.set(0, 'JZ');
    this.opcodeNames1.set(1, 'GET_SIBLING');
    this.opcodeNames1.set(2, 'GET_CHILD');
    this.opcodeNames1.set(3, 'GET_PARENT');
    this.opcodeNames1.set(4, 'GET_PROP_LEN');
    this.opcodeNames1.set(5, 'INC');
    this.opcodeNames1.set(6, 'DEC');
    this.opcodeNames1.set(7, 'PRINT_ADDR');
    this.opcodeNames1.set(8, 'CALL_1S');
    this.opcodeNames1.set(9, 'REMOVE_OBJ');
    this.opcodeNames1.set(10, 'PRINT_OBJ');
    this.opcodeNames1.set(11, 'RET');
    this.opcodeNames1.set(12, 'JUMP');
    this.opcodeNames1.set(13, 'PRINT_PADDR');
    this.opcodeNames1.set(14, 'LOAD');
    this.opcodeNames1.set(15, this.version <= 4 ? 'NOT' : 'CALL_1N');

    // 2OP opcodes
    this.opcodeNames2.set(1, 'JE');
    this.opcodeNames2.set(2, 'JL');
    this.opcodeNames2.set(3, 'JG');
    this.opcodeNames2.set(4, 'DEC_CHK');
    this.opcodeNames2.set(5, 'INC_CHK');
    this.opcodeNames2.set(6, 'JIN');
    this.opcodeNames2.set(7, 'TEST');
    this.opcodeNames2.set(8, 'OR');
    this.opcodeNames2.set(9, 'AND');
    this.opcodeNames2.set(10, 'TEST_ATTR');
    this.opcodeNames2.set(11, 'SET_ATTR');
    this.opcodeNames2.set(12, 'CLEAR_ATTR');
    this.opcodeNames2.set(13, 'STORE');
    this.opcodeNames2.set(14, 'INSERT_OBJ');
    this.opcodeNames2.set(15, 'LOADW');
    this.opcodeNames2.set(16, 'LOADB');
    this.opcodeNames2.set(17, 'GET_PROP');
    this.opcodeNames2.set(18, 'GET_PROP_ADDR');
    this.opcodeNames2.set(19, 'GET_NEXT_PROP');
    this.opcodeNames2.set(20, 'ADD');
    this.opcodeNames2.set(21, 'SUB');
    this.opcodeNames2.set(22, 'MUL');
    this.opcodeNames2.set(23, 'DIV');
    this.opcodeNames2.set(24, 'MOD');
    this.opcodeNames2.set(25, 'CALL_2S');
    this.opcodeNames2.set(26, 'CALL_2N');
    this.opcodeNames2.set(27, 'SET_COLOUR');
    this.opcodeNames2.set(28, 'THROW');

    // VAR opcodes
    this.opcodeNamesV.set(0, this.version <= 3 ? 'CALL' : 'CALL_VS');
    this.opcodeNamesV.set(1, 'STOREW');
    this.opcodeNamesV.set(2, 'STOREB');
    this.opcodeNamesV.set(3, 'PUT_PROP');
    this.opcodeNamesV.set(4, this.version >= 5 ? 'READ' : 'SREAD');
    this.opcodeNamesV.set(5, 'PRINT_CHAR');
    this.opcodeNamesV.set(6, 'PRINT_NUM');
    this.opcodeNamesV.set(7, 'RANDOM');
    this.opcodeNamesV.set(8, 'PUSH');
    this.opcodeNamesV.set(9, 'PULL');
    this.opcodeNamesV.set(10, 'SPLIT_WINDOW');
    this.opcodeNamesV.set(11, 'SET_WINDOW');
    this.opcodeNamesV.set(12, 'CALL_VS2');
    this.opcodeNamesV.set(13, 'ERASE_WINDOW');
    this.opcodeNamesV.set(14, 'ERASE_LINE');
    this.opcodeNamesV.set(15, 'SET_CURSOR');
    this.opcodeNamesV.set(16, 'GET_CURSOR');
    this.opcodeNamesV.set(17, 'SET_TEXT_STYLE');
    this.opcodeNamesV.set(18, 'BUFFER_MODE');
    this.opcodeNamesV.set(19, 'OUTPUT_STREAM');
    this.opcodeNamesV.set(20, 'INPUT_STREAM');
    this.opcodeNamesV.set(21, 'SOUND_EFFECT');
    this.opcodeNamesV.set(22, 'READ_CHAR');
    this.opcodeNamesV.set(23, 'SCAN_TABLE');
    this.opcodeNamesV.set(24, 'NOT');
    this.opcodeNamesV.set(25, 'CALL_VN');
    this.opcodeNamesV.set(26, 'CALL_VN2');
    this.opcodeNamesV.set(27, 'TOKENISE');
    this.opcodeNamesV.set(28, 'ENCODE_TEXT');
    this.opcodeNamesV.set(29, 'COPY_TABLE');
    this.opcodeNamesV.set(30, 'PRINT_TABLE');
    this.opcodeNamesV.set(31, 'CHECK_ARG_COUNT');

    // EXT opcodes (V5+)
    if (this.version >= 5) {
      this.opcodeNamesExt.set(0, 'SAVE');
      this.opcodeNamesExt.set(1, 'RESTORE');
      this.opcodeNamesExt.set(2, 'LOG_SHIFT');
      this.opcodeNamesExt.set(3, 'ART_SHIFT');
      this.opcodeNamesExt.set(4, 'SET_FONT');
      this.opcodeNamesExt.set(5, 'DRAW_PICTURE');
      this.opcodeNamesExt.set(6, 'PICTURE_DATA');
      this.opcodeNamesExt.set(7, 'ERASE_PICTURE');
      this.opcodeNamesExt.set(8, 'SET_MARGINS');
      this.opcodeNamesExt.set(9, 'SAVE_UNDO');
      this.opcodeNamesExt.set(10, 'RESTORE_UNDO');
      this.opcodeNamesExt.set(11, 'PRINT_UNICODE');
      this.opcodeNamesExt.set(12, 'CHECK_UNICODE');
      this.opcodeNamesExt.set(13, 'SET_TRUE_COLOUR');
    }
  }

  public disassemble(): void {
    // Find the initial PC
    const initialPC = this.memory.getWord(HeaderLocation.InitialPC);
    // First find the initial routine address
    const initialRoutineAddr = this.findContainingRoutine(initialPC);

    if (initialRoutineAddr > 0) {
      this.routineAddresses.add(initialRoutineAddr);
    } else {
      this.logger.warn(`Could not find valid routine containing initial PC at 0x${initialPC.toString(16)}`);
    }

    this.logger.info(`***** Z-CODE ANALYSIS *****\n`);

    // First pass: Identify main function and perform initial disassembly
    // to find routine calls and branch destinations
    this.disassembleRoutine(initialRoutineAddr, true);

    // We need to find more routines by following calls
    let foundNewRoutines = true;
    const processed = new Set<number>();

    // Keep finding routines until we've processed all reachable ones
    while (foundNewRoutines) {
      foundNewRoutines = false;

      // Process all known routines
      for (const addr of this.routineAddresses) {
        if (!processed.has(addr)) {
          this.disassembleRoutine(addr, true);
          processed.add(addr);
          foundNewRoutines = true;
        }
      }
    }

    // Calculate memory ranges for the z-code section
    const minRoutineAddr = Math.min(...Array.from(this.routineAddresses));
    const maxInstrAddr = Math.max(...Array.from(this.routineAddresses));

    // Second pass: Disassemble for output
    // Find the highest code address by disassembling all routines
    let highestCodeAddr = 0;
    for (const addr of this.routineAddresses) {
      const endAddr = this.findRoutineEndAddress(addr);
      if (endAddr > highestCodeAddr) {
        highestCodeAddr = endAddr;
      }
    }

    // Output the Z-code section
    this.logger.info(
      `***** Z-CODE (${minRoutineAddr.toString(16).padStart(5, '0')}-${highestCodeAddr.toString(16).padStart(5, '0')}, ${highestCodeAddr - minRoutineAddr + 1} bytes) *****\n`
    );

    // Disassemble the main routine first
    this.logger.info(`Main routine: 0x${initialRoutineAddr.toString(16).padStart(5, '0')}`);
    this.disassembleRoutine(initialRoutineAddr, false);

    // Then disassemble the remaining routines (excluding the main one)
    const sortedRoutines = Array.from(this.routineAddresses)
      .filter((addr) => addr !== initialRoutineAddr)
      .sort((a, b) => a - b);

    for (const addr of sortedRoutines) {
      // Get the callers
      const callers = this.routineCalls.get(addr) || new Set();
      const callerStr =
        callers.size > 0
          ? `Called from routine(s) at ${Array.from(callers)
              .map((c) => `0x${c.toString(16).padStart(5, '0')}`)
              .join(', ')}`
          : '';

      this.logger.info(
        `Routine: 0x${addr.toString(16).padStart(5, '0')}${callerStr ? '               ' + callerStr : ''}`
      );
      this.disassembleRoutine(addr, false);
    }

    // Output the static strings section
    this.logger.info('\n***** STATIC STRINGS *****\n');
    this.dumpStrings();
  }

  private findContainingRoutine(addr: number): number {
    // Scan backward from the address to find a valid routine header
    let routineAddr = addr;
    const maxScan = 100; // Limit how far we scan backwards

    for (let i = 0; i < maxScan && routineAddr >= this.highMemStart; i++) {
      routineAddr--;
      try {
        // Check if this might be a routine header
        const numLocals = this.memory.getByte(routineAddr);

        // Check if this would be a valid routine with reasonable local count
        if (numLocals <= 15) {
          // For V1-4, check that we have enough space for locals
          if (this.version <= 4) {
            const localVarsSpace = 1 + numLocals * 2;
            if (routineAddr + localVarsSpace > addr) {
              continue; // Not enough space
            }

            // Check the first instruction at routineAddr + 1 + numLocals * 2
            if (this.isValidInstruction(routineAddr + localVarsSpace)) {
              return routineAddr;
            }
          } else {
            // For V5+, only need to check the locals count byte
            if (this.isValidInstruction(routineAddr + 1)) {
              return routineAddr;
            }
          }
        }
      } catch (e) {
        // Skip on memory access errors
      }
    }

    // If we get here, we didn't find a valid routine header
    return 0;
  }

  private isValidInstruction(addr: number): boolean {
    try {
      const opcode = this.memory.getByte(addr);

      // Simple validation check: try to decode the instruction
      this.decodeInstruction(opcode, addr + 1);
      return true;
    } catch (e) {
      return false;
    }
  }

  private disassembleRoutine(routineAddr: number, analyzeOnly: boolean = false): void {
    if (routineAddr === 0 || routineAddr >= this.memory.size) {
      return;
    }

    try {
      // Get routine header info
      const numLocals = this.memory.getByte(routineAddr);

      if (numLocals > 15) {
        // Not a valid routine header - locals count too high
        return;
      }

      let pc = routineAddr + 1;

      // Output routine header if not in analysis mode
      if (!analyzeOnly) {
        this.logger.info(
          `${routineAddr.toString(16).padStart(5, '0')} ${numLocals.toString().padStart(2, '0')}                       ${numLocals > 0 ? numLocals : 'No'} local${numLocals !== 1 ? 's' : ''}\n`
        );
      }

      // For V1-4, output local variable initial values
      if (this.version <= 4 && numLocals > 0) {
        let localsLine = '';
        let valuesText = '';

        for (let i = 0; i < numLocals; i++) {
          try {
            const localValue = this.memory.getWord(pc);

            if (!analyzeOnly) {
              localsLine += `${(localValue & 0xff).toString(16).padStart(2, '0')}${((localValue >> 8) & 0xff).toString(16).padStart(2, '0')} `;
              valuesText += `L${i.toString().padStart(2, '0')}=0x${localValue.toString(16).padStart(4, '0')} `;
            }

            pc += 2;
          } catch (e) {
            // Skip on errors
            pc += 2;
          }
        }

        if (!analyzeOnly && localsLine) {
          this.logger.info(`${pc.toString(16).padStart(5, '0')} ${localsLine.padEnd(28)}${valuesText}\n`);
        }
      }

      // Disassemble routine body
      return this.disassembleFrom(pc, analyzeOnly);
    } catch (error) {
      this.logger.warn(`Error disassembling routine at 0x${routineAddr.toString(16)}: ${error}`);
    }
  }

  private findRoutineEndAddress(routineAddr: number): number {
    try {
      const numLocals = this.memory.getByte(routineAddr);

      // Calculate the start of code
      let pc = routineAddr + 1;
      if (this.version <= 4) {
        pc += numLocals * 2; // Skip local variable initializations
      }

      // Trace until we hit a return instruction or the next routine
      let lastInstrAddr = pc;

      while (pc < this.memory.size) {
        try {
          const startInsAddr = pc;
          const opcode = this.memory.getByte(pc++);

          // Check if this looks like a routine header (this would be the start of the next routine)
          // for safety, only consider it a routine boundary if it's one we already identified
          if (this.routineAddresses.has(startInsAddr)) {
            return lastInstrAddr;
          }

          const { form, opcodeNumber, operandTypes, nextPC } = this.decodeInstruction(opcode, pc);
          pc = nextPC;

          // Update the last instruction address
          lastInstrAddr = pc - 1;

          // Read operands based on types
          for (const opType of operandTypes) {
            if (opType === OperandType.Large) {
              pc += 2;
            } else if (opType === OperandType.Small || opType === OperandType.Variable) {
              pc += 1;
            }
          }

          // Read variable number and/or branch offset if needed
          if (this.hasStoreVar(form, opcodeNumber)) {
            pc += 1;
          }

          if (this.hasBranch(form, opcodeNumber)) {
            // Skip the branch offset
            const branch = this.memory.getByte(pc++);
            if ((branch & 0x40) === 0) {
              // 2-byte offset
              pc += 1;
            }
          }

          // Special handling for text-containing opcodes
          const opName = this.getOpcodeName(form, opcodeNumber);
          if (opName === 'PRINT') {
            // Skip until the end of the string (high bit set)
            let endFound = false;
            while (!endFound && pc < this.memory.size) {
              const word = this.memory.getWord(pc);
              pc += 2;
              if ((word & 0x8000) !== 0) {
                endFound = true;
              }
            }
          }

          // Check if we've hit a return or other terminating instruction
          if (
            opName === 'RTRUE' ||
            opName === 'RFALSE' ||
            opName === 'RET' ||
            opName === 'RET_POPPED' ||
            opName === 'QUIT' ||
            opName === 'THROW'
          ) {
            return pc - 1;
          }
        } catch (error) {
          // In case of error, move to next byte and continue
          pc++;
        }
      }

      return lastInstrAddr;
    } catch (error) {
      return routineAddr;
    }
  }

  private disassembleFrom(startPC: number, analyzeOnly: boolean = false): void {
    let pc = startPC;
    const instructionBytes: Map<number, Array<number>> = new Map();

    // Loop until we reach a return opcode or an error
    while (pc < this.memory.size) {
      try {
        const startInsAddr = pc; // Remember where this instruction started
        instructionBytes.set(startInsAddr, []);

        const opcode = this.memory.getByte(pc++);
        instructionBytes.get(startInsAddr)?.push(opcode);

        // Check if this looks like a routine header (this would be the start of the next routine)
        if (this.routineAddresses.has(startInsAddr)) {
          // We've hit the next routine, stop disassembling
          break;
        }

        const { form, opcodeNumber, operandTypes, nextPC } = this.decodeInstruction(opcode, pc);

        // Add the type bytes if any
        if (form === InstructionForm.Extended || form === InstructionForm.Variable) {
          for (let i = pc; i < nextPC; i++) {
            instructionBytes.get(startInsAddr)?.push(this.memory.getByte(i));
          }
        }

        pc = nextPC; // Update the PC with the value returned from decodeInstruction

        // Get the opcode name
        let opName = this.getOpcodeName(form, opcodeNumber);
        if (!opName) {
          opName = `UNKNOWN_${form}_${opcodeNumber}`;
        }

        // Read operands based on types
        const operands: number[] = [];

        for (const opType of operandTypes) {
          if (opType === OperandType.Large) {
            const val = this.memory.getWord(pc);
            operands.push(val);
            instructionBytes.get(startInsAddr)?.push(val & 0xff, (val >> 8) & 0xff);
            pc += 2;
          } else if (opType === OperandType.Small) {
            const val = this.memory.getByte(pc);
            operands.push(val);
            instructionBytes.get(startInsAddr)?.push(val);
            pc += 1;
          } else if (opType === OperandType.Variable) {
            const val = this.memory.getByte(pc);
            operands.push(val);
            instructionBytes.get(startInsAddr)?.push(val);
            pc += 1;
          }
        }

        // Read variable number and/or branch offset if needed
        let storeVar: number | null = null;
        let branchInfo = '';
        let branchTarget = 0;

        if (this.hasStoreVar(form, opcodeNumber)) {
          storeVar = this.memory.getByte(pc);
          instructionBytes.get(startInsAddr)?.push(storeVar);
          pc += 1;
        }

        if (this.hasBranch(form, opcodeNumber)) {
          const branch = this.memory.getByte(pc);
          instructionBytes.get(startInsAddr)?.push(branch);
          pc += 1;

          let offset;
          const branchOn = (branch & 0x80) !== 0;

          if ((branch & 0x40) !== 0) {
            // 1-byte offset
            offset = branch & 0x3f;
            if (offset === 0) {
              branchInfo = `[${branchOn ? 'TRUE' : 'FALSE'} -> RFALSE]`;
            } else if (offset === 1) {
              branchInfo = `[${branchOn ? 'TRUE' : 'FALSE'} -> RTRUE]`;
            } else {
              const targetPC = pc + offset - 2;
              branchInfo = `[${branchOn ? 'TRUE' : 'FALSE'} -> ${targetPC.toString(16).padStart(5, '0')}]`;
              branchTarget = targetPC;
            }
          } else {
            // 2-byte offset
            const second = this.memory.getByte(pc);
            instructionBytes.get(startInsAddr)?.push(second);
            pc += 1;

            offset = ((branch & 0x3f) << 8) | second;
            if ((branch & 0x20) !== 0) {
              // Negative offset (signed 14-bit)
              offset = offset - 0x4000;
            }

            const targetPC = pc + offset - 2;
            branchInfo = `[${branchOn ? 'TRUE' : 'FALSE'} -> ${targetPC.toString(16).padStart(5, '0')}]`;
            branchTarget = targetPC;
          }

          // If we branch to a valid address, add it to routine addresses
          if (branchTarget > 0 && branchTarget >= this.highMemStart && branchTarget < this.memory.size) {
            // See if this is the start of a routine
            const routineStart = this.findContainingRoutine(branchTarget);
            if (routineStart > 0 && routineStart !== startInsAddr) {
              this.routineAddresses.add(routineStart);
            }
          }
        }

        // Special handling for text-containing opcodes
        let textString = '';
        const textBytes: number[] = [];

        if (opName === 'PRINT') {
          const zstring: number[] = [];
          let keepReading = true;

          while (keepReading && pc < this.memory.size) {
            const word = this.memory.getWord(pc);
            textBytes.push(word & 0xff, (word >> 8) & 0xff);
            pc += 2;

            zstring.push((word >> 10) & 0x1f);
            zstring.push((word >> 5) & 0x1f);
            zstring.push(word & 0x1f);

            if ((word & 0x8000) !== 0) {
              keepReading = false;
            }
          }

          instructionBytes.get(startInsAddr)?.push(...textBytes);
          textString = decodeZString(this.memory, zstring);
        } else if (opName === 'PRINT_PADDR' && operands.length === 1) {
          // Register the string address
          try {
            const addr = this.memory.unpackStringAddress(operands[0]);
            this.stringAddresses.add(addr);

            // Try to decode the string for annotation
            try {
              const zstring = this.memory.getZString(addr);
              textString = decodeZString(this.memory, zstring);

              // Add string number
              const stringIndex =
                Array.from(this.stringAddresses)
                  .sort((a, b) => a - b)
                  .indexOf(addr) + 1;
              textString = `S${stringIndex.toString().padStart(4, '0')} "${textString}"`;
            } catch (e) {
              // Ignore errors in string decoding
            }
          } catch (e) {
            // Ignore errors in address unpacking
          }
        } else if (
          (opName === 'CALL' || opName === 'CALL_VS' || opName === 'CALL_1S' || opName === 'CALL_2S') &&
          operands.length > 0
        ) {
          // Register the routine address for potential disassembly
          try {
            const routineAddr = operands[0] > 0 ? this.memory.unpackRoutineAddress(operands[0]) : 0;
            if (routineAddr > 0) {
              this.routineAddresses.add(routineAddr);

              // Register the caller-callee relationship
              if (!this.routineCalls.has(routineAddr)) {
                this.routineCalls.set(routineAddr, new Set());
              }
              this.routineCalls.get(routineAddr)?.add(this.findContainingRoutine(startInsAddr));
            }
          } catch (e) {
            // Ignore errors in routine address unpacking
          }
        }

        // Don't output during analysis phase
        if (!analyzeOnly) {
          // Format the disassembly line
          const addrText = startInsAddr.toString(16).padStart(5, '0');

          // Format instruction bytes
          const bytes = instructionBytes.get(startInsAddr) || [];
          const bytesText = bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

          // If this is a PRINT instruction, format it with nice alignment
          if (opName === 'PRINT') {
            // First line: address and first 8 bytes (if available)
            const firstLine = bytesText.split(' ').slice(0, 8).join(' ');
            this.logger.info(`${addrText} ${firstLine.padEnd(23)} ${opName} "${textString}"`);

            // If there are more bytes, continue on new lines with proper indentation
            const remainingBytes = bytesText.split(' ').slice(8);
            for (let i = 0; i < remainingBytes.length; i += 8) {
              const chunk = remainingBytes.slice(i, i + 8).join(' ');
              if (chunk.trim().length > 0) {
                this.logger.info(`      ${chunk.padEnd(23)}`);
              }
            }
          }
          // Special alignment for PRINT_PADDR
          else if (opName === 'PRINT_PADDR' && textString) {
            const operandText = operands.map((op) => this.formatOperand(op, opName)).join(', ');
            this.logger.info(`${addrText} ${bytesText.padEnd(23)} ${opName} ${operandText} "${textString}"`);
          }
          // Standard formatting for other instructions
          else {
            // Format operand list for display
            const operandText = operands.map((op) => this.formatOperand(op, opName)).join(', ');

            // Build the final disassembly line
            let disassembly = `${addrText} ${bytesText.padEnd(23)} ${opName}`;

            if (operands.length > 0) {
              disassembly += ` ${operandText}`;
            }

            if (storeVar !== null) {
              disassembly += ` -> G${storeVar}`;
            }

            if (branchInfo) {
              disassembly += ` ${branchInfo}`;
            }

            this.logger.info(disassembly);
          }
        }

        // Check if we've hit a return or other terminating instruction
        if (
          opName === 'RTRUE' ||
          opName === 'RFALSE' ||
          opName === 'RET' ||
          opName === 'RET_POPPED' ||
          opName === 'QUIT' ||
          opName === 'THROW'
        ) {
          break;
        }
      } catch (error) {
        // Handle disassembly errors
        this.logger.warn(`Error at 0x${pc.toString(16)}: ${error}`);
        break;
      }
    }

    // Add a blank line after each routine if not in analysis mode
    if (!analyzeOnly) {
      this.logger.info('');
    }
  }

  private formatOperand(value: number, opName: string): string {
    // For certain opcodes, we want to show the operand in a specific format
    if ((opName === 'CALL' || opName === 'CALL_VS' || opName === 'CALL_1S' || opName === 'CALL_2S') && value > 0) {
      try {
        // Try to format as a routine address
        const addr = this.memory.unpackRoutineAddress(value);
        return `0x${addr.toString(16).padStart(5, '0')}`;
      } catch (e) {
        return `0x${value.toString(16)}`;
      }
    } else if (opName === 'PRINT_PADDR') {
      // Try to get the string number
      try {
        const addr = this.memory.unpackStringAddress(value);
        const stringIndex =
          Array.from(this.stringAddresses)
            .sort((a, b) => a - b)
            .indexOf(addr) + 1;
        return `S${stringIndex.toString().padStart(4, '0')}`;
      } catch (e) {
        return value.toString();
      }
    } else if (value >= 16 && value <= 255) {
      // Regular values shown as decimal
      return value.toString();
    } else if (value > 255) {
      return `0x${value.toString(16)}`;
    } else {
      return value.toString();
    }
  }

  private decodeInstruction(
    opcode: number,
    pc: number
  ): {
    form: InstructionForm;
    opcodeNumber: number;
    operandTypes: OperandType[];
    nextPC: number; // Return the updated PC
  } {
    let operandTypes: OperandType[] = [];
    let form: InstructionForm;
    let opcodeNumber: number;
    let nextPC = pc; // Track where we are reading from

    if (opcode === 0xbe && this.version >= 5) {
      // Extended form (only in V5+)
      form = InstructionForm.Extended;
      opcodeNumber = this.memory.getByte(nextPC++);
      const typesByte = this.memory.getByte(nextPC++);
      operandTypes = this.decodeOperandTypes(typesByte);
    } else if ((opcode & 0xc0) === 0xc0) {
      // Variable form
      form = InstructionForm.Variable;
      const isVarForm = (opcode & 0x20) !== 0;
      const typesByte = this.memory.getByte(nextPC++);
      operandTypes = this.decodeOperandTypes(typesByte);
      opcodeNumber = opcode & 0x1f;
    } else if ((opcode & 0x80) === 0x80) {
      // Short form
      form = InstructionForm.Short;
      const opType = (opcode & 0x30) >> 4;
      if (opType !== OperandType.Omitted) {
        operandTypes = [opType];
      }
      opcodeNumber = opcode & 0x0f;
    } else {
      // Long form
      form = InstructionForm.Long;
      operandTypes.push((opcode & 0x40) === 0x40 ? OperandType.Variable : OperandType.Small);
      operandTypes.push((opcode & 0x20) === 0x20 ? OperandType.Variable : OperandType.Small);
      opcodeNumber = opcode & 0x1f;
    }

    return { form, opcodeNumber, operandTypes, nextPC };
  }

  private decodeOperandTypes(typesByte: number): OperandType[] {
    const operandTypes: OperandType[] = [];
    for (let i = 0; i < 4; i++) {
      const opType = (typesByte >> ((3 - i) * 2)) & 0x03;
      if (opType !== OperandType.Omitted) {
        operandTypes.push(opType);
      } else {
        break;
      }
    }
    return operandTypes;
  }

  private getOpcodeName(form: InstructionForm, opcodeNumber: number): string | undefined {
    switch (form) {
      case InstructionForm.Short:
        return this.opcodeNames0.get(opcodeNumber);
      case InstructionForm.Long:
        return this.opcodeNames2.get(opcodeNumber);
      case InstructionForm.Variable:
        return this.opcodeNamesV.get(opcodeNumber);
      case InstructionForm.Extended:
        return this.opcodeNamesExt.get(opcodeNumber);
      default:
        return undefined;
    }
  }

  private hasStoreVar(form: InstructionForm, opcodeNumber: number): boolean {
    // List of opcodes that store a result in a variable
    const storeVarOpcodes1 = new Set(['GET_SIBLING', 'GET_CHILD', 'GET_PARENT', 'GET_PROP_LEN', 'LOAD']);
    const storeVarOpcodes2 = new Set([
      'OR',
      'AND',
      'GET_PROP',
      'GET_PROP_ADDR',
      'GET_NEXT_PROP',
      'ADD',
      'SUB',
      'MUL',
      'DIV',
      'MOD',
    ]);
    const storeVarOpcodesV = new Set(['CALL', 'CALL_VS', 'RANDOM', 'SCAN_TABLE']);
    const storeVarOpcodesExt = new Set([
      'LOG_SHIFT',
      'ART_SHIFT',
      'SET_FONT',
      'SAVE',
      'RESTORE',
      'SAVE_UNDO',
      'RESTORE_UNDO',
    ]);

    const opName = this.getOpcodeName(form, opcodeNumber);
    if (!opName) return false;

    switch (form) {
      case InstructionForm.Short:
        return false; // 0OP opcodes don't store results
      case InstructionForm.Long:
        return storeVarOpcodes2.has(opName);
      case InstructionForm.Variable:
        return storeVarOpcodesV.has(opName);
      case InstructionForm.Extended:
        return storeVarOpcodesExt.has(opName);
      default:
        return false;
    }
  }

  private hasBranch(form: InstructionForm, opcodeNumber: number): boolean {
    // List of opcodes that have branch instructions
    const branchOpcodes1 = new Set(['JZ', 'GET_SIBLING', 'GET_CHILD']);
    const branchOpcodes2 = new Set(['JE', 'JL', 'JG', 'DEC_CHK', 'INC_CHK', 'JIN', 'TEST', 'TEST_ATTR']);
    const branchOpcodesV = new Set(['SCAN_TABLE']);
    const branchOpcodesExt = new Set(['PICTURE_DATA']);

    const opName = this.getOpcodeName(form, opcodeNumber);
    if (!opName) return false;

    switch (form) {
      case InstructionForm.Short:
        return branchOpcodes1.has(opName);
      case InstructionForm.Long:
        return branchOpcodes2.has(opName);
      case InstructionForm.Variable:
        return branchOpcodesV.has(opName);
      case InstructionForm.Extended:
        return branchOpcodesExt.has(opName);
      default:
        return false;
    }
  }

  private dumpStrings(): void {
    // Sort string addresses
    const sortedAddresses = [...this.stringAddresses].sort((a, b) => a - b);

    let stringIndex = 1;
    for (const addr of sortedAddresses) {
      try {
        const zstring = this.memory.getZString(addr);
        const text = decodeZString(this.memory, zstring);

        const addrText = addr.toString(16).padStart(5, '0');
        this.logger.info(`${addrText} S${stringIndex.toString().padStart(4, '0')} "${text}"`);
        stringIndex++;
      } catch (error) {
        // Skip invalid strings
      }
    }
  }
}

async function runZCodeDisassemblerExample(storyFilePath: string): Promise<void> {
  const logger = new Logger('ZCodeDisassembler');
  Logger.setLevel(LogLevel.INFO);
  logger.info(`Loading Z-machine story file: ${storyFilePath}`);

  try {
    const storyData = fs.readFileSync(storyFilePath);
    logger.info(`Loaded ${storyData.length} bytes from story file`);

    const memory = new Memory(storyData);
    const version = memory.getByte(HeaderLocation.Version);
    const highMemStart = memory.highMemoryStart;
    const staticMemStart = memory.dynamicMemoryEnd;
    const initialPC = memory.getWord(HeaderLocation.InitialPC);

    // Output basic information
    logger.info(`\n----- STORY FILE INFORMATION -----`);
    logger.info(`Z-machine version: ${version}`);
    logger.info(`High memory starts at: 0x${highMemStart.toString(16).padStart(5, '0')}`);
    logger.info(`Static memory starts at: 0x${staticMemStart.toString(16).padStart(5, '0')}`);
    logger.info(`Initial PC: 0x${initialPC.toString(16).padStart(5, '0')}`);

    // Disassemble the Z-code
    const disassembler = new ZCodeDisassembler(memory, logger);
    disassembler.disassemble();
  } catch (error) {
    logger.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      logger.debug(error.stack);
    }
  }
}

// Main execution
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

if (isMainModule) {
  const storyPath = process.argv[2] || path.join(__dirname, '../tests/fixtures/minimal.z3');
  const logger = new Logger('ZCodeDisassembler');
  logger.info(`Running ZCodeDisassembler with story file: ${storyPath}`);

  runZCodeDisassemblerExample(storyPath)
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error(`Unhandled error: ${err}`);
      process.exit(1);
    });
}

export { runZCodeDisassemblerExample };
