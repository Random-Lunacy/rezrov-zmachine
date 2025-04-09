// src/core/execution/Executor.ts
import { Memory } from "../memory/Memory";
import { GameState } from "../../interpreter/GameState";
import { Logger } from "../../utils/log";
import { SuspendState } from "./SuspendState";
import { Opcode, opcodes } from "../opcodes";
import { HeaderLocation } from "../../utils/constants";
import { Address } from "../../types";
import { Screen } from "../../ui/screen/interfaces";
import { StackFrame, createStackFrame } from "./StackFrame";

// These would come from opcodes/index.ts
const { op0, op1, op2, op3, op4, opv } = opcodes;

enum OperandType {
  Large = 0,   // Large constant (0 to 65535) - 2 bytes
  Small = 1,   // Small constant (0 to 255) - 1 byte
  Variable = 2, // Variable - 1 byte
  Omitted = 3  // Omitted altogether - 0 bytes
}

enum InstructionForm {
  Long = 0,
  Short = 1,
  Variable = 2,
  Extended = 3
}

export class Executor {
  private memory: Memory;
  private state: GameState;
  private logger: Logger;
  private _quit: boolean = false;
  private _op_pc: Address = 0;

  // Track suspended state
  private _suspended: boolean = false;
  public suspendedInputState: InputState | null = null;

  constructor(memory: Memory, state: GameState, logger: Logger) {
    this.memory = memory;
    this.state = state;
    this.logger = logger;
  }

  /**
   * Main execution loop for the Z-machine
   */
  executeLoop(): void {
    // Reset suspension state
    this._suspended = false;
    this.suspendedInputState = null;

    try {
      // Keep executing instructions until we quit or suspend
      while (!this._quit && !this._suspended) {
        this._op_pc = this.state.pc;
        this.executeInstruction();
      }

      // If we've quit, notify the UI
      if (this._quit) {
        this.logger.info("Program execution terminated");
      }
    } catch (e) {
      if (e instanceof SuspendState) {
        // Handle suspension for user input
        this._suspended = true;
        this.suspendedInputState = e.state;

        // Unwind the stack before handling input
        setImmediate(() => {
          try {
            if (e.state.keyPress) {
              this.logger.debug("Suspended for key input");
              // Input handling will be delegated to the Screen implementation
            } else {
              this.logger.debug("Suspended for text input");
              // Input handling will be delegated to the Screen implementation
            }
          } catch (inputError) {
            this.logger.error(`Error during input handling: ${inputError}`);
          }
        });
      } else {
        // Handle other errors
        this.logger.error(`Execution error: ${e}`);
        throw e; // Re-throw to allow higher-level error handling
      }
    }
  }

  /**
   * Quit the Z-machine interpreter
   */
  quit(): void {
    this._quit = true;
  }

  executeInstruction() {
    // If the top two bits of the opcode are $$11 the form is
    // variable; if $$10, the form is short. If the opcode is 190 ($BE
    // in hexadecimal) and the version is 5 or later, the form is
    // "extended". Otherwise, the form is "long".

    const op_pc = this.state.pc;
    let opcode = this.readByte();

    let operandTypes: Array<number /* OperandType */> = [];
    let reallyVariable = false;
    let form: InstructionForm;

    this.logger.debug(`${op_pc.toString(16)}: opbyte = ${opcode}`);

    if ((opcode & 0xc0) === 0xc0) {
      form = InstructionForm.Variable;

      if ((opcode & 0x20) !== 0) {
        reallyVariable = true;
      }

      if (form === InstructionForm.Variable) {
        const bits = this.readByte();
        for (let i = 0; i < 4; i++) {
          const optype = (bits >> ((3 - i) * 2)) & 0x03;
          if (optype !== OperandType.Omitted) {
            operandTypes.push(optype);
          } else {
            break;
          }
        }
      }

      opcode = opcode & 0x1f;
    } else if ((opcode & 0x80) === 0x80) {
      form = InstructionForm.Short;

      const optype = (opcode & 0x30) >> 4;
      if (optype !== OperandType.Omitted) {
        operandTypes = [optype];
      }

      opcode = opcode & 0x0f;
    } else if (opcode === 190 && this.state.version >= 5) {
      throw new Error("Extended opcodes not implemented");
    } else {
      form = InstructionForm.Long;

      operandTypes.push(
        (opcode & 0x40) === 0x40 ? OperandType.Variable : OperandType.Small
      );
      operandTypes.push(
        (opcode & 0x20) === 0x20 ? OperandType.Variable : OperandType.Small
      );

      opcode = opcode & 0x1f;
    }

    const operands: Array<number> = [];
    for (const optype of operandTypes) {
      switch (optype) {
        case OperandType.Large:
          operands.push(this.readWord());
          break;
        case OperandType.Small:
          operands.push(this.readByte());
          break;
        case OperandType.Variable:
          const varnum = this.readByte();
          operands.push(this.state.loadVariable(varnum));
          break;
        default:
          throw new Error("Unknown operand type");
      }
    }

    let op: Opcode;
    try {
      if (reallyVariable) {
        op = opv[opcode];
      } else {
        switch (operands.length) {
          case 0:
            op = op0[opcode];
            break;
          case 1:
            op = op1[opcode];
            break;
          case 2:
            op = op2[opcode];
            break;
          case 3:
            op = op3[opcode];
            break;
          case 4:
            op = op4[opcode];
            break;
          default:
            throw new Error(`Unhandled number of operands: ${operands.length}`);
        }
      }
    } catch (e) {
      this.logger.error(
        `Error at pc=${this.hexString(op_pc)}, opcode=${this.hexString(opcode)}: ${e.toString()}`
      );
      throw e;
    }

    this.logger.debug(`op = ${op.mnemonic}`);
    op.impl(this.state, ...operands);
  }

  readByte(): number {
    const rv = this.memory.getByte(this.state.pc);
    this.state.pc++;
    return rv;
  }

  readWord(): number {
    const rv = this.memory.getWord(this.state.pc);
    this.state.pc += 2;
    return rv;
  }

  readBranchOffset(): [number, boolean] {
    const branchData = this.readByte();
    let off1 = branchData & 0x3f;
    let offset: number;

    if ((branchData & 0x40) === 0x40) {
      // 1 byte offset
      offset = off1;
    } else {
      // 2 byte offset
      // propagate sign bit
      if ((off1 & 0x20) !== 0) {
        off1 |= 0xc0;
      }

      offset = (off1 << 8) | this.readByte();
    }

    // First bit of branchData indicates condition sense (0=branch on true, 1=branch on false)
    return [offset, (branchData & 0x80) === 0x00];
  }

  doBranch(cond: boolean, condfalse: boolean, offset: number) {
    this.logger.debug(`     Branch condition: ${cond}, invert: ${!condfalse}, offset: ${offset}`);

    if ((cond && !condfalse) || (!cond && condfalse)) {
      if (offset === 0) {
        this.logger.debug("     Returning false");
        this.state.returnFromRoutine(0);
      } else if (offset === 1) {
        this.logger.debug("     Returning true");
        this.state.returnFromRoutine(1);
      } else {
        this.state.pc = this.state.pc + offset - 2;
        if (this.state.pc < 0 || this.state.pc > this.memory.size) {
          throw new Error(`Branch out of bounds: ${this.state.pc}`);
        }
        this.logger.debug(`     Taking branch to ${this.state.pc}!`);
      }
    }
  }

  hexString(value: number): string {
    return value !== undefined ? value.toString(16) : "";
  }

  quit(): void {
    this._quit = true;
  }
}
