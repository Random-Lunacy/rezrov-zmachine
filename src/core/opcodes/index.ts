import { mathOpcodes } from "./math";
import { objectOpcodes } from "./object";
import { stackOpcodes } from "./stack";
import { ioOpcodes } from "./io";

export const opcodes = {
  ...mathOpcodes,
  ...objectOpcodes,
  ...stackOpcodes,
  ...ioOpcodes,
};

export * from "./base";
