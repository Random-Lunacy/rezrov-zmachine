import { ZMachine } from "../../interpreter/ZMachine";
import { opcode } from "./base";
import { toI16, toU16 } from "../memory/cast16";
import { GameObject } from "../objects/GameObject";

/**
 * Tests if an object has a specific attribute set.
 */
function test_attr(machine: ZMachine, obj: number, attribute: number): void {
  const [offset, condfalse] = machine.readBranchOffset();
  machine.logger.debug(
    `${machine.op_pc.toString(
      16
    )} test_attr ${obj} ${attribute} -> [${!condfalse}] ${
      machine.pc + offset - 2
    }`
  );

  const o = machine.getObject(obj);
  if (o === null) {
    machine.logger.error("Object null in test_attr");
    machine.doBranch(false, condfalse, offset);
  } else {
    machine.doBranch(o.hasAttribute(attribute), condfalse, offset);
  }
}

/**
 * Sets an attribute for an object.
 */
function set_attr(machine: ZMachine, obj: number, attribute: number): void {
  machine.logger.debug(
    `${machine.op_pc.toString(16)} set_attr ${obj} ${attribute}`
  );

  const o = machine.getObject(obj);
  if (o === null) {
    machine.logger.error("Object null in set_attr");
    return;
  }
  o.setAttribute(attribute);
}

/**
 * Clears an attribute for an object.
 */
function clear_attr(machine: ZMachine, obj: number, attribute: number): void {
  machine.logger.debug(
    `${machine.op_pc.toString(16)} clear_attr ${obj} ${attribute}`
  );

  const o = machine.getObject(obj);
  if (o === null) {
    machine.logger.error("Object null in clear_attr");
    return;
  }
  o.clearAttribute(attribute);
}

/**
 * Tests if one object is inside another object.
 */
function jin(machine: ZMachine, obj1: number, obj2: number): void {
  const [offset, condfalse] = machine.readBranchOffset();
  machine.logger.debug(
    `${machine.op_pc.toString(16)} jin ${obj1} ${obj2} -> [${!condfalse}] ${
      machine.pc + offset - 2
    }`
  );

  const o1 = machine.getObject(obj1);
  if (o1 === null) {
    machine.logger.error("Child object is null in jin");
    machine.doBranch(false, condfalse, offset);
  } else {
    const parentObjNum = o1.parent ? o1.parent.objnum : 0;
    machine.doBranch(parentObjNum === obj2, condfalse, offset);
  }
}

/**
 * Inserts an object into another object.
 */
function insert_obj(machine: ZMachine, obj: number, destination: number): void {
  machine.logger.debug(
    `${machine.op_pc.toString(16)} insert_obj ${obj} ${destination}`
  );

  const o = machine.getObject(obj);
  if (o === null) {
    machine.logger.error("Object null in insert_obj");
    return;
  }

  const desto = machine.getObject(destination);
  if (desto === null) {
    machine.logger.error("Destination object null in insert_obj");
    return;
  }

  // Remove the object from its current parent
  if (o.parent) {
    o.unlink();
  }

  // Insert the object into its new parent
  o.sibling = desto.child;
  o.parent = desto;
  desto.child = o;
}

/**
 * Gets a property from an object.
 */
function get_prop(machine: ZMachine, obj: number, property: number): void {
  const resultVar = machine.readByte();
  machine.logger.debug(
    `${machine.op_pc.toString(
      16
    )} get_prop ${obj} ${property} -> (${resultVar})`
  );

  const o = machine.getObject(obj);
  if (o === null) {
    machine.logger.warn("get_prop called on null object");
    machine.storeVariable(resultVar, 0);
    return;
  }

  machine.storeVariable(resultVar, o.getProperty(property));
}

/**
 * Gets the address of a property in an object.
 */
function get_prop_addr(machine: ZMachine, obj: number, property: number): void {
  const resultVar = machine.readByte();
  machine.logger.debug(
    `${machine.op_pc.toString(
      16
    )} get_prop_addr ${obj} ${property} -> (${resultVar})`
  );

  const o = machine.getObject(obj);
  if (o === null) {
    machine.logger.warn("get_prop_addr called on null object");
    machine.storeVariable(resultVar, 0);
    return;
  }

  machine.storeVariable(resultVar, o.getPropertyAddress(property));
}

/**
 * Gets the next property number in an object.
 */
function get_next_prop(machine: ZMachine, obj: number, property: number): void {
  const resultVar = machine.readByte();
  machine.logger.debug(
    `${machine.op_pc.toString(
      16
    )} get_next_prop ${obj} ${property} -> (${resultVar})`
  );

  const o = machine.getObject(obj);
  if (o === null) {
    machine.logger.warn("get_next_prop called on null object");
    machine.storeVariable(resultVar, 0);
    return;
  }

  machine.storeVariable(resultVar, o.getNextProperty(property));
}

/**
 * Gets the sibling of an object.
 */
function get_sibling(machine: ZMachine, obj: number): void {
  const resultVar = machine.readByte();
  const [offset, condfalse] = machine.readBranchOffset();
  machine.logger.debug(
    `${machine.op_pc.toString(
      16
    )} get_sibling ${obj} -> (${resultVar}) ?[${!condfalse}] ${offset}`
  );

  const o = machine.getObject(obj);
  let sibling: GameObject | null = null;

  if (o) {
    sibling = o.sibling;
    machine.storeVariable(resultVar, sibling ? sibling.objnum : 0);
  } else {
    machine.logger.warn("object is 0 in get_sibling");
    machine.storeVariable(resultVar, 0);
  }

  machine.doBranch(sibling !== null, condfalse, offset);
}

/**
 * Gets the child of an object.
 */
function get_child(machine: ZMachine, obj: number): void {
  const resultVar = machine.readByte();
  const [offset, condfalse] = machine.readBranchOffset();
  machine.logger.debug(
    `${machine.op_pc.toString(
      16
    )} get_child ${obj} -> (${resultVar}) ?[${!condfalse}] ${offset}`
  );

  const o = machine.getObject(obj);
  if (o === null) {
    machine.logger.warn("object is 0 in get_child");
    machine.storeVariable(resultVar, 0);
    machine.doBranch(false, condfalse, offset);
    return;
  }

  const child = o.child;
  machine.storeVariable(resultVar, child ? child.objnum : 0);
  machine.doBranch(child !== null, condfalse, offset);
}

/**
 * Gets the parent of an object.
 */
function get_parent(machine: ZMachine, obj: number): void {
  const resultVar = machine.readByte();
  machine.logger.debug(
    `${machine.op_pc.toString(16)} get_parent ${obj} -> (${resultVar})`
  );

  const o = machine.getObject(obj);
  if (o === null) {
    machine.logger.error("object null in get_parent");
    machine.storeVariable(resultVar, 0);
    return;
  }

  const parent_objnum = o.parent === null ? 0 : o.parent.objnum;
  machine.storeVariable(resultVar, parent_objnum);
}

/**
 * Removes an object from its parent.
 */
function remove_obj(machine: ZMachine, obj: number): void {
  machine.logger.debug(`${machine.op_pc.toString(16)} remove_obj ${obj}`);

  const o = machine.getObject(obj);
  if (o === null) {
    machine.logger.error("object null in remove_obj");
    return;
  }

  o.unlink();
}

/**
 * Sets a property value for an object.
 */
function put_prop(
  machine: ZMachine,
  obj: number,
  property: number,
  value: number
): void {
  machine.logger.debug(`put_prop ${obj} ${property} ${value}`);

  const o = machine.getObject(obj);
  if (o === null) {
    machine.logger.warn("put_prop called on null object");
    return;
  }

  o.putProperty(property, value);
}

/**
 * Gets the length of a property.
 */
function get_prop_len(machine: ZMachine, propDataAddr: number): void {
  const resultVar = machine.readByte();
  machine.logger.debug(
    `${machine.op_pc.toString(
      16
    )} get_prop_len ${propDataAddr} -> (${resultVar})`
  );

  const len = GameObject.getPropertyLength(machine.state, propDataAddr);
  machine.storeVariable(resultVar, len);
}

/**
 * Prints the name of an object.
 */
function print_obj(machine: ZMachine, obj: number): void {
  machine.logger.debug(`${machine.op_pc.toString(16)} print_obj ${obj}`);

  const o = machine.getObject(obj);
  if (o === null) {
    machine.logger.warn(`print_obj: object ${obj} not found`);
    return;
  }

  machine.screen.print(machine, o.name);
}

/**
 * Export all object manipulation opcodes
 */
export const objectOpcodes = {
  // 2OP opcodes
  jin: opcode("jin", jin),
  test_attr: opcode("test_attr", test_attr),
  set_attr: opcode("set_attr", set_attr),
  clear_attr: opcode("clear_attr", clear_attr),
  insert_obj: opcode("insert_obj", insert_obj),
  get_prop: opcode("get_prop", get_prop),
  get_prop_addr: opcode("get_prop_addr", get_prop_addr),
  get_next_prop: opcode("get_next_prop", get_next_prop),
  put_prop: opcode("put_prop", put_prop),

  // 1OP opcodes
  get_sibling: opcode("get_sibling", get_sibling),
  get_child: opcode("get_child", get_child),
  get_parent: opcode("get_parent", get_parent),
  remove_obj: opcode("remove_obj", remove_obj),
  print_obj: opcode("print_obj", print_obj),
  get_prop_len: opcode("get_prop_len", get_prop_len),
};
