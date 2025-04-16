import { ZMachine } from '../../interpreter/ZMachine';
import { Address, InstructionForm, OperandType } from '../../types';
import { hex } from '../../utils/debug';
import { Logger } from '../../utils/log';
import { Opcode } from '../opcodes/base';
import * as opcodes from '../opcodes/index';
import { InputState } from './InputState';
import { SuspendState } from './SuspendState';

/**
 * The main execution engine for the Z-machine
 */
export class Executor {
  private _quit: boolean = false;
  private _op_pc: Address = 0;
  private _suspended: boolean = false;
  private _suspendedInputState: InputState | null = null;
  private readonly logger: Logger;

  // Opcode tables
  private readonly op0: Array<Opcode>;
  private readonly op1: Array<Opcode>;
  private readonly op2: Array<Opcode>;
  private readonly opV: Array<Opcode>;
  private readonly opExt: Array<Opcode>;

  /**
   * Constructor for the Executor class
   * @param zMachine The Z-machine instance
   * @param options Optional configuration options
   */
  constructor(
    private readonly zMachine: ZMachine,
    options?: {
      logger?: Logger;
    }
  ) {
    this.logger = options?.logger || new Logger('Executor');

    // Initialize opcode tables
    this.op0 = opcodes.op0;
    this.op1 = opcodes.op1;
    this.op2 = opcodes.op2;
    this.opV = opcodes.opV;
    this.opExt = opcodes.opExt;
  }

  /**
   * Main execution loop that runs until program termination or suspension
   */
  executeLoop(): void {
    try {
      while (!this._quit && !this._suspended) {
        this._op_pc = this.zMachine.state.pc;
        this.executeInstruction();
      }

      if (this._quit) {
        this.logger.info('Program execution terminated');
        this.zMachine.screen.quit();
      }
    } catch (e) {
      if (e instanceof SuspendState) {
        // Set suspended state
        this._suspended = true;
        this._suspendedInputState = e.state;

        // Unwind the call stack before handling input
        setImmediate(() => {
          try {
            const state = e.state;

            // Update status bar before input if needed (for V1-3)
            if (this.zMachine.state.version <= 3) {
              this.zMachine.state.updateStatusBar();
            }

            this.logger.debug(`Suspended for ${state.keyPress ? 'key' : 'text'} input`);

            // Register timed input handler if needed
            if (state.time && state.time > 0 && state.routine) {
              this.logger.debug(`Setting up timed input: time=${state.time}, routine=${state.routine}`);
              this.zMachine.handleTimedInput(state.time, state.routine);
            }

            // Request input from the screen implementation
            if (state.keyPress) {
              this.zMachine.screen.getKeyFromUser(this.zMachine, state);
            } else {
              this.zMachine.screen.getInputFromUser(this.zMachine, state);
            }
          } catch (inputError) {
            this.logger.error(`Error during input handling: ${inputError}`);
            // Attempt to resume execution even if input handling fails
            this.resume();
          }
        });
      } else {
        // Handle any other errors
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

    this.logger.debug(`${hex(op_pc)}: opcode byte = ${hex(opcode)}`);

    const { form, reallyVariable, opcodeNumber, operandTypes } = this.decodeInstruction(opcode, state);

    const operands = this.readOperands(operandTypes, state);

    const op = this.resolveOpcode(form, reallyVariable, opcodeNumber, operands.length, op_pc, opcode);

    this.logger.debug(`Executing op = ${op.mnemonic} with operands [${operands.map((o) => hex(o)).join(', ')}]`);

    op.impl(this.zMachine, ...operands);
  }

  /**
   * Decodes the instruction based on the opcode and current state
   * @param opcode The opcode byte
   * @param state The current state of the Z-machine
   * @returns An object containing the instruction form, operand types, and opcode number
   */
  private decodeInstruction(
    opcode: number,
    state: ZMachine['state']
  ): {
    form: InstructionForm;
    reallyVariable: boolean;
    opcodeNumber: number;
    operandTypes: Array<OperandType>;
  } {
    let operandTypes: Array<OperandType> = [];
    let reallyVariable = false;
    let form: InstructionForm;
    let opcodeNumber: number;

    if ((opcode & 0xc0) === 0xc0) {
      form = InstructionForm.Variable;
      reallyVariable = (opcode & 0x20) !== 0;
      const typesByte = state.readByte();
      operandTypes = this.decodeOperandTypes(typesByte);
      opcodeNumber = opcode & 0x1f;
    } else if ((opcode & 0x80) === 0x80) {
      form = InstructionForm.Short;
      const opType = (opcode & 0x30) >> 4;
      if (opType !== OperandType.Omitted) {
        operandTypes = [opType];
      }
      opcodeNumber = opcode & 0x0f;
    } else if (opcode === 190 && state.version >= 5) {
      form = InstructionForm.Extended;
      opcodeNumber = state.readByte();
      const typesByte = state.readByte();
      operandTypes = this.decodeOperandTypes(typesByte);
    } else {
      form = InstructionForm.Long;
      operandTypes.push((opcode & 0x40) === 0x40 ? OperandType.Variable : OperandType.Small);
      operandTypes.push((opcode & 0x20) === 0x20 ? OperandType.Variable : OperandType.Small);
      opcodeNumber = opcode & 0x1f;
    }

    return { form, reallyVariable, opcodeNumber, operandTypes };
  }

  /**
   * Decodes the operand types from the types byte
   * @param typesByte The byte representing operand types
   * @returns An array of operand types
   */
  private decodeOperandTypes(typesByte: number): Array<OperandType> {
    const operandTypes: Array<OperandType> = [];
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

  /**
   * Reads the operands based on their types
   * @param operandTypes The array of operand types
   * @param state The current state of the Z-machine
   * @returns An array of operand values
   */
  private readOperands(operandTypes: Array<OperandType>, state: ZMachine['state']): Array<number> {
    const operands: Array<number> = [];
    for (const opType of operandTypes) {
      switch (opType) {
        case OperandType.Large:
          operands.push(state.readWord());
          break;
        case OperandType.Small:
          operands.push(state.readByte());
          break;
        case OperandType.Variable: {
          const varNum = state.readByte();
          operands.push(state.loadVariable(varNum));
          break;
        }
        default:
          throw new Error(`Unknown operand type: ${opType}`);
      }
    }
    return operands;
  }

  /**
   * Resolves the opcode implementation based on the instruction form and operand count
   * @param form The instruction form
   * @param reallyVariable Whether the opcode is variable
   * @param opcodeNumber The opcode number
   * @param operandCount The number of operands
   * @param op_pc The program counter at the start of the instruction
   * @param opcode The opcode byte
   * @returns The resolved opcode implementation
   */
  private resolveOpcode(
    form: InstructionForm,
    reallyVariable: boolean,
    opcodeNumber: number,
    operandCount: number,
    op_pc: Address,
    opcode: number
  ): Opcode {
    let op: Opcode;

    try {
      if (form === InstructionForm.Extended) {
        op = this.opExt[opcodeNumber];
      } else if (reallyVariable) {
        op = this.opV[opcodeNumber];
      } else {
        switch (operandCount) {
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
            throw new Error(`Unhandled number of operands: ${operandCount}`);
        }
      }

      if (!op) {
        throw new Error(
          `No implementation found for opcode ${hex(opcodeNumber)} with ${operandCount} operands (form: ${form})`
        );
      }
    } catch (e) {
      this.logger.error(
        `Error resolving opcode at pc=${hex(op_pc)}, opcode=${hex(opcode)}, form=${form}, operands=${operandCount}: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
      throw e;
    }

    return op;
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
    if (!this._suspended) {
      this.logger.warn('Called resume() when not suspended');
      return;
    }

    this._suspended = false;
    this._suspendedInputState = null;

    // Continue execution
    this.executeLoop();
  }

  /**
   * Terminates program execution
   */
  quit(): void {
    this._quit = true;
  }
}
