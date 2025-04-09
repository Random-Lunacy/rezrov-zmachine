import { ZMachine } from "../interpreter/ZMachine";

export function hex(v: number): string {
  return v !== undefined ? v.toString(16) : "";
}

export function dumpHeader(machine: ZMachine): void {
  // Header dumping logic will go here
}

export function dumpObjectTable(machine: ZMachine): void {
  // Object table dumping logic will go here
}

export function dumpDictionary(machine: ZMachine): void {
  // Dictionary dumping logic will go here
}

export function dumpParsebuffer(machine: ZMachine, parsebuffer: number): void {
  // Parse buffer dumping logic will go here
}
