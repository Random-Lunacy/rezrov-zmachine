// src/core/execution/Executor.ts
import { ZMachine } from '../../interpreter/ZMachine';
import { Address, InstructionForm, OperandType } from '../../types';
import { hex } from '../../utils/debug';
import { Logger } from '../../utils/log';
import { Opcode } from '../opcodes/base';
import * as opcodes from '../opcodes/index';
import { InputState } from './InputState';
import { SuspendState } from './SuspendState';

/**
 * Handles execution of Z-machine instructions
 */
export class Executor {
  constructor(zMachine: ZMachine, logger: Logger) {
    this.zMachine = zMachine;
    this.logger = logger;

    // Store opcode tables
    this.op0 = opcodes.op0;
    this.op1 = opcodes.op1;
    this.op2 = opcodes.op2;
    this.opv = opcodes.opv;
    this.opext = opcodes.opext;
  }

  private zMachine: ZMachine;
  private logger: Logger;
  private _quit: boolean = false;
  private _op_pc: Address = 0;

  // Track suspended state
  private _suspended: boolean = false;
  private _suspendedInputState: InputState | null = null;

  // Opcode tables - these would be imported from the opcodes modules
  private op0: Array<Opcode>;
  private op1: Array<Opcode>;
  private op2: Array<Opcode>;
  private opv: Array<Opcode>;
  private opext: Array<Opcode>;

  /**
   * Main execution loop for the Z-machine
   */
  executeLoop(): void {
    try {
      while (!this._quit && !this._suspended) {
        this._op_pc = this.zMachine.state.pc;
        this.executeInstruction();
      }

      if (this._quit) {
        this.logger.info('Program execution terminated');
      }
    } catch (e) {
      if (e instanceof SuspendState) {
        // Handle suspension for user input
        this._suspended = true;
        this._suspendedInputState = e.state;

        // Unwind the stack before handling input
        setImmediate(() => {
          try {
            this.logger.debug(`Suspended for ${e.state.keyPress ? 'key' : 'text'} input`);
            // Input handling will be delegated to the calling code
          } catch (inputError) {
            this.logger.error(`Error during input handling: ${inputError}`);
          }
        });
      } else {
        // Handle other errors
        this.logger.error(`Execution error at PC=${hex(this._op_pc)}: ${e}`);
        throw e;
      }
    }
  }

  /**
   * Execute a single Z-machine instruction
   */
  executeInstruction(): void {
    // Store the current PC for debugging/error reporting
    const op_pc = this.zMachine.state.pc;
    let opcode = this.zMachine.state.readByte();

    let operandTypes: Array<OperandType> = [];
    let reallyVariable = false;
    let form: InstructionForm | InstructionForm.Extended;

    this.logger.debug(`${hex(op_pc)}: opbyte = ${hex(opcode)}`);

    // Determine instruction form and operand types based on opcode
    if ((opcode & 0xc0) === 0xc0) {
      // Variable form (top two bits are 11)
      form = InstructionForm.Variable;

      if ((opcode & 0x20) !== 0) {
        // VAR form: operands given by 4-bit type specifier
        reallyVariable = true;
      } else {
        // 2OP form with variable operands
      }

      // Read operand types for variable form
      const typesByte = this.zMachine.state.readByte();
      for (let i = 0; i < 4; i++) {
        const optype = (typesByte >> ((3 - i) * 2)) & 0x03;
        if (optype !== OperandType.Omitted) {
          operandTypes.push(optype);
        } else {
          break;
        }
      }

      // Mask to get the actual opcode
      opcode = opcode & 0x1f;
    } else if ((opcode & 0x80) === 0x80) {
      // Short form (top bit is 1, second bit is 0)
      form = InstructionForm.Short;

      // Get operand type from bits 4-5
      const optype = (opcode & 0x30) >> 4;
      if (optype !== OperandType.Omitted) {
        operandTypes = [optype];
      }

      // Mask to get the actual opcode
      opcode = opcode & 0x0f;
    } else if (opcode === 190 && this.zMachine.state.version >= 5) {
      // Extended form (opcode 190/$BE) in version 5+
      form = InstructionForm.Extended;

      // Read extended opcode
      opcode = this.zMachine.state.readByte();

      // Read operand types (similar to variable form)
      const typesByte = this.zMachine.state.readByte();
      for (let i = 0; i < 4; i++) {
        const optype = (typesByte >> ((3 - i) * 2)) & 0x03;
        if (optype !== OperandType.Omitted) {
          operandTypes.push(optype);
        } else {
          break;
        }
      }

      // For now, throw an error as extended opcodes aren't implemented
      throw new Error(`Extended opcode ${hex(opcode)} not implemented`);
    } else {
      // Long form (top two bits are not 11, and not extended)
      form = InstructionForm.Long;

      // Determine operand types from bits 5-6
      operandTypes.push((opcode & 0x40) === 0x40 ? OperandType.Variable : OperandType.Small);
      operandTypes.push((opcode & 0x20) === 0x20 ? OperandType.Variable : OperandType.Small);

      // Mask to get the actual opcode
      opcode = opcode & 0x1f;
    }

    // Read operands based on their types
    const operands: Array<number> = [];
    for (const optype of operandTypes) {
      switch (optype) {
        case OperandType.Large:
          operands.push(this.zMachine.state.readWord());
          break;
        case OperandType.Small:
          operands.push(this.zMachine.state.readByte());
          break;
        case OperandType.Variable: {
          const varnum = this.zMachine.state.readByte();
          operands.push(this.zMachine.state.loadVariable(varnum));
          break;
        }
        default:
          throw new Error(`Unknown operand type: ${optype}`);
      }
    }

    // Find the appropriate opcode handler
    let op: Opcode;

    try {
      if (reallyVariable) {
        op = this.opv[opcode];
      } else {
        switch (operands.length) {
          case 0:
            op = this.op0[opcode];
            break;
          case 1:
            op = this.op1[opcode];
            break;
          case 2:
            op = this.op2[opcode];
            break;
          case 3:
            op = this.opext[opcode];
            break;
          default:
            throw new Error(`Unhandled number of operands: ${operands.length}`);
        }
      }

      if (!op) {
        throw new Error(`No implementation found for opcode ${hex(opcode)} with ${operands.length} operands`);
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

    // Call the opcode implementation
    op.impl(this.zMachine, ...operands);
  }

  /**
   * Gets the current operation PC (for debugging)
   */
  get op_pc(): Address {
    return this._op_pc;
  }

  /**
   * Gets the suspended input state if execution is suspended
   */
  get suspendedInputState(): InputState | null {
    if (!this._suspended) {
      return null;
    }
    return this._suspendedInputState;
  }

  /**
   * Check if execution is currently suspended
   */
  get isSuspended(): boolean {
    return this._suspended;
  }

  /**
   * Resume execution after suspension
   */
  resume(): void {
    this._suspended = false;
    this._suspendedInputState = null;
    this.executeLoop();
  }

  /**
   * Quit the Z-machine
   */
  quit(): void {
    this._quit = true;
  }
}
