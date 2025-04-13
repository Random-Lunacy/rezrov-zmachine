// src/core/execution/Executor.ts
import { ZMachine } from '../../interpreter/ZMachine';
import { Address, InstructionForm, OperandType } from '../../types';
import { hex } from '../../utils/debug';
import { Logger } from '../../utils/log';
import { Opcode } from '../opcodes/base';
import * as opcodes from '../opcodes/index';
import { InputState } from './InputState';
import { SuspendState } from './SuspendState';

export class Executor {
  constructor(private zMachine: ZMachine, private logger: Logger) {
    // Initialize opcode tables
    this.op0 = opcodes.op0;
    this.op1 = opcodes.op1;
    this.op2 = opcodes.op2;
    this.opv = opcodes.opv;
    this.opext = opcodes.opext;
  }

  private _quit: boolean = false;
  private _op_pc: Address = 0;
  private _suspended: boolean = false;
  private _suspendedInputState: InputState | null = null;

  // Opcode tables
  private op0: Array<Opcode>;
  private op1: Array<Opcode>;
  private op2: Array<Opcode>;
  private opv: Array<Opcode>;
  private opext: Array<Opcode>;

  /**
   * Main execution loop that runs until program termination or suspension
   */
  executeLoop(): void {
    try {
      while (!this._quit && !this._suspended) {
        // Save the current PC for debugging and error reporting
        this._op_pc = this.zMachine.state.pc;
        this.executeInstruction();
      }

      if (this._quit) {
        this.logger.info('Program execution terminated');
        this.zMachine.screen.quit();
      }
    } catch (e) {
      if (e instanceof SuspendState) {
        // Handle suspension for user input
        this._suspended = true;
        this._suspendedInputState = e.state;

        // Use setImmediate to unwind the call stack before handling input
        setImmediate(() => {
          try {
            this.logger.debug(`Suspended for ${e.state.keyPress ? 'key' : 'text'} input`);

            // Have the screen handle the input request
            if (e.state.keyPress) {
              this.zMachine.screen.getKeyFromUser(this.zMachine, e.state);
            } else {
              this.zMachine.screen.getInputFromUser(this.zMachine, e.state);
            }

            // Handle timed input if needed
            if (e.state.time && e.state.time > 0 && e.state.routine) {
              this.zMachine.handleTimedInput(e.state.time, e.state.routine);
            }
          } catch (inputError) {
            this.logger.error(`Error during input handling: ${inputError}`);
          }
        });
      } else {
        // Handle other errors
        this.logger.error(`Execution error at PC=${hex(this._op_pc)}: ${e}`);
        if (e instanceof Error && e.stack) {
          this.logger.debug(e.stack);
        }
        throw e;
      }
    }
  }

  /**
   * Executes a single Z-machine instruction at the current PC
   */
  executeInstruction(): void {
    const state = this.zMachine.state;
    const op_pc = state.pc;
    const opcode = state.readByte();

    let operandTypes: Array<OperandType> = [];
    let reallyVariable = false;
    let form: InstructionForm;
    let opcodeNumber: number;

    this.logger.debug(`${hex(op_pc)}: opbyte = ${hex(opcode)}`);

    // 1. Decode instruction form and operand types
    if ((opcode & 0xc0) === 0xc0) {
      // Variable form
      form = InstructionForm.Variable;
      reallyVariable = (opcode & 0x20) !== 0;

      // Read operand types byte
      const typesByte = state.readByte();
      for (let i = 0; i < 4; i++) {
        const optype = (typesByte >> ((3 - i) * 2)) & 0x03;
        if (optype !== OperandType.Omitted) {
          operandTypes.push(optype);
        } else {
          break;
        }
      }

      opcodeNumber = opcode & 0x1f;
    } else if ((opcode & 0x80) === 0x80) {
      // Short form
      form = InstructionForm.Short;

      const optype = (opcode & 0x30) >> 4;
      if (optype !== OperandType.Omitted) {
        operandTypes = [optype];
      }

      opcodeNumber = opcode & 0x0f;
    } else if (opcode === 190 && state.version >= 5) {
      // Extended form (only in Version 5+)
      form = InstructionForm.Extended;
      opcodeNumber = state.readByte();

      // Read operand types byte
      const typesByte = state.readByte();
      for (let i = 0; i < 4; i++) {
        const optype = (typesByte >> ((3 - i) * 2)) & 0x03;
        if (optype !== OperandType.Omitted) {
          operandTypes.push(optype);
        } else {
          break;
        }
      }
    } else {
      // Long form
      form = InstructionForm.Long;

      operandTypes.push((opcode & 0x40) === 0x40 ? OperandType.Variable : OperandType.Small);
      operandTypes.push((opcode & 0x20) === 0x20 ? OperandType.Variable : OperandType.Small);

      opcodeNumber = opcode & 0x1f;
    }

    // 2. Read operands according to their types
    const operands: Array<number> = [];
    for (const optype of operandTypes) {
      switch (optype) {
        case OperandType.Large:
          operands.push(state.readWord());
          break;
        case OperandType.Small:
          operands.push(state.readByte());
          break;
        case OperandType.Variable: {
          const varnum = state.readByte();
          operands.push(state.loadVariable(varnum));
          break;
        }
        default:
          throw new Error(`Unknown operand type: ${optype}`);
      }
    }

    // 3. Find the correct opcode implementation
    let op: Opcode;

    try {
      if (form === InstructionForm.Extended) {
        op = this.opext[opcodeNumber];
      } else if (reallyVariable) {
        op = this.opv[opcodeNumber];
      } else {
        switch (operands.length) {
          case 0:
            op = this.op0[opcodeNumber];
            break;
          case 1:
            op = this.op1[opcodeNumber];
            break;
          case 2:
            op = this.op2[opcodeNumber];
            break;
          default:
            throw new Error(`Unhandled number of operands: ${operands.length}`);
        }
      }

      if (!op) {
        throw new Error(
          `No implementation found for opcode ${hex(opcodeNumber)} with ${operands.length} operands (form: ${form})`
        );
      }
    } catch (e) {
      this.logger.error(
        `Error resolving opcode at pc=${hex(op_pc)}, opcode=${hex(opcode)}, form=${form}, operands=${
          operands.length
        }: ${e instanceof Error ? e.message : String(e)}`
      );
      throw e;
    }

    this.logger.debug(`Executing op = ${op.mnemonic} with operands [${operands.map(o => hex(o)).join(', ')}]`);

    // 4. Execute the opcode
    op.impl(this.zMachine, ...operands);
  }

  /**
   * Gets the PC value at the start of the current instruction
   */
  get op_pc(): Address {
    return this._op_pc;
  }

  /**
   * Gets the current input state when execution is suspended
   */
  get suspendedInputState(): InputState | null {
    if (!this._suspended) {
      return null;
    }
    return this._suspendedInputState;
  }

  /**
   * Checks if execution is currently suspended
   */
  get isSuspended(): boolean {
    return this._suspended;
  }

  /**
   * Resumes execution after handling user input
   */
  resume(): void {
    this._suspended = false;
    this._suspendedInputState = null;
    this.executeLoop();
  }

  /**
   * Terminates program execution
   */
  quit(): void {
    this._quit = true;
  }
}
