import { vi } from 'vitest';
import { SuspendState } from '../../src/core/execution/SuspendState';
import { Opcode } from '../../src/core/opcodes/base';
import { ZMachine } from '../../src/interpreter/ZMachine';
import { Address, InstructionForm, OperandType } from '../../src/types';
import { InputState } from '../../src/ui/input/InputInterface';

/**
 * MockExecutor provides a flexible implementation of the Executor
 * for unit testing purposes
 */
export class MockExecutor {
  // Mock the opcode tables
  public op0: Array<Opcode> = [];
  public op1: Array<Opcode> = [];
  public op2: Array<Opcode> = [];
  public opV: Array<Opcode> = [];
  public opExt: Array<Opcode> = [];

  // State tracking
  private _quit: boolean = false;
  private _suspended: boolean = false;
  private _suspendedInputState: InputState | null = null;
  private _op_pc: Address = 0;

  // Mock functions
  public executeLoop = vi.fn().mockImplementation(async (): Promise<void> => {
    // Default implementation just simulates execution completing
    return Promise.resolve();
  });

  public executeInstruction = vi.fn().mockImplementation(async (): Promise<void> => {
    return Promise.resolve();
  });

  public resume = vi.fn().mockImplementation(async (): Promise<void> => {
    this._suspended = false;
    this._suspendedInputState = null;
    return this.executeLoop();
  });

  public executeTimeoutRoutine = vi.fn().mockImplementation(async (_targetCallDepth: number): Promise<number> => {
    // Default implementation returns 0 (continue waiting)
    return Promise.resolve(0);
  });

  public quit = vi.fn().mockImplementation((): void => {
    this._quit = true;
  });

  // Constructor that accepts partial mock configuration
  constructor(
    public readonly zMachine: ZMachine,
    config: Partial<MockExecutor> = {}
  ) {
    // Apply any provided configuration overrides
    Object.assign(this, config);
  }

  // Create a factory method for easy instantiation with defaults
  static create(zMachine: ZMachine, overrides: Partial<MockExecutor> = {}): MockExecutor {
    return new MockExecutor(zMachine, overrides);
  }

  // Getters to match the real Executor
  get op_pc(): Address {
    return this._op_pc;
  }

  get suspendedInputState(): InputState | null {
    if (!this._suspended) {
      return null;
    }
    return this._suspendedInputState;
  }

  get isSuspended(): boolean {
    return this._suspended;
  }

  // Methods to control mock behavior in tests
  /**
   * Simulates execution suspension with the given input state
   */
  simulateSuspend(inputState: InputState): void {
    this._suspended = true;
    this._suspendedInputState = inputState;
  }

  /**
   * Simulates a SuspendState exception being thrown during execution
   * @param suspendState The suspend state to simulate
   */
  simulateSuspendException(suspendState: SuspendState): void {
    this._suspended = true;
    this._suspendedInputState = suspendState.toInputState();
    this.executeLoop.mockRejectedValueOnce(suspendState);
  }

  /**
   * Simulates an execution error
   * @param error The error to simulate
   */
  simulateError(error: Error): void {
    this.executeLoop.mockRejectedValueOnce(error);
    this.executeInstruction.mockRejectedValueOnce(error);
  }

  /**
   * Resets the mock's state and behavior
   */
  reset(): void {
    this._quit = false;
    this._suspended = false;
    this._suspendedInputState = null;
    this._op_pc = 0;

    this.executeLoop.mockClear();
    this.executeInstruction.mockClear();
    this.resume.mockClear();
    this.quit.mockClear();
  }

  /**
   * Simulates decoding an instruction
   * This mimics the private decodeInstruction method in the real Executor
   */
  decodeInstruction(opcode: number): {
    form: InstructionForm;
    reallyVariable: boolean;
    opcodeNumber: number;
    operandTypes: Array<OperandType>;
  } {
    // Simplified version that can be enhanced for specific test cases
    return {
      form: InstructionForm.Variable,
      reallyVariable: false,
      opcodeNumber: opcode & 0x1f,
      operandTypes: [],
    };
  }

  /**
   * Sets the opcode for a specific form and number
   * Useful for setting up test expectations
   */
  setOpcode(form: InstructionForm, opcodeNumber: number, op: Opcode): void {
    switch (form) {
      case InstructionForm.Extended:
        this.opExt[opcodeNumber] = op;
        break;
      case InstructionForm.Variable:
        this.opV[opcodeNumber] = op;
        break;
      case InstructionForm.Short:
      case InstructionForm.Long:
        // For short/long forms, categorize by operand count
        this.op0[opcodeNumber] = op;
        this.op1[opcodeNumber] = op;
        this.op2[opcodeNumber] = op;
        break;
    }
  }
}
