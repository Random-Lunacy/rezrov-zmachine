/**
 * Stack manipulation opcodes
 * This module contains the implementation of stack manipulation opcodes for the Z-Machine.
 *
 * Exported functions:
 * - push: Pushes a value onto the stack.
 * - pop: Pops a value from the stack.
 * - pull: Pops a value from the stack and stores it in a variable.
 * - load: Loads a value from a variable and stores it in the result variable.
 * - store: Stores a value in a variable.
 * - inc: Increments a variable by 1.
 * - dec: Decrements a variable by 1.
 * - inc_chk: Increments a variable, then checks if it's greater than a value.
 * - dec_chk: Decrements a variable, then checks if it's less than a value.
 * - pop_stack: Pops a value from the stack and discards it.
 * - push_stack: Pushes a value onto the stack.
 */
import { ZMachine } from '../../interpreter/ZMachine';
import { OperandType } from '../../types';
import { toI16, toU16 } from '../memory/cast16';
import { opcode } from './base';

/**
 * Pushes a value onto the stack.
 */
function push(machine: ZMachine, _operandTypes: OperandType[], value: number): void {
  machine.logger.debug(`push ${value}`);
  machine.state.pushStack(value);
}

/**
 * Pops a value from the stack.
 * The value is discarded.
 */
function pop(machine: ZMachine): void {
  machine.logger.debug(`pop`);
  machine.state.popStack();
}

/**
 * Pops a value from the stack and stores it in a variable.
 *
 * V1-V5: pull variable
 *   - Pops from game stack, stores in the named variable.
 *   - The operand is the target variable number (or indirect variable reference).
 *   - Variable 0 (stack pointer) as indirect target is an error.
 *
 * V6: pull (user-stack) → (result)
 *   - A stored opcode: reads a result variable byte from the bytecode after the operands.
 *   - The operand is the user stack address. If 0 or omitted, pops from the game stack instead.
 *   - Note: the operand may be absent (types byte 0xFF) when the game stack is intended.
 */
function pull(machine: ZMachine, operandTypes: OperandType[], variableRef?: number): void {
  // V6: completely different semantics — stored opcode, operand is user stack address
  if (machine.state.version >= 6) {
    const resultVar = machine.state.readByte();
    let value: number;
    // Treat undefined (no operand) and 0 the same: pop from game stack
    if (variableRef) {
      const pulledValue = machine.getUserStackManager().pullStack(variableRef);
      if (pulledValue === undefined) {
        throw new Error(`User stack underflow at address 0x${variableRef.toString(16)}`);
      }
      value = pulledValue;
    } else {
      value = machine.state.popStack();
    }
    machine.state.storeVariable(resultVar, value);
    const pcHex = (machine.executor?.op_pc ?? machine.state.pc).toString(16);
    const addrDisplay = variableRef ? `0x${variableRef.toString(16)}` : 'game-stack';
    machine.logger.debug(`${pcHex} pull (${addrDisplay}) -> (${resultVar}) = ${value}`);
    return;
  }

  // V1-V5: pop game stack, store in named variable (no result byte in bytecode)
  if (variableRef === undefined) {
    // No operand — this shouldn't happen in well-formed V1-V5 stories, but handle gracefully
    machine.state.popStack();
    return;
  }

  const isIndirect = operandTypes[0] === OperandType.Variable;
  const varDisplay = isIndirect ? `(${variableRef})` : `${variableRef}`;

  let targetVariable: number;

  if (isIndirect) {
    targetVariable = machine.state.loadVariable(variableRef);

    // This creates a logical impossibility: we'd need to read the stack pointer
    // to know where to store the value, but pulling changes the stack pointer itself.
    if (targetVariable === 0) {
      throw new Error('Illegal operation: indirect pull with stack pointer as target creates logical impossibility');
    }
  } else {
    targetVariable = variableRef;
  }

  const value = machine.state.popStack();
  machine.state.storeVariable(targetVariable, value);

  const pcHex = (machine.executor?.op_pc ?? machine.state.pc).toString(16);
  machine.logger.debug(`${pcHex} pull ${varDisplay}`);
}

/**
 * Loads a value from a variable and stores it in the result variable.
 * If the variable is indirect, it points to a variable containing the target variable number.
 * If the variable is direct, it is the target variable.
 * If the variable is 0, it refers to the stack pointer. In this case, the value is read from the top
 * of the stack in place (no push/pop). If the stack is empty, an error is thrown.
 */
function load(machine: ZMachine, operandTypes: OperandType[], variableRef: number): void {
  const isIndirect = operandTypes[0] === OperandType.Variable;
  const varDisplay = isIndirect ? `(${variableRef})` : `${variableRef}`;
  const resultVar = machine.state.readByte();

  let targetVariable: number;

  if (isIndirect) {
    targetVariable = machine.state.loadVariable(variableRef);
  } else {
    targetVariable = variableRef;
  }

  let value: number;

  // Z-spec §6.3.4: variable 0 (stack) is always read in place (no pop)
  if (targetVariable === 0) {
    if (machine.state.stack.length === 0) {
      throw new Error('Illegal operation: load from stack pointer when stack is empty');
    }
    value = machine.state.stack[machine.state.stack.length - 1];
  } else {
    value = machine.state.loadVariable(targetVariable);
  }

  machine.state.storeVariable(resultVar, value);
  const pcHex = (machine.executor?.op_pc ?? machine.state.pc).toString(16);
  machine.logger.debug(`${pcHex} load ${varDisplay} -> (${resultVar})`);
}

/**
 * Stores a value in a variable.
 * If the variable is indirect, it points to a variable containing the target variable number.
 * If the variable is direct, it is the target variable.
 * Z-spec §6.3.4: variable 0 (stack) is always written in place (no push/pop).
 */
function store(machine: ZMachine, operandTypes: OperandType[], variableRef: number, value: number): void {
  const isIndirect = operandTypes[0] === OperandType.Variable;
  const varDisplay = isIndirect ? `(${variableRef})` : `${variableRef}`;

  let targetVariable: number;

  if (isIndirect) {
    targetVariable = machine.state.loadVariable(variableRef);
  } else {
    targetVariable = variableRef;
  }

  // Z-spec §6.3.4: indirect variable references to stack pointer (0) are in-place
  if (targetVariable === 0) {
    if (machine.state.stack.length === 0) {
      throw new Error('Illegal operation: store to stack pointer when stack is empty');
    }
    machine.state.stack[machine.state.stack.length - 1] = value;
    const pcHex = (machine.executor?.op_pc ?? machine.state.pc).toString(16);
    machine.logger.debug(`${pcHex} store ${varDisplay} ${value} (stack top in place)`);
    return;
  }

  machine.state.storeVariable(targetVariable, value);
  const pcHex = (machine.executor?.op_pc ?? machine.state.pc).toString(16);
  machine.logger.debug(`${pcHex} store ${varDisplay} ${value}`);
}

/**
 * Increments a variable by 1.
 * If the variable is indirect, it points to a variable containing the target variable number.
 * If the variable is direct, it is the target variable.
 * If the variable is 0, it refers to the stack pointer. In this case, the value is incremented in
 * place (no push/pop). If the stack is empty, an error is thrown.
 */
function inc(machine: ZMachine, operandTypes: OperandType[], variableRef: number): void {
  const isIndirect = operandTypes[0] === OperandType.Variable;
  const varDisplay = isIndirect ? `(${variableRef})` : `${variableRef}`;

  let targetVariable: number;
  let currentValue: number;

  if (isIndirect) {
    targetVariable = machine.state.loadVariable(variableRef);

    // Handle special stack pointer indirection case
    if (targetVariable === 0) {
      // Indirect reference to stack pointer: increment top value IN PLACE
      if (machine.state.stack.length === 0) {
        throw new Error('Illegal operation: indirect increment of stack pointer when stack is empty');
      }
      // Increment top of stack in place (no push/pop)
      currentValue = machine.state.stack[machine.state.stack.length - 1];
      const newValue = toU16(toI16(currentValue) + 1);
      machine.state.stack[machine.state.stack.length - 1] = newValue;

      const pcHex = (machine.executor?.op_pc ?? machine.state.pc).toString(16);
      machine.logger.debug(`${pcHex} inc ${varDisplay} ${currentValue} (stack top in place)`);
      return;
    }
  } else {
    targetVariable = variableRef;
  }

  currentValue = machine.state.loadVariable(targetVariable);
  const newValue = toU16(toI16(currentValue) + 1);
  machine.state.storeVariable(targetVariable, newValue);

  const pcHex = (machine.executor?.op_pc ?? machine.state.pc).toString(16);
  machine.logger.debug(`${pcHex} inc ${varDisplay} ${currentValue}`);
}

/**
 * Decrements a variable by 1.
 * If the variable is indirect, it points to a variable containing the target variable number.
 * If the variable is direct, it is the target variable.
 * If the variable is 0, it refers to the stack pointer. In this case, the value is decremented in
 * place (no push/pop). If the stack is empty, an error is thrown.
 */
function dec(machine: ZMachine, operandTypes: OperandType[], variableRef: number): void {
  const isIndirect = operandTypes[0] === OperandType.Variable;
  const varDisplay = isIndirect ? `(${variableRef})` : `${variableRef}`;

  let targetVariable: number;
  let currentValue: number;

  if (isIndirect) {
    targetVariable = machine.state.loadVariable(variableRef);

    // Handle special stack pointer indirection case
    if (targetVariable === 0) {
      // Indirect reference to stack pointer: decrement top value IN PLACE
      if (machine.state.stack.length === 0) {
        throw new Error('Illegal operation: indirect decrement of stack pointer when stack is empty');
      }
      // Decrement top of stack in place (no push/pop)
      currentValue = machine.state.stack[machine.state.stack.length - 1];
      const newValue = toU16(toI16(currentValue) - 1);
      machine.state.stack[machine.state.stack.length - 1] = newValue;

      const pcHex = (machine.executor?.op_pc ?? machine.state.pc).toString(16);
      machine.logger.debug(`${pcHex} dec ${varDisplay} ${currentValue} (stack top in place)`);
      return;
    }
  } else {
    targetVariable = variableRef;
  }

  currentValue = machine.state.loadVariable(targetVariable);
  const newValue = toU16(toI16(currentValue) - 1);
  machine.state.storeVariable(targetVariable, newValue);

  const pcHex = (machine.executor?.op_pc ?? machine.state.pc).toString(16);
  machine.logger.debug(`${pcHex} dec ${varDisplay} ${currentValue}`);
}

/**
 * Increments a variable, then checks if it's greater than a value.
 * If the variable is indirect, it points to a variable containing the target variable number.
 * If the variable is direct, it is the target variable.
 * If the variable is 0, it refers to the stack pointer. In this case, the value is incremented in
 * place (no push/pop). If the stack is empty, an error is thrown.
 * The result of the comparison is used to determine whether to branch.
 */
function inc_chk(machine: ZMachine, operandTypes: OperandType[], variableRef: number, value: number): void {
  const [offset, branchOnFalse] = machine.state.readBranchOffset();
  const isIndirect = operandTypes[0] === OperandType.Variable;
  const varDisplay = isIndirect ? `(${variableRef})` : `${variableRef}`;

  let targetVariable: number;
  let currentValue: number;
  let newValue: number;

  if (isIndirect) {
    targetVariable = machine.state.loadVariable(variableRef);

    // Handle special stack pointer indirection case
    if (targetVariable === 0) {
      // Indirect reference to stack pointer: increment top value IN PLACE
      if (machine.state.stack.length === 0) {
        throw new Error('Illegal operation: indirect inc_chk of stack pointer when stack is empty');
      }
      // Increment top of stack in place (no push/pop)
      currentValue = machine.state.stack[machine.state.stack.length - 1];
      newValue = toU16(toI16(currentValue) + 1);
      machine.state.stack[machine.state.stack.length - 1] = newValue;

      const condition = toI16(newValue) > toI16(value);
      machine.state.doBranch(condition, branchOnFalse, offset);

      const pcHex = (machine.executor?.op_pc ?? machine.state.pc).toString(16);
      machine.logger.debug(
        `${pcHex} inc_chk ${varDisplay} ${currentValue} > ${value} = ${condition} (stack top in place)`
      );
      return;
    }
  } else {
    targetVariable = variableRef;
  }

  currentValue = machine.state.loadVariable(targetVariable);
  newValue = toU16(toI16(currentValue) + 1);
  machine.state.storeVariable(targetVariable, newValue);

  const condition = toI16(newValue) > toI16(value);
  machine.state.doBranch(condition, branchOnFalse, offset);

  const pcHex = (machine.executor?.op_pc ?? machine.state.pc).toString(16);
  machine.logger.debug(`${pcHex} inc_chk ${varDisplay} ${currentValue} > ${value} = ${condition}`);
}

/**
 * Decrements a variable, then checks if it's less than a value.
 * If the variable is indirect, it points to a variable containing the target variable number.
 * If the variable is direct, it is the target variable.
 * If the variable is 0, it refers to the stack pointer. In this case, the value is decremented in
 * place (no push/pop). If the stack is empty, an error is thrown.
 * The result of the comparison is used to determine whether to branch.
 */
function dec_chk(machine: ZMachine, operandTypes: OperandType[], variableRef: number, value: number): void {
  const [offset, branchOnFalse] = machine.state.readBranchOffset();
  const isIndirect = operandTypes[0] === OperandType.Variable;
  const varDisplay = isIndirect ? `(${variableRef})` : `${variableRef}`;

  let targetVariable: number;
  let currentValue: number;
  let newValue: number;

  if (isIndirect) {
    targetVariable = machine.state.loadVariable(variableRef);

    // Handle special stack pointer indirection case
    if (targetVariable === 0) {
      // Indirect reference to stack pointer: decrement top value IN PLACE
      if (machine.state.stack.length === 0) {
        throw new Error('Illegal operation: indirect dec_chk of stack pointer when stack is empty');
      }
      // Decrement top of stack in place (no push/pop)
      currentValue = machine.state.stack[machine.state.stack.length - 1];
      newValue = toU16(toI16(currentValue) - 1);
      machine.state.stack[machine.state.stack.length - 1] = newValue;

      const condition = toI16(newValue) < toI16(value);
      machine.state.doBranch(condition, branchOnFalse, offset);

      const pcHex = (machine.executor?.op_pc ?? machine.state.pc).toString(16);
      machine.logger.debug(
        `${pcHex} dec_chk ${varDisplay} ${currentValue} < ${value} = ${condition} (stack top in place)`
      );
      return;
    }
  } else {
    targetVariable = variableRef;
  }

  currentValue = machine.state.loadVariable(targetVariable);
  newValue = toU16(toI16(currentValue) - 1);
  machine.state.storeVariable(targetVariable, newValue);

  const condition = toI16(newValue) < toI16(value);
  machine.state.doBranch(condition, branchOnFalse, offset);

  const pcHex = (machine.executor?.op_pc ?? machine.state.pc).toString(16);
  machine.logger.debug(`${pcHex} dec_chk ${varDisplay} ${currentValue} < ${value} = ${condition}`);
}

/**
 * Remove items from a specified stack (V6)
 */
function pop_stack(machine: ZMachine, _operandTypes: OperandType[], items: number, stackAddr?: number): void {
  const pcHex = (machine.executor?.op_pc ?? machine.state.pc).toString(16);
  machine.logger.debug(`${pcHex} pop_stack ${items} ${stackAddr || ''}`);

  // Only valid in Version 6
  if (machine.state.version !== 6) {
    machine.logger.warn('pop_stack opcode only available in Version 6');
    return;
  }

  if (stackAddr !== undefined) {
    // Pop from user stack
    machine.getUserStackManager().popStack(stackAddr, items);
  } else {
    // Pop from system stack
    for (let i = 0; i < items; i++) {
      machine.state.popStack();
    }
  }
}

/**
 * Push value onto user stack, branch if successful (V6)
 */
function push_stack(machine: ZMachine, _operandTypes: OperandType[], value: number, stackAddr: number): void {
  const [offset, branchOnFalse] = machine.state.readBranchOffset();
  const pcHex = (machine.executor?.op_pc ?? machine.state.pc).toString(16);
  machine.logger.debug(`${pcHex} push_stack ${value} ${stackAddr}`);

  // Only valid in Version 6
  if (machine.state.version !== 6) {
    machine.logger.warn('push_stack opcode only available in Version 6');
    return;
  }

  const success = machine.getUserStackManager().pushStack(stackAddr, value);

  // Branch if successful
  machine.state.doBranch(success, branchOnFalse, offset);
}

/**
 * Export all stack manipulation opcodes
 */
export const stackOpcodes = {
  // Stack operations
  push: opcode('push', push),
  pop: opcode('pop', pop),
  pull: opcode('pull', pull),
  push_stack: opcode('push_stack', push_stack),
  pop_stack: opcode('pop_stack', pop_stack),

  // Variable operations
  load: opcode('load', load),
  store: opcode('store', store),
  inc: opcode('inc', inc),
  dec: opcode('dec', dec),
  inc_chk: opcode('inc_chk', inc_chk),
  dec_chk: opcode('dec_chk', dec_chk),
};
