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

  machine.logger.debug(
    `${machine.executor.op_pc.toString(16)} pull ${isIndirect ? '[' : '('}${variableRef}${isIndirect ? ']' : ')'}`
  );

  if (isIndirect) {
    // Indirect: variableRef points to a variable containing the target variable number
    const targetVariable = machine.state.loadVariable(variableRef);

    // Handle special stack pointer indirection case
    if (targetVariable === 0) {
      // Logical impossibility: can't pull from stack and store result in stack pointer indirectly
      // This would require reading the stack pointer to determine where to store the pulled value,
      // but pulling changes the stack pointer itself
      throw new Error('Illegal operation: indirect pull with stack pointer as target creates logical impossibility');
    } else {
      // Pull from stack and store in the target variable
      if (stackAddr !== undefined) {
        // V6+ user stack support
        const value = machine.getUserStackManager().pullStack(stackAddr);
        if (value === undefined) {
          throw new Error(`User stack underflow at address ${stackAddr}`);
        }
        machine.state.storeVariable(targetVariable, value);
      } else {
        // Normal stack
        const value = machine.state.popStack();
        machine.state.storeVariable(targetVariable, value);
      }
    }
  } else {
    // Direct: variableRef is the target variable
    if (stackAddr !== undefined) {
      // V6+ user stack support
      const value = machine.getUserStackManager().pullStack(stackAddr);
      if (value === undefined) {
        throw new Error(`User stack underflow at address ${stackAddr}`);
      }
      machine.state.storeVariable(variableRef, value);
    } else {
      // Normal stack
      const value = machine.state.popStack();
      machine.state.storeVariable(variableRef, value);
    }
  }
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
  const resultVar = machine.state.readByte();

  machine.logger.debug(
    `${machine.executor.op_pc.toString(16)} load ${isIndirect ? '[' : '('}${variableRef}${isIndirect ? ']' : ')'} -> (${resultVar})`
  );

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
      const value = machine.state.stack[machine.state.stack.length - 1];
      machine.state.storeVariable(resultVar, value);
    } else {
      const value = machine.state.loadVariable(targetVariable);
      machine.state.storeVariable(resultVar, value);
    }
  } else {
    // Direct: variableRef is the target variable
    const value = machine.state.loadVariable(variableRef);
    machine.state.storeVariable(resultVar, value);
  }
}

/**
 * Stores a value in a variable.
 * If the variable is indirect, it points to a variable containing the target variable number.
 * If the variable is direct, it is the target variable.
 * If the variable is 0, it refers to the stack pointer. In this case, the value is written to the
 * top of the stack in place (no push/pop). If the stack is empty, an error is thrown.
 */
function store(machine: ZMachine, operandTypes: OperandType[], variableRef: number, value: number): void {
  // For special opcodes, operand type Variable (2) means indirect
  const isIndirect = operandTypes[0] === OperandType.Variable;

  machine.logger.debug(
    `${machine.executor.op_pc.toString(16)} store ${isIndirect ? '[' : '('}${variableRef}${isIndirect ? ']' : ')'} ${value}`
  );

  if (isIndirect) {
    // Indirect: variableRef contains the target variable number
    const targetVariable = machine.state.loadVariable(variableRef);

    if (targetVariable === 0) {
      // Special stack pointer case
      if (machine.state.stack.length === 0) {
        throw new Error('Illegal operation: indirect store to stack pointer when stack is empty');
      }
      machine.state.stack[machine.state.stack.length - 1] = value;
    } else {
      machine.state.storeVariable(targetVariable, value, false);
    }
  } else {
    // Direct: variableRef is the target variable
    machine.state.storeVariable(variableRef, value, true);
  }
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

  machine.logger.debug(
    `${machine.executor.op_pc.toString(16)} inc ${isIndirect ? '[' : '('}${variableRef}${isIndirect ? ']' : ')'}`
  );

  if (isIndirect) {
    // Indirect: variableRef points to a variable containing the target variable number
    const targetVariable = machine.state.loadVariable(variableRef);

    // Handle special stack pointer indirection case
    if (targetVariable === 0) {
      // Indirect reference to stack pointer: increment top value in place
      if (machine.state.stack.length === 0) {
        throw new Error('Illegal operation: indirect inc on stack pointer when stack is empty');
      }
      // Increment top of stack in place (no push/pop)
      machine.state.stack[machine.state.stack.length - 1] = toU16(
        machine.state.stack[machine.state.stack.length - 1] + 1
      );
    } else {
      const currentValue = machine.state.loadVariable(targetVariable);
      const newValue = toU16(currentValue + 1);
      machine.state.storeVariable(targetVariable, newValue);
    }
  } else {
    // Direct: variableRef is the target variable
    const currentValue = machine.state.loadVariable(variableRef);
    const newValue = toU16(currentValue + 1);
    machine.state.storeVariable(variableRef, newValue);
  }
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

  machine.logger.debug(
    `${machine.executor.op_pc.toString(16)} dec ${isIndirect ? '[' : '('}${variableRef}${isIndirect ? ']' : ')'}`
  );

  if (isIndirect) {
    // Indirect: variableRef points to a variable containing the target variable number
    const targetVariable = machine.state.loadVariable(variableRef);

    // Handle special stack pointer indirection case
    if (targetVariable === 0) {
      // Indirect reference to stack pointer: decrement top value in place
      if (machine.state.stack.length === 0) {
        throw new Error('Illegal operation: indirect dec on stack pointer when stack is empty');
      }
      // Decrement top of stack in place (no push/pop)
      machine.state.stack[machine.state.stack.length - 1] = toU16(
        machine.state.stack[machine.state.stack.length - 1] - 1
      );
    } else {
      const currentValue = machine.state.loadVariable(targetVariable);
      const newValue = toU16(currentValue - 1);
      machine.state.storeVariable(targetVariable, newValue);
    }
  } else {
    // Direct: variableRef is the target variable
    const currentValue = machine.state.loadVariable(variableRef);
    const newValue = toU16(currentValue - 1);
    machine.state.storeVariable(variableRef, newValue);
  }
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
  const isIndirect = operandTypes[0] === OperandType.Variable;
  const [offset, branchOnFalse] = machine.state.readBranchOffset();

  machine.logger.debug(
    `${machine.executor.op_pc.toString(16)} inc_chk ${isIndirect ? '[' : '('}${variableRef}${isIndirect ? ']' : ')'} ${value} -> [${!branchOnFalse}] ${
      machine.state.pc + offset - 2
    }`
  );

  let newValue: number;

  if (isIndirect) {
    // Indirect: variableRef points to a variable containing the target variable number
    const targetVariable = machine.state.loadVariable(variableRef);

    // Handle special stack pointer indirection case
    if (targetVariable === 0) {
      // Indirect reference to stack pointer: increment top value in place
      if (machine.state.stack.length === 0) {
        throw new Error('Illegal operation: indirect inc_chk on stack pointer when stack is empty');
      }
      // Increment top of stack in place (no push/pop)
      const currentValue = machine.state.stack[machine.state.stack.length - 1];
      newValue = toI16(currentValue) + 1;
      machine.state.stack[machine.state.stack.length - 1] = toU16(newValue);
    } else {
      const currentValue = machine.state.loadVariable(targetVariable);
      newValue = toI16(currentValue) + 1;
      machine.state.storeVariable(targetVariable, toU16(newValue));
    }
  } else {
    // Direct: variableRef is the target variable
    const currentValue = machine.state.loadVariable(variableRef);
    newValue = toI16(currentValue) + 1;
    machine.state.storeVariable(variableRef, toU16(newValue));
  }

  machine.logger.debug(`     ${newValue} ?> ${value}`);
  machine.state.doBranch(newValue > toI16(value), branchOnFalse, offset);
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
  const isIndirect = operandTypes[0] === OperandType.Variable;
  const [offset, branchOnFalse] = machine.state.readBranchOffset();

  machine.logger.debug(
    `${machine.executor.op_pc.toString(16)} dec_chk ${isIndirect ? '[' : '('}${variableRef}${isIndirect ? ']' : ')'} ${value} -> [${!branchOnFalse}] ${
      machine.state.pc + offset - 2
    }`
  );

  let newValue: number;

  if (isIndirect) {
    // Indirect: variableRef points to a variable containing the target variable number
    const targetVariable = machine.state.loadVariable(variableRef);

    // Handle special stack pointer indirection case
    if (targetVariable === 0) {
      // Indirect reference to stack pointer: decrement top value in place
      if (machine.state.stack.length === 0) {
        throw new Error('Illegal operation: indirect dec_chk on stack pointer when stack is empty');
      }
      // Decrement top of stack in place (no push/pop)
      const currentValue = machine.state.stack[machine.state.stack.length - 1];
      newValue = toI16(currentValue) - 1;
      machine.state.stack[machine.state.stack.length - 1] = toU16(newValue);
    } else {
      const currentValue = machine.state.loadVariable(targetVariable);
      newValue = toI16(currentValue) - 1;
      machine.state.storeVariable(targetVariable, toU16(newValue));
    }
  } else {
    // Direct: variableRef is the target variable
    const currentValue = machine.state.loadVariable(variableRef);
    newValue = toI16(currentValue) - 1;
    machine.state.storeVariable(variableRef, toU16(newValue));
  }

  machine.logger.debug(`     ${newValue} <? ${value}`);
  machine.state.doBranch(newValue < toI16(value), branchOnFalse, offset);
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
