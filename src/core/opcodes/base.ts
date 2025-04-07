import { ZMachine } from '../../interpreter/ZMachine';

export type OpcodeFn = (machine: ZMachine, ...operands: Array<number>) => void;

export type Opcode = { 
  mnemonic: string; 
  impl: OpcodeFn 
};

export function opcode(mnemonic: string, impl: OpcodeFn): Opcode {
  return { mnemonic, impl };
}

export function unimplementedOpcode(mnemonic: string): Opcode {
  return opcode(mnemonic, () => {
    throw new Error(`Unimplemented opcode: ${mnemonic}`);
  });
}
