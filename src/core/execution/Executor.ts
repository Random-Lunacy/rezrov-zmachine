import { Memory } from "../memory/Memory";
import { GameState } from "../../interpreter/GameState";
import { Logger } from "../../utils/log";
import { SuspendState } from "./SuspendState";

export class Executor {
  private memory: Memory;
  private state: GameState;
  private logger: Logger;
  private _quit: boolean = false;

  constructor(memory: Memory, state: GameState, logger: Logger) {
    this.memory = memory;
    this.state = state;
    this.logger = logger;
  }

  executeLoop() {
    try {
      while (!this._quit) {
        this._op_pc = this._pc;
        this.executeInstruction();
      }
      this._screen.quit();
    } catch (e) {
      if (e instanceof SuspendForUserInput) {
        // unwind before calling the screen input function
        setImmediate(() => {
          try {
            if (e.state.keyPress) {
              this._screen.getKeyFromUser(this, e.state);
            } else {
              this._screen.getInputFromUser(this, e.state);
            }
          } catch (e) {
            console.error(e);
          }
        });
      } else {
        console.error(e);
      }
    }
  }

  executeInstruction() {
    // If the top two bits of the opcode are $$11 the form is
    // variable; if $$10, the form is short. If the opcode is 190 ($BE
    // in hexadecimal) and the version is 5 or later, the form is
    // "extended". Otherwise, the form is "long".

    const op_pc = this.pc;
    let opcode = this.readByte();

    let operandTypes: Array<number /* OperandType */> = [];
    let reallyVariable = false;
    let form: InstructionForm;

    this._log.debug(`${op_pc.toString(16)}: opbyte = ${opcode}`);
    // console.error(`[DEBUG] ${op_pc.toString(16)}: opbyte = ${opcode}`);

    if ((opcode & 0xc0) === 0xc0) {
      form = InstructionForm.Variable;

      if ((opcode & 0x20) !== 0) {
        reallyVariable = true;
      } else {
        // not really variable - 2 args
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
    } else if (opcode === 190 && this._version >= 5) {
      throw new Error("extended opcodes not implemented");
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
          operands.push(this.loadVariable(varnum));
          break;
        default:
          throw new Error("XXX");
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
            throw new Error("unhandled number of operands");
        }
      }
    } catch (e) {
      console.error(e);
      this._log.error(
        `error at pc=${hex(op_pc)}, opcode=${hex(opcode)}: ${e.toString()}`
      );
      throw e;
    }
    this._log.debug(`op = ${op.mnemonic}`);
    op.impl(this, ...operands);
  }

  // Additional execution methods will go here

  quit(): void {
    this._quit = true;
  }
}
