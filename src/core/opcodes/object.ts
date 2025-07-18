/**
 * Object manipulation opcodes
 * These opcodes provide functionality for manipulating objects in the Z-machine,
 * including setting and clearing attributes, inserting objects into other objects,
 * and getting properties of objects.
 *
 * Exported Opcodes:
 * - `test_attr`: Tests if an object has a specific attribute set.
 * - `set_attr`: Sets an attribute for an object.
 * - `clear_attr`: Clears an attribute for an object.
 * - `jin`: Tests if one object is inside another object.
 * - `insert_obj`: Inserts an object into another object.
 * - `get_prop`: Gets a property from an object.
 * - `get_prop_addr`: Gets the address of a property in an object.
 * - `get_next_prop`: Gets the next property number in an object.
 * - `get_sibling`: Gets the sibling of an object.
 * - `get_child`: Gets the child of an object.
 * - `get_parent`: Gets the parent of an object.
 * - `remove_obj`: Removes an object from its parent.
 * - `put_prop`: Sets a property value for an object.
 * - `get_prop_len`: Gets the length of a property.
 * - `print_obj`: Prints the name of an object.
 */
import { ZMachine } from '../../interpreter/ZMachine';
import { OperandType } from '../../types';
import { MAX_ATTRIBUTES_V3, MAX_ATTRIBUTES_V4 } from '../../utils/constants';
import { hex } from '../../utils/debug';
import { GameObject } from '../objects/GameObject';
import { opcode } from './base';

/**
 * Tests if an object has a specific attribute set.
 */
function test_attr(machine: ZMachine, _operandTypes: OperandType[], obj: number, attribute: number): void {
  const [offset, branchOnFalse] = machine.state.readBranchOffset();
  machine.logger.debug(
    `${machine.executor.op_pc.toString(16)} test_attr ${obj} ${attribute} -> [${!branchOnFalse}] ${
      machine.state.pc + offset - 2
    }`
  );

  const maxAttributes = machine.state.version <= 3 ? MAX_ATTRIBUTES_V3 : MAX_ATTRIBUTES_V4;
  if (attribute < 0 || attribute >= maxAttributes) {
    const pc = machine.executor.op_pc;
    machine.logger.error(`INVALID ATTRIBUTE: PC=${hex(pc)}, obj=${obj}, attr=${attribute}`);

    // Dump 16 bytes before and after the PC
    const startAddr = Math.max(0, pc - 16);
    const endAddr = Math.min(machine.memory.size - 1, pc + 16);
    const bytes = [];

    for (let addr = startAddr; addr <= endAddr; addr++) {
      const byte = machine.memory.getByte(addr);
      const marker = addr === pc ? `[${hex(byte)}]` : hex(byte);
      bytes.push(marker);
    }

    machine.logger.error(`Memory context: ${bytes.join(' ')}`);

    // Also show the instruction that was decoded
    machine.logger.error(`Current instruction: opcode at ${hex(pc)}, operands: obj=${obj}, attr=${attribute}`);

    throw new Error(`Attribute number out of range: ${attribute} (max ${maxAttributes - 1})`);
  }

  const targetObj = machine.state.getObject(obj);
  if (targetObj === null) {
    machine.logger.error('Object null in test_attr');
    machine.state.doBranch(false, branchOnFalse, offset);
  } else {
    machine.state.doBranch(targetObj.hasAttribute(attribute), branchOnFalse, offset);
  }
}

/**
 * Sets an attribute for an object.
 */
function set_attr(machine: ZMachine, _operandTypes: OperandType[], obj: number, attribute: number): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} set_attr ${obj} ${attribute}`);

  const targetObj = machine.state.getObject(obj);
  if (targetObj === null) {
    machine.logger.error('Object null in set_attr');
    return;
  }
  targetObj.setAttribute(attribute);
}

/**
 * Clears an attribute for an object.
 */
function clear_attr(machine: ZMachine, _operandTypes: OperandType[], obj: number, attribute: number): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} clear_attr ${obj} ${attribute}`);

  const targetObj = machine.state.getObject(obj);
  if (targetObj === null) {
    machine.logger.error('Object null in clear_attr');
    return;
  }
  targetObj.clearAttribute(attribute);
}

/**
 * Tests if one object is inside another object.
 */
function jin(machine: ZMachine, _operandTypes: OperandType[], obj1: number, obj2: number): void {
  const [offset, branchOnFalse] = machine.state.readBranchOffset();
  machine.logger.debug(
    `${machine.executor.op_pc.toString(16)} jin ${obj1} ${obj2} -> [${!branchOnFalse}] ${machine.state.pc + offset - 2}`
  );

  const o1 = machine.state.getObject(obj1);
  if (o1 === null) {
    machine.logger.error('Child object is null in jin');
    machine.state.doBranch(false, branchOnFalse, offset);
  } else {
    const parentObjNum = o1.parent ? o1.parent.objNum : 0;
    machine.state.doBranch(parentObjNum === obj2, branchOnFalse, offset);
  }
}

/**
 * Inserts an object into another object.
 */
function insert_obj(machine: ZMachine, _operandTypes: OperandType[], obj: number, destination: number): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} insert_obj ${obj} ${destination}`);

  const targetObj = machine.state.getObject(obj);
  if (targetObj === null) {
    machine.logger.error('Object null in insert_obj');
    return;
  }

  const destObj = machine.state.getObject(destination);
  if (destObj === null) {
    machine.logger.error('Destination object null in insert_obj');
    return;
  }

  // Remove the object from its current parent
  if (targetObj.parent) {
    targetObj.unlink();
  }

  // Insert the object into its new parent
  targetObj.sibling = destObj.child;
  targetObj.parent = destObj;
  destObj.child = targetObj;
}

/**
 * Gets a property from an object.
 */
function get_prop(machine: ZMachine, _operandTypes: OperandType[], obj: number, property: number): void {
  const resultVar = machine.state.readByte();
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} get_prop ${obj} ${property} -> (${resultVar})`);

  const targetObj = machine.state.getObject(obj);
  if (targetObj === null) {
    machine.logger.warn('get_prop called on null object');
    machine.state.storeVariable(resultVar, 0);
    return;
  }

  machine.state.storeVariable(resultVar, targetObj.getProperty(property));
}

/**
 * Gets the address of a property in an object.
 */
function get_prop_addr(machine: ZMachine, _operandTypes: OperandType[], obj: number, property: number): void {
  const resultVar = machine.state.readByte();
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} get_prop_addr ${obj} ${property} -> (${resultVar})`);

  const targetObj = machine.state.getObject(obj);
  if (targetObj === null) {
    machine.logger.warn('get_prop_addr called on null object');
    machine.state.storeVariable(resultVar, 0);
    return;
  }

  machine.state.storeVariable(resultVar, targetObj.getPropertyAddress(property));
}

/**
 * Gets the next property number in an object.
 */
function get_next_prop(machine: ZMachine, _operandTypes: OperandType[], obj: number, property: number): void {
  const resultVar = machine.state.readByte();
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} get_next_prop ${obj} ${property} -> (${resultVar})`);

  const targetObj = machine.state.getObject(obj);
  if (targetObj === null) {
    machine.logger.warn('get_next_prop called on null object');
    machine.state.storeVariable(resultVar, 0);
    return;
  }

  machine.state.storeVariable(resultVar, targetObj.getNextProperty(property));
}

/**
 * Gets the sibling of an object.
 */
function get_sibling(machine: ZMachine, _operandTypes: OperandType[], obj: number): void {
  const resultVar = machine.state.readByte();
  const [offset, branchOnFalse] = machine.state.readBranchOffset();
  machine.logger.debug(
    `${machine.executor.op_pc.toString(16)} get_sibling ${obj} -> (${resultVar}) ?[${!branchOnFalse}] ${offset}`
  );

  const targetObj = machine.state.getObject(obj);
  let sibling: GameObject | null = null;

  if (targetObj) {
    sibling = targetObj.sibling;
    machine.state.storeVariable(resultVar, sibling ? sibling.objNum : 0);
  } else {
    machine.logger.warn('object is 0 in get_sibling');
    machine.state.storeVariable(resultVar, 0);
  }

  machine.state.doBranch(sibling !== null, branchOnFalse, offset);
}

/**
 * Gets the child of an object.
 */
function get_child(machine: ZMachine, _operandTypes: OperandType[], obj: number): void {
  const resultVar = machine.state.readByte();
  const [offset, branchOnFalse] = machine.state.readBranchOffset();
  machine.logger.debug(
    `${machine.executor.op_pc.toString(16)} get_child ${obj} -> (${resultVar}) ?[${!branchOnFalse}] ${offset}`
  );

  const targetObj = machine.state.getObject(obj);
  if (targetObj === null) {
    machine.logger.warn('object is 0 in get_child');
    machine.state.storeVariable(resultVar, 0);
    machine.state.doBranch(false, branchOnFalse, offset);
    return;
  }

  const child = targetObj.child;
  machine.state.storeVariable(resultVar, child ? child.objNum : 0);
  machine.state.doBranch(child !== null, branchOnFalse, offset);
}

/**
 * Gets the parent of an object.
 */
function get_parent(machine: ZMachine, _operandTypes: OperandType[], obj: number): void {
  const resultVar = machine.state.readByte();
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} get_parent ${obj} -> (${resultVar})`);

  const targetObj = machine.state.getObject(obj);
  if (targetObj === null) {
    machine.logger.error('object null in get_parent');
    machine.state.storeVariable(resultVar, 0);
    return;
  }

  const parent_objNum = targetObj.parent === null ? 0 : targetObj.parent.objNum;
  machine.state.storeVariable(resultVar, parent_objNum);
}

/**
 * Removes an object from its parent.
 */
function remove_obj(machine: ZMachine, _operandTypes: OperandType[], obj: number): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} remove_obj ${obj}`);

  const targetObj = machine.state.getObject(obj);
  if (targetObj === null) {
    machine.logger.error('object null in remove_obj');
    return;
  }

  targetObj.unlink();
}

/**
 * Sets a property value for an object.
 */
function put_prop(machine: ZMachine, _operandTypes: OperandType[], obj: number, property: number, value: number): void {
  machine.logger.debug(`put_prop ${obj} ${property} ${value}`);

  const targetObj = machine.state.getObject(obj);
  if (targetObj === null) {
    machine.logger.warn('put_prop called on null object');
    return;
  }

  targetObj.putProperty(property, value);
}

/**
 * Gets the length of a property.
 */
function get_prop_len(machine: ZMachine, _operandTypes: OperandType[], propDataAddr: number): void {
  const resultVar = machine.state.readByte();
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} get_prop_len ${propDataAddr} -> (${resultVar})`);

  const len = GameObject.getPropertyLength(machine.state.memory, machine.state.version, propDataAddr);
  machine.state.storeVariable(resultVar, len);
}

/**
 * Prints the name of an object.
 */
function print_obj(machine: ZMachine, _operandTypes: OperandType[], obj: number): void {
  machine.logger.debug(`${machine.executor.op_pc.toString(16)} print_obj ${obj}`);

  const targetObj = machine.state.getObject(obj);
  if (targetObj === null) {
    machine.logger.warn(`print_obj: object ${obj} not found`);
    return;
  }

  machine.screen.print(machine, targetObj.name);
}

/**
 * Export all object manipulation opcodes
 */
export const objectOpcodes = {
  // 2OP opcodes
  jin: opcode('jin', jin),
  test_attr: opcode('test_attr', test_attr),
  set_attr: opcode('set_attr', set_attr),
  clear_attr: opcode('clear_attr', clear_attr),
  insert_obj: opcode('insert_obj', insert_obj),
  get_prop: opcode('get_prop', get_prop),
  get_prop_addr: opcode('get_prop_addr', get_prop_addr),
  get_next_prop: opcode('get_next_prop', get_next_prop),
  put_prop: opcode('put_prop', put_prop),

  // 1OP opcodes
  get_sibling: opcode('get_sibling', get_sibling),
  get_child: opcode('get_child', get_child),
  get_parent: opcode('get_parent', get_parent),
  remove_obj: opcode('remove_obj', remove_obj),
  print_obj: opcode('print_obj', print_obj),
  get_prop_len: opcode('get_prop_len', get_prop_len),
};
