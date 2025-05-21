import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import {
  decodeZString,
  Executor,
  HeaderLocation,
  InputState,
  InstructionForm,
  Logger,
  LogLevel,
  Memory,
  OperandType,
  ZMachine,
} from '../dist/index.js';

// For minimal implementations of required interfaces
import { BaseInputProcessor } from '../dist/ui/input/InputInterface.js';
import { BaseScreen } from '../dist/ui/screen/BaseScreen.js';
import { Capabilities, ScreenSize } from '../dist/ui/screen/interfaces.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates a state-preserving wrapper for decoding Z-machine instructions
 */
class InstructionDecoder {
  private zMachine: ZMachine;
  private executor: Executor;
  private memory: Memory;
  private originalPC: number;

  constructor(zMachine: ZMachine) {
    this.zMachine = zMachine;
    this.executor = zMachine.executor;
    this.memory = zMachine.memory;
  }

  /**
   * Decode an instruction at a specific address without affecting machine state
   */
  decodeAt(address: number): {
    form: InstructionForm;
    opcodeNumber: number;
    operandTypes: Array<OperandType>;
    operands: Array<number>;
    bytes: number[];
    length: number;
    opname: string;
    storeVar?: number;
    branchInfo?: { target: number; condition: boolean };
    text?: string;
  } {
    // Save original state
    this.originalPC = this.zMachine.state.pc;
    const bytes: number[] = [];

    try {
      // Set PC to the target address for decoding
      this.zMachine.state.pc = address;
      let pc = address;

      // Read opcode byte
      const opcodeByte = this.memory.getByte(pc++);
      bytes.push(opcodeByte);

      // Use executor to decode instruction form and operand types
      const { form, reallyVariable, opcodeNumber, operandTypes } = this.executor.decodeInstruction(
        opcodeByte,
        this.zMachine.state
      );

      // Track bytes consumed by opcode and type bytes
      const afterTypeBytes = this.zMachine.state.pc;
      for (let i = pc; i < afterTypeBytes; i++) {
        bytes.push(this.memory.getByte(i));
      }
      pc = afterTypeBytes;

      // Read operands
      const operands = this.executor.readOperands(operandTypes, this.zMachine.state);

      // Track bytes consumed by operands
      const afterOperands = this.zMachine.state.pc;
      for (let i = pc; i < afterOperands; i++) {
        bytes.push(this.memory.getByte(i));
      }
      pc = afterOperands;

      // Resolve opcode name safely
      let opname: string;
      try {
        const op = this.executor.resolveOpcode(
          form,
          reallyVariable,
          opcodeNumber,
          operands.length,
          address,
          opcodeByte
        );
        opname = op.mnemonic;
      } catch (e) {
        // Fallback for unknown opcodes
        opname = `UNKNOWN_${opcodeNumber.toString(16)}`;
      }

      // Special case: Store variable
      let storeVar: number | undefined;
      if (this.storesVariable(opname)) {
        storeVar = this.memory.getByte(pc++);
        bytes.push(storeVar);
      }

      // Special case: Branch instructions
      let branchInfo: { target: number; condition: boolean } | undefined;
      if (this.hasBranch(opname)) {
        const branch = this.memory.getByte(pc++);
        bytes.push(branch);

        const branchOn = (branch & 0x80) !== 0;

        if ((branch & 0x40) !== 0) {
          // 1-byte offset
          const offset = branch & 0x3f;
          if (offset > 1) {
            const targetPC = pc + offset - 2;
            branchInfo = { target: targetPC, condition: branchOn };
          }
          // offset 0 = RFALSE, offset 1 = RTRUE - no target needed
        } else {
          // 2-byte offset
          const second = this.memory.getByte(pc++);
          bytes.push(second);

          let offset = ((branch & 0x3f) << 8) | second;
          if ((branch & 0x20) !== 0) {
            // Negative offset (signed 14-bit)
            offset = offset - 0x4000;
          }

          const targetPC = pc + offset - 2;
          branchInfo = { target: targetPC, condition: branchOn };
        }
      }

      // Special case: PRINT opcode with embedded Z-string
      let text: string | undefined;
      if (opname === 'PRINT') {
        const zchars: number[] = [];
        let endFound = false;

        while (!endFound && pc < this.memory.size) {
          const word = this.memory.getWord(pc);
          bytes.push(word & 0xff, (word >> 8) & 0xff);
          pc += 2;

          // Extract Z-characters from the word
          zchars.push((word >> 10) & 0x1f);
          zchars.push((word >> 5) & 0x1f);
          zchars.push(word & 0x1f);

          // Check for end of string (high bit set)
          if ((word & 0x8000) !== 0) {
            endFound = true;
          }
        }

        // Decode the Z-string
        text = decodeZString(this.memory, zchars).replace(/\n/g, '^');
      }

      // Calculate final instruction length
      const length = pc - address;

      return {
        form,
        opcodeNumber,
        operandTypes,
        operands,
        bytes,
        length,
        opname,
        storeVar,
        branchInfo,
        text,
      };
    } finally {
      // Always restore original state
      this.zMachine.state.pc = this.originalPC;
    }
  }

  /**
   * Check if opcode stores variables
   */
  private storesVariable(opname: string): boolean {
    // Opcodes that store results to a variable
    const storeOpcodes = [
      'GET_SIBLING',
      'GET_CHILD',
      'GET_PARENT',
      'GET_PROP_LEN',
      'LOAD',
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
      'CALL',
      'CALL_VS',
      'CALL_1S',
      'CALL_2S',
      'RANDOM',
      'SCAN_TABLE',
      'LOG_SHIFT',
      'ART_SHIFT',
      'SET_FONT',
      'SAVE',
      'RESTORE',
      'SAVE_UNDO',
      'RESTORE_UNDO',
      'NOT',
    ];

    return storeOpcodes.includes(opname);
  }

  /**
   * Check if opcode has a branch
   */
  private hasBranch(opname: string): boolean {
    // Opcodes that have branch offsets
    const branchOpcodes = [
      'JZ',
      'GET_SIBLING',
      'GET_CHILD',
      'JE',
      'JL',
      'JG',
      'DEC_CHK',
      'INC_CHK',
      'JIN',
      'TEST',
      'TEST_ATTR',
      'SCAN_TABLE',
      'PICTURE_DATA',
    ];

    return branchOpcodes.includes(opname);
  }
}

/**
 * Minimal implementation of Screen interface for disassembler
 */
class MinimalScreen extends BaseScreen {
  constructor() {
    super('Disassembler', { logger: new Logger('MinimalScreen') });
  }

  getCapabilities(): Capabilities {
    return {
      hasColors: false,
      hasBold: false,
      hasItalic: false,
      hasFixedPitch: false,
      hasReverseVideo: false,
      hasSplitWindow: false,
      hasDisplayStatusBar: false,
      hasPictures: false,
      hasSound: false,
      hasTimedKeyboardInput: false,
    };
  }

  getSize(): ScreenSize {
    return { rows: 25, cols: 80 };
  }

  print(_machine: ZMachine, _str: string): void {
    // No-op for disassembler
  }
}

/**
 * Minimal implementation of InputProcessor interface for disassembler
 */
class MinimalInputProcessor extends BaseInputProcessor {
  constructor() {
    super();
  }

  protected doStartTextInput(_machine: ZMachine, _state: InputState): void {
    // No-op for disassembler
  }

  protected doStartCharInput(_machine: ZMachine, _state: InputState): void {
    // No-op for disassembler
  }

  async promptForFilename(_machine: ZMachine, _operation: string): Promise<string> {
    return 'dummy.sav';
  }
}

/**
 * Z-Machine code disassembler using the Executor class for opcode decoding
 */
class ZCodeDisassembler {
  private memory: Memory;
  private version: number;
  private logger: Logger;
  private highMemStart: number;
  private staticMemStart: number;
  private routineAddresses: Set<number> = new Set();
  private stringAddresses: Set<number> = new Set();
  private routineCalls: Map<number, Set<number>> = new Map(); // Maps called routine address to caller addresses
  private zMachine: ZMachine;
  private executor: Executor;
  private decoder: InstructionDecoder;

  constructor(storyData: Buffer, logger: Logger) {
    this.logger = logger;

    // Use the real ZMachine implementation
    this.memory = new Memory(storyData);
    this.version = this.memory.version;
    this.highMemStart = this.memory.highMemoryStart;
    this.staticMemStart = this.memory.dynamicMemoryEnd;

    // Create minimal screen and input processor
    const screen = new MinimalScreen();
    const inputProcessor = new MinimalInputProcessor();

    // Create a real ZMachine instance
    this.zMachine = new ZMachine(storyData, screen, inputProcessor, undefined, undefined, {
      logger: new Logger('ZMachine'),
    });

    // Get the executor from the ZMachine
    this.executor = this.zMachine.executor;
    this.decoder = new InstructionDecoder(this.zMachine);
  }

  /**
   * Main disassembly method - identifies and disassembles all routines
   */
  public disassemble(): void {
    // Find the initial PC
    const initialPC = this.memory.getWord(HeaderLocation.InitialPC);

    // Find the main routine address based on the initial PC
    const mainRoutineAddr = this.findMainRoutineAddress(initialPC);

    // Add the main routine to our set of known routines
    this.routineAddresses.add(mainRoutineAddr);

    this.logger.info(`***** Z-CODE ANALYSIS *****\n`);
    this.logger.info(`Initial PC: 0x${initialPC.toString(16).padStart(5, '0')}`);
    this.logger.info(`Main routine start: 0x${mainRoutineAddr.toString(16).padStart(5, '0')}\n`);

    // First pass: Disassemble the main routine to find calls to other routines
    this.disassembleRoutine(mainRoutineAddr, true);

    // Iteratively discover and analyze all routines
    // Keep processing until we don't find any new routines
    let prevRoutineCount = 0;
    while (this.routineAddresses.size > prevRoutineCount) {
      prevRoutineCount = this.routineAddresses.size;

      // Analyze all new routines to find more routine calls
      for (const addr of this.routineAddresses) {
        this.disassembleRoutine(addr, true);
      }
    }

    // Calculate memory ranges for the z-code section
    const minRoutineAddr = Math.min(...Array.from(this.routineAddresses));

    // Optionally scan for additional routine headers that might not be called directly
    this.scanForRoutineHeaders();

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
    this.logger.info(`Main routine: 0x${mainRoutineAddr.toString(16).padStart(5, '0')}`);
    this.disassembleRoutine(mainRoutineAddr, false);

    // Then disassemble the remaining routines (excluding the main one)
    const sortedRoutines = Array.from(this.routineAddresses)
      .filter((addr) => addr !== mainRoutineAddr)
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

  /**
   * Finds the end address of a routine by tracing through its instructions
   */
  private findRoutineEndAddress(routineAddr: number): number {
    try {
      // Get the number of locals
      const numLocals = this.memory.getByte(routineAddr);

      // Validate this is a real routine
      if (numLocals > 15) {
        this.logger.warn(`Implausible number of locals at 0x${routineAddr.toString(16)}: ${numLocals}`);
        return routineAddr;
      }

      // Calculate the start of code
      let pc = routineAddr + 1;
      if (this.version <= 4) {
        pc += numLocals * 2; // Skip local variable initializations in v1-4
      }

      let lastInstrAddr = pc;

      // Trace through instructions
      while (pc < this.memory.size) {
        // Check if this address is the start of another known routine
        if (pc !== routineAddr && this.routineAddresses.has(pc)) {
          return pc - 1;
        }

        try {
          // Use our decoder to get complete instruction info
          const instruction = this.decoder.decodeAt(pc);
          lastInstrAddr = pc + instruction.length - 1;

          // Check for return instructions
          if (['RTRUE', 'RFALSE', 'RET', 'RET_POPPED', 'QUIT'].includes(instruction.opname)) {
            return lastInstrAddr;
          }

          // Move to next instruction
          pc += instruction.length;
        } catch (e) {
          // If decoding fails, skip one byte
          pc += 1;
        }
      }

      return lastInstrAddr;
    } catch (e) {
      this.logger.warn(`Error finding routine end: ${e}`);
      return routineAddr;
    }
  }

  /**
   * Disassembles a single routine
   */
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
              localsLine += `${(localValue & 0xff).toString(16).padStart(2, '0')} ${((localValue >> 8) & 0xff).toString(16).padStart(2, '0')} `;
              valuesText += `L${i.toString().padStart(2, '0')}=0x${localValue.toString(16).padStart(4, '0')} `;
            }

            pc += 2;
          } catch (e) {
            // Skip on errors
            pc += 2;
          }
        }

        if (!analyzeOnly && localsLine) {
          this.logger.info(`${routineAddr.toString(16).padStart(5, '0')} ${localsLine.padEnd(28)}${valuesText}\n`);
        }
      }

      // Disassemble routine body
      this.disassembleInstructions(pc, analyzeOnly);
    } catch (error) {
      this.logger.warn(`Error disassembling routine at 0x${routineAddr.toString(16)}: ${error}`);
    }
  }

  /**
   * Disassembles instructions starting from a given address
   */
  private disassembleInstructions(startPC: number, analyzeOnly: boolean = false): void {
    let pc = startPC;

    // Loop until we reach a return opcode or a new routine
    while (pc < this.memory.size) {
      try {
        const instructionStart = pc;

        // Check if this is another routine's start
        if (pc > startPC && this.routineAddresses.has(pc)) {
          break;
        }

        // Use our decoder to get complete instruction info
        const instruction = this.decoder.decodeAt(pc);

        // Move to next instruction
        pc += instruction.length;

        // Register routine calls
        if (
          (instruction.opname === 'CALL' ||
            instruction.opname === 'CALL_VS' ||
            instruction.opname === 'CALL_1S' ||
            instruction.opname === 'CALL_2S') &&
          instruction.operands.length > 0
        ) {
          try {
            const routineAddr =
              instruction.operands[0] > 0 ? this.memory.unpackRoutineAddress(instruction.operands[0]) : 0;

            if (routineAddr > 0) {
              this.routineAddresses.add(routineAddr);

              // Register caller-callee relationship
              if (!this.routineCalls.has(routineAddr)) {
                this.routineCalls.set(routineAddr, new Set());
              }

              // Find containing routine
              const containingRoutine = this.findContainingRoutine(instructionStart);
              if (containingRoutine > 0) {
                this.routineCalls.get(routineAddr)?.add(containingRoutine);
              }
            }
          } catch (e) {
            // Ignore errors in routine address unpacking
          }
        }

        // Print instruction if not in analysis mode
        if (!analyzeOnly) {
          this.printInstruction(instructionStart, instruction);
        }

        // Check if we've hit a terminating instruction
        if (['RTRUE', 'RFALSE', 'RET', 'RET_POPPED', 'QUIT'].includes(instruction.opname)) {
          break;
        }
      } catch (error) {
        // Handle disassembly errors
        if (!analyzeOnly) {
          this.logger.warn(`Error at 0x${pc.toString(16)}: ${error}`);
        }
        pc++;
      }
    }

    // Add a blank line after each routine if not in analysis mode
    if (!analyzeOnly) {
      this.logger.info('');
    }
  }

  // Helper method to print a formatted instruction
  private printInstruction(address: number, instruction: ReturnType<InstructionDecoder['decodeAt']>): void {
    const addrText = address.toString(16).padStart(5, '0');
    const bytesText = instruction.bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');

    // Special handling for PRINT instruction
    if (instruction.opname === 'PRINT' && instruction.text) {
      // Format first line
      const firstLineBytes = instruction.bytes.slice(0, Math.min(8, instruction.bytes.length));
      const firstLineBytesText = firstLineBytes.map((b) => b.toString(16).padStart(2, '0')).join(' ');
      this.logger.info(`${addrText} ${firstLineBytesText.padEnd(23)} PRINT "${instruction.text}"`);

      // Format additional lines if needed
      for (let i = 8; i < instruction.bytes.length; i += 8) {
        const chunk = instruction.bytes
          .slice(i, i + 8)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(' ');
        if (chunk.trim().length > 0) {
          this.logger.info(`      ${chunk.padEnd(23)}`);
        }
      }
      return;
    }

    // Format operand list
    const operandText = instruction.operands.map((op) => this.formatOperand(op, instruction.opname)).join(', ');

    // Build disassembly line
    let disassembly = `${addrText} ${bytesText.padEnd(23)} ${instruction.opname}`;

    if (instruction.operands.length > 0) {
      disassembly += ` ${operandText}`;
    }

    if (instruction.storeVar !== undefined) {
      disassembly += ` -> G${instruction.storeVar}`;
    }

    if (instruction.branchInfo) {
      const { target, condition } = instruction.branchInfo;
      disassembly += ` [${condition ? 'TRUE' : 'FALSE'} -> ${target.toString(16).padStart(5, '0')}]`;
    }

    this.logger.info(disassembly);
  }

  /**
   * Safely resolve opcode name using executor's opcode tables
   */
  private safelyResolveOpcode(form: InstructionForm, opcodeNumber: number, opcodeByte: number): string {
    try {
      let opTable: Array<unknown>;

      // Select the appropriate opcode table based on form
      switch (form) {
        case InstructionForm.Long:
          // For long form, use op2 table (2-operand opcodes)
          opTable = this.executor.op2;
          break;
        case InstructionForm.Short: {
          // For short form, check op0 or op1 based on operand type bits
          const opType = (opcodeByte & 0x30) >> 4;
          if (opType === OperandType.Omitted) {
            opTable = this.executor.op0;
          } else {
            opTable = this.executor.op1;
          }
          break;
        }
        case InstructionForm.Variable: {
          // For variable form, use opV for truly variable, or appropriate table otherwise
          const reallyVariable = (opcodeByte & 0x20) !== 0;
          if (reallyVariable) {
            opTable = this.executor.opV;
          } else {
            // Try all tables - we can't easily determine operand count here
            if (this.executor.op0[opcodeNumber]?.mnemonic) {
              return this.executor.op0[opcodeNumber].mnemonic;
            }
            if (this.executor.op1[opcodeNumber]?.mnemonic) {
              return this.executor.op1[opcodeNumber].mnemonic;
            }
            opTable = this.executor.op2;
          }
          break;
        }
        case InstructionForm.Extended:
          // Extended opcodes (0xBE prefix in v5+)
          opTable = this.executor.opExt;
          break;
        default:
          // Shouldn't happen
          return `UNKNOWN_${form}_${opcodeNumber.toString(16)}`;
      }

      // Get the opcode from the appropriate table
      if (opTable && opcodeNumber < opTable.length && opTable[opcodeNumber]) {
        return (opTable[opcodeNumber] as { mnemonic: string }).mnemonic;
      }

      // Special cases for common opcodes by opcode byte
      const specialCases: Record<number, string> = {
        0xb0: 'RTRUE',
        0xb1: 'RFALSE',
        0xb2: 'PRINT',
        0x8d: 'PRINT_PADDR',
        0xba: 'QUIT',
        // Add more special cases if needed
      };

      if (specialCases[opcodeByte]) {
        return specialCases[opcodeByte];
      }

      // Fallback
      return `UNKNOWN_${form}_${opcodeNumber.toString(16)}`;
    } catch (e) {
      // If anything goes wrong, use a generic name
      return `UNKNOWN_${opcodeByte.toString(16)}`;
    }
  }

  /**
   * Format operand value for display
   */
  private formatOperand(value: number, opname: string): string {
    // For certain opcodes, format operands in specific ways
    if ((opname === 'CALL' || opname === 'CALL_VS' || opname === 'CALL_1S' || opname === 'CALL_2S') && value > 0) {
      try {
        const addr = this.memory.unpackRoutineAddress(value);
        return `0x${addr.toString(16).padStart(5, '0')}`;
      } catch (e) {
        return `0x${value.toString(16)}`;
      }
    } else if (opname === 'PRINT_PADDR') {
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

  /**
   * Find the routine containing a given address
   */
  private findContainingRoutine(addr: number): number {
    // Check if addr is already a routine
    if (this.routineAddresses.has(addr)) {
      return addr;
    }

    // Find the closest routine before the given address
    let closestRoutine = 0;
    let closestDist = Infinity;

    for (const routineAddr of this.routineAddresses) {
      if (routineAddr < addr) {
        const dist = addr - routineAddr;
        if (dist < closestDist) {
          closestDist = dist;
          closestRoutine = routineAddr;
        }
      }
    }

    return closestRoutine;
  }

  /**
   * Dumps all static strings
   */
  private dumpStrings(): void {
    // Sort string addresses
    const sortedAddresses = [...this.stringAddresses].sort((a, b) => a - b);

    let stringIndex = 1;
    for (const addr of sortedAddresses) {
      try {
        const zstring = this.memory.getZString(addr);
        const text = decodeZString(this.memory, zstring).replace(/\n/g, '^');

        const addrText = addr.toString(16).padStart(5, '0');
        this.logger.info(`${addrText} S${stringIndex.toString().padStart(4, '0')} "${text}"`);
        stringIndex++;
      } catch (error) {
        // Skip invalid strings
      }
    }
  }

  /**
   * Check if opcode stores variables
   */
  private storesVariable(opname: string): boolean {
    // Opcodes that store results to a variable
    const storeOpcodes = [
      'GET_SIBLING',
      'GET_CHILD',
      'GET_PARENT',
      'GET_PROP_LEN',
      'LOAD',
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
      'CALL',
      'CALL_VS',
      'CALL_1S',
      'CALL_2S',
      'RANDOM',
      'SCAN_TABLE',
      'LOG_SHIFT',
      'ART_SHIFT',
      'SET_FONT',
      'SAVE',
      'RESTORE',
      'SAVE_UNDO',
      'RESTORE_UNDO',
      'NOT',
    ];

    return storeOpcodes.includes(opname);
  }

  /**
   * Check if opcode has a branch
   */
  private hasBranch(opname: string): boolean {
    // Opcodes that have branch offsets
    const branchOpcodes = [
      'JZ',
      'GET_SIBLING',
      'GET_CHILD',
      'JE',
      'JL',
      'JG',
      'DEC_CHK',
      'INC_CHK',
      'JIN',
      'TEST',
      'TEST_ATTR',
      'SCAN_TABLE',
      'PICTURE_DATA',
    ];

    return branchOpcodes.includes(opname);
  }

  /**
   * Scan the high memory area for potential routine headers
   * This is an additional method to discover routines beyond those
   * that are directly called from known routines
   */
  private scanForRoutineHeaders(): void {
    // Scan high memory for potential routine headers
    // Start from high memory start and go to the end
    for (let addr = this.highMemStart; addr < this.memory.size - 2; addr++) {
      try {
        // A valid routine starts with a byte for the number of locals (0-15)
        const numLocals = this.memory.getByte(addr);

        // Basic validation checks
        if (numLocals > 15) {
          continue; // Not a valid routine header
        }

        // Skip over the locals and look for valid opcodes
        let pc = addr + 1;
        if (this.version <= 4) {
          pc += numLocals * 2; // Skip local variable initializations in v1-4
        }

        // Try to decode the first instruction as a sanity check
        try {
          const originalPC = this.zMachine.state.pc;
          this.zMachine.state.pc = pc;

          const opcodeByte = this.memory.getByte(pc);
          this.executor.decodeInstruction(opcodeByte, this.zMachine.state);

          // If we get here, it's at least plausible this is a routine header
          this.routineAddresses.add(addr);

          // Restore PC
          this.zMachine.state.pc = originalPC;
        } catch (e) {
          // Not a valid instruction, not a routine header
        }
      } catch (e) {
        // Memory access error or other issue, skip
      }
    }
  } /**
   * Find the main routine address based on initial PC
   * In Z-machine, the initial PC often points to an instruction inside
   * the main routine, not necessarily its start.
   */
  private findMainRoutineAddress(initialPC: number): number {
    // In general, search backward from the initial PC to find a valid routine header
    const maxSearchDistance = 20; // Limit how far back we search
    for (let addr = initialPC - 1; addr >= initialPC - maxSearchDistance && addr >= this.highMemStart; addr--) {
      // Check if this could be a valid routine header
      // In Z-machine, a routine starts with a byte indicating the number of locals (0-15)
      const potentialLocalCount = this.memory.getByte(addr);
      if (potentialLocalCount <= 15) {
        // This could be a valid routine header
        // To be more certain, we can check if decoding instructions from here works
        try {
          // Try storing PC and reset when done
          const originalPC = this.zMachine.state.pc;
          this.zMachine.state.pc = addr + 1;

          if (this.version <= 4) {
            // Skip local variable initializations
            this.zMachine.state.pc += potentialLocalCount * 2;
          }

          // If we end up at initialPC, this is likely the main routine
          if (this.zMachine.state.pc === initialPC) {
            this.zMachine.state.pc = originalPC;
            return addr;
          }

          // Restore PC
          this.zMachine.state.pc = originalPC;
        } catch (e) {
          // Not a valid routine header, continue searching
        }
      }
    }

    // If we couldn't find the routine start, just return initialPC - 1 as a best guess
    // (routine header is usually 1 byte before code)
    return initialPC - 1;
  }
}

/**
 * Main entry point for the Z-code disassembler example
 */
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
    const disassembler = new ZCodeDisassembler(storyData, logger);
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
