import { Memory } from "../core/memory/Memory";
import { Address } from "../types";
import { Logger } from "../utils/log";

export class Dictionary {
  private memory: Memory;
  private logger: Logger;
  private dictAddr: Address;
  private separators: Array<number>;

  constructor(memory: Memory, logger: Logger, dictAddr: Address) {
    this.memory = memory;
    this.logger = logger;
    this.dictAddr = dictAddr;

    // Read separators from dictionary
    this.separators = this.readSeparators();
  }

  private readSeparators(): Array<number> {
    // Read separator characters from the dictionary
    return [];
  }

  // Dictionary operations will go here
}
