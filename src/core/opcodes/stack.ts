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
 * If a stack address is provided, it uses the user stack.
 * If no stack address is provided, it uses the normal stack.
 * The value is stored in the variable specified by the operand.
 * If the variable is indirect, it points to a variable containing the target variable number.
 * If the variable is direct, it is the target variable.
 * If the variable is 0, it refers to the stack pointer. In this case, an error is thrown.
 */
function pull(machine: ZMachine, operandTypes: OperandType[], variableRef: number, stackAddr?: number): void {
  const isIndirect = operandTypes[0] === OperandType.Variable;
  const varDisplay = isIndirect ? `(${variableRef})` : `${variableRef}`;

  // Determine the target variable to store the pulled value
  let targetVariable: number;

  if (isIndirect) {
    targetVariable = machine.state.loadVariable(variableRef);

    // Handle special stack pointer indirection case
    if (targetVariable === 0) {
      // This creates a logical impossibility as described in the documentation:
      // We'd need to read the stack pointer to know where to store the value,
      // but pulling changes the stack pointer itself
      throw new Error('Illegal operation: indirect pull with stack pointer as target creates logical impossibility');
    }
  } else {
    targetVariable = variableRef;
  }

  // Pull value from appropriate stack (consolidated logic)
  let value: number;

  if (machine.state.version >= 6 && stackAddr !== undefined) {
    // V6+ user stack support
    const pulledValue = machine.getUserStackManager().pullStack(stackAddr);
    if (pulledValue === undefined) {
      throw new Error(`User stack underflow at address ${stackAddr}`);
    }
    value = pulledValue;
  } else {
    // Normal system stack
    value = machine.state.popStack();
  }

  // Store the pulled value in the target variable
  machine.state.storeVariable(targetVariable, value);

  machine.logger.debug(`${machine.executor.op_pc.toString(16)} pull ${varDisplay} ${stackAddr || ''}`);
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

  let value: number;

  if (isIndirect) {
    // Indirect: variableRef points to a variable containing the target variable number
    const targetVariable = machine.state.loadVariable(variableRef);

    // Handle special stack pointer indirection case
    if (targetVariable === 0) {
      // Indirect reference to stack pointer: read top value in place
      if (machine.state.stack.length === 0) {
        throw new Error('Illegal operation: indirect load from stack pointer when stack is empty');
      }
      // Read from top of stack in place (no push/pop)
      value = machine.state.stack[machine.state.stack.length - 1];
    } else {
      value = machine.state.loadVariable(targetVariable);
    }
  } else {
    // Direct: variableRef is the target variable
    value = machine.state.loadVariable(variableRef);
  }

  machine.state.storeVariable(resultVar, value);
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} load ${varDisplay} -> (${resultVar})`);
}

/**
 * Stores a value in a variable.
 * If the variable is indirect, it points to a variable containing the target variable number.
 * If the variable is direct, it is the target variable.
 * If the variable is 0, it refers to the stack pointer. In this case, the value is written to the
 * top of the stack in place (no push/pop). If the stack is empty, an error is thrown.
 */
function store(machine: ZMachine, operandTypes: OperandType[], variableRef: number, value: number): void {
  const isIndirect = operandTypes[0] === OperandType.Variable;
  const varDisplay = isIndirect ? `(${variableRef})` : `${variableRef}`;

  let targetVariable: number;

  if (isIndirect) {
    targetVariable = machine.state.loadVariable(variableRef);

    // Handle special stack pointer indirection case
    if (targetVariable === 0) {
      // Indirect reference to stack pointer: store to top value IN PLACE
      if (machine.state.stack.length === 0) {
        throw new Error('Illegal operation: indirect store to stack pointer when stack is empty');
      }
      // Store to top of stack in place (no push/pop)
      machine.state.stack[machine.state.stack.length - 1] = value;

      machine.logger.debug(`${machine.executor.op_pc.toString(16)} store ${varDisplay} ${value} (stack top in place)`);
      return;
    }
  } else {
    targetVariable = variableRef;

    // Direct access to stack pointer: normal push semantics
    if (targetVariable === 0) {
      machine.state.pushStack(value);
      machine.logger.debug(`${machine.executor.op_pc.toString(16)} store ${varDisplay} ${value} (pushed to stack)`);
      return;
    }
  }

  machine.state.storeVariable(targetVariable, value);
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} store ${varDisplay} ${value}`);
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

      machine.logger.debug(
        `${machine.executor.op_pc.toString(16)} inc ${varDisplay} ${currentValue} (stack top in place)`
      );
      return;
    }
  } else {
    targetVariable = variableRef;
  }

  currentValue = machine.state.loadVariable(targetVariable);
  const newValue = toU16(toI16(currentValue) + 1);
  machine.state.storeVariable(targetVariable, newValue);

  machine.logger.debug(`${machine.executor.op_pc.toString(16)} inc ${varDisplay} ${currentValue}`);
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

      machine.logger.debug(
        `${machine.executor.op_pc.toString(16)} dec ${varDisplay} ${currentValue} (stack top in place)`
      );
      return;
    }
  } else {
    targetVariable = variableRef;
  }

  currentValue = machine.state.loadVariable(targetVariable);
  const newValue = toU16(toI16(currentValue) - 1);
  machine.state.storeVariable(targetVariable, newValue);

  machine.logger.debug(`${machine.executor.op_pc.toString(16)} dec ${varDisplay} ${currentValue}`);
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

      machine.logger.debug(
        `${machine.executor.op_pc.toString(16)} inc_chk ${varDisplay} ${currentValue} > ${value} = ${condition} (stack top in place)`
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

  machine.logger.debug(
    `${machine.executor.op_pc.toString(16)} inc_chk ${varDisplay} ${currentValue} > ${value} = ${condition}`
  );
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

      machine.logger.debug(
        `${machine.executor.op_pc.toString(16)} dec_chk ${varDisplay} ${currentValue} < ${value} = ${condition} (stack top in place)`
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

  machine.logger.debug(
    `${machine.executor.op_pc.toString(16)} dec_chk ${varDisplay} ${currentValue} < ${value} = ${condition}`
  );
}

/**
 * Remove items from a specified stack (V6)
 */
function pop_stack(machine: ZMachine, _operandTypes: OperandType[], items: number, stackAddr?: number): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} pop_stack ${items} ${stackAddr || ''}`);

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
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} push_stack ${value} ${stackAddr}`);

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
