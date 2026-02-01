import { ZMachine } from '../../interpreter/ZMachine';
import { Address, InstructionForm, OperandType } from '../../types';
import { InputMode, InputState } from '../../ui/input/InputInterface';
import { hex } from '../../utils/debug';
import { Logger } from '../../utils/log';
import { Opcode } from '../opcodes/base';
import * as opcodes from '../opcodes/index';
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
  private readonly _op0: Array<Opcode>;
  private readonly _op1: Array<Opcode>;
  private readonly _op2: Array<Opcode>;
  private readonly _opV: Array<Opcode>;
  private readonly _opExt: Array<Opcode>;

  /**
   * Constructor for the Executor class
   * @param zMachine The Z-machine instance
   * @param options Optional configuration options
   */
  constructor(
    private readonly zMachine: ZMachine,
    options?: { logger?: Logger }
  ) {
    this.logger = options?.logger || new Logger('Executor');

    // Initialize opcode tables
    this._op0 = opcodes.op0;
    this._op1 = opcodes.op1;
    this._op2 = opcodes.op2;
    this._opV = opcodes.opV;
    this._opExt = opcodes.opExt;
  }

  public get op0(): Array<Opcode> {
    return this._op0;
  }
  public get op1(): Array<Opcode> {
    return this._op1;
  }
  public get op2(): Array<Opcode> {
    return this._op2;
  }
  public get opV(): Array<Opcode> {
    return this._opV;
  }
  public get opExt(): Array<Opcode> {
    return this._opExt;
  }

  /**
   * Main execution loop that runs until program termination or suspension
   */
  async executeLoop(): Promise<void> {
    try {
      while (!this._quit && !this._suspended) {
        this.logger.debug(`Loop iteration: quit=${this._quit}, suspended=${this._suspended}`);
        this._op_pc = this.zMachine.state.pc;
        await this.executeInstruction();
      }
      if (this._suspended) {
        this.logger.debug('ExecuteLoop exited due to suspension');
      }
      if (this._quit) {
        this.logger.info('Program execution terminated');
        this.zMachine.screen.quit();
      }
    } catch (e) {
      if (e instanceof SuspendState) {
        this.logger.debug('Caught SuspendState, setting up suspension...');
        this._suspended = true;
        // Create InputState once and reuse it - this ensures getInputState() returns
        // the same object that the input processor is using
        this._suspendedInputState = e.toInputState();

        this.logger.debug(`Suspended state: ${JSON.stringify(this._suspended)}`);

        setImmediate(() => {
          this.logger.debug('Starting input setup in setImmediate...');
          try {
            // Use the same InputState object stored in _suspendedInputState
            const inputState = this._suspendedInputState!;
            this.logger.debug(`Input state: ${JSON.stringify(inputState)}`);

            // Update status bar for V1-3
            if (this.zMachine.state.version <= 3) {
              this.zMachine.updateStatusBar();
            }

            // Start input based on mode
            if (inputState.mode === InputMode.CHAR || inputState.mode === InputMode.TIMED_CHAR) {
              this.logger.debug('Starting character input...');
              this.zMachine.inputProcessor.startCharInput(this.zMachine, inputState);
            } else {
              this.logger.debug('Starting text input...');
              this.zMachine.inputProcessor.startTextInput(this.zMachine, inputState);
            }
            this.logger.debug('Input setup completed successfully');
          } catch (inputError: unknown) {
            const errorMessage = inputError instanceof Error ? inputError.message : String(inputError);
            const errorStack = inputError instanceof Error ? inputError.stack : 'No stack trace available';

            this.logger.error(`Error during input handling: ${errorMessage}`);
            this.logger.error(`Input error stack: ${errorStack}`);
            // Resume execution to avoid deadlock
            this.resume().catch((resumeError) => {
              this.logger.error(`Error during emergency resume: ${resumeError}`);
              // At this point, we're in a bad state - quit
              this._quit = true;
            });
          }
        });
      } else {
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
  async executeInstruction(): Promise<void> {
    const state = this.zMachine.state;
    const op_pc = state.pc;
    const opcode = state.readByte();

    const { form, reallyVariable, opcodeNumber, operandTypes } = this.decodeInstruction(opcode, state);
    const operands = this.readOperands(operandTypes, state);
    const op = this.resolveOpcode(form, reallyVariable, opcodeNumber, operands.length, op_pc, opcode);

    this.logger.debug(
      `Executing op = ${op.mnemonic} at PC ${hex(op_pc)} with operandTypes [${operandTypes}] and operands [${operands.map((o) => hex(o)).join(', ')}]`
    );

    try {
      const result = op.impl(this.zMachine, operandTypes, ...operands);
      if (result instanceof Promise) {
        await result;
      }
    } catch (e) {
      if (e instanceof SuspendState) {
        // Don't log SuspendState as an error - it's normal flow
        this.logger.debug(`Execution suspended for input: ${e.message}`);
        throw e;
      }
      this.logger.error(`Error executing opcode ${op.mnemonic}: ${e}`);
      throw e;
    }
  }

  /**
   * Decodes the instruction based on the opcode and current state
   * @param opcode The opcode byte
   * @param state The current state of the Z-machine
   * @returns An object containing the instruction form, operand types, and opcode number
   */
  public decodeInstruction(
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

    if (opcode === 0xbe && state.version >= 5) {
      // Check for Extended opcode first
      form = InstructionForm.Extended;
      opcodeNumber = state.readByte();
      const typesByte = state.readByte();
      operandTypes = this.decodeOperandTypes(typesByte);
    } else if ((opcode & 0xc0) === 0xc0) {
      // Then Variable form
      form = InstructionForm.Variable;
      reallyVariable = (opcode & 0x20) !== 0;
      const typesByte1 = state.readByte();
      opcodeNumber = opcode & 0x1f;

      // Check for double-variable opcodes: call_vs2 (12) and call_vn2 (26)
      // Per Z-machine spec section 4.4.3: "The 'double variable' form only applies
      // to opcodes 12 (call_vs2) and 26 (call_vn2). In this case, two operand-type
      // bytes are always present."
      if (reallyVariable && (opcodeNumber === 12 || opcodeNumber === 26)) {
        const typesByte2 = state.readByte();
        operandTypes = this.decodeDoubleOperandTypes(typesByte1, typesByte2);
      } else {
        operandTypes = this.decodeOperandTypes(typesByte1);
      }
    } else if ((opcode & 0x80) === 0x80) {
      // Then Short form
      form = InstructionForm.Short;
      const opType = (opcode & 0x30) >> 4;
      if (opType !== OperandType.Omitted) {
        operandTypes = [opType];
      }
      opcodeNumber = opcode & 0x0f;
    } else {
      // Finally Long form
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
  public decodeOperandTypes(typesByte: number): Array<OperandType> {
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
   * Decodes operand types from two type bytes (for double-variable opcodes call_vs2 and call_vn2)
   * Per Z-machine spec section 4.4.3, these opcodes always have two operand-type bytes,
   * allowing up to 8 operands.
   * @param typesByte1 First operand types byte (operands 0-3)
   * @param typesByte2 Second operand types byte (operands 4-7)
   * @returns Array of operand types (up to 8)
   */
  public decodeDoubleOperandTypes(typesByte1: number, typesByte2: number): Array<OperandType> {
    const operandTypes: Array<OperandType> = [];

    // Decode first 4 operands from typesByte1
    for (let i = 0; i < 4; i++) {
      const opType = (typesByte1 >> ((3 - i) * 2)) & 0x03;
      if (opType === OperandType.Omitted) {
        return operandTypes; // Stop on first Omitted
      }
      operandTypes.push(opType);
    }

    // Decode next 4 operands from typesByte2
    for (let i = 0; i < 4; i++) {
      const opType = (typesByte2 >> ((3 - i) * 2)) & 0x03;
      if (opType === OperandType.Omitted) {
        break; // Stop on first Omitted
      }
      operandTypes.push(opType);
    }

    return operandTypes;
  }

  /**
   * Reads the operands based on their types
   * @param operandTypes The array of operand types
   * @param state The current state of the Z-machine
   * @returns An array of operand values
   */
  public readOperands(operandTypes: Array<OperandType>, state: ZMachine['state']): Array<number> {
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
  public resolveOpcode(
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
        // Extended opcodes (0xBE prefix in v5+)
        op = this.opExt[opcodeNumber];
      } else if (form === InstructionForm.Variable && reallyVariable) {
        // True variable-length opcodes (VAR form)
        op = this.opV[opcodeNumber];
      } else if (form === InstructionForm.Variable && !reallyVariable) {
        // 2OP instructions in variable form (can have 2-4 operands)
        op = this.op2[opcodeNumber];
      } else {
        // Fixed-length opcodes (Short/Long form)
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
            this.logger.debug(`Unhandled number of operands: ${operandCount} for non-variable opcode`);
            throw new Error(`Unhandled number of operands: ${operandCount} for non-variable opcode`);
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
   * Resume execution after suspension
   */
  async resume(): Promise<void> {
    if (!this._suspended) {
      this.logger.warn('Called resume() when not suspended');
      return;
    }

    this._suspended = false;
    this._suspendedInputState = null;

    // Continue execution
    await this.executeLoop();
  }

  /**
   * Terminates program execution
   */
  quit(): void {
    this._quit = true;
  }

  /**
   * Execute a timeout routine until it returns, capturing its return value.
   * This is used for timed input where the routine's return value determines
   * whether to continue waiting (return 0) or terminate input (return non-zero).
   *
   * @param originalCallDepth The callstack depth BEFORE the routine was called
   * @returns The return value of the timeout routine
   */
  async executeTimeoutRoutine(originalCallDepth: number): Promise<number> {
    // The routine was already called and pushed a frame, so current depth is originalCallDepth + 1
    // We execute until the routine returns (depth goes back to originalCallDepth)
    // Use > not >= because after return we'll be AT originalCallDepth, not below it

    try {
      while (!this._quit && this.zMachine.state.callstack.length > originalCallDepth) {
        this._op_pc = this.zMachine.state.pc;
        await this.executeInstruction();
      }
    } catch (e) {
      if (e instanceof SuspendState) {
        // The timeout routine itself tried to read input - this shouldn't happen
        // in well-behaved games, but if it does, treat as "continue waiting"
        this.logger.warn('Timeout routine attempted to read input, treating as continue');
        return 0;
      }
      throw e;
    }

    // The routine has returned - the return value was pushed to the stack
    // (we called with returnVar=0 which is the stack)
    const returnValue = this.zMachine.state.stack.pop() || 0;
    return returnValue;
  }
}
