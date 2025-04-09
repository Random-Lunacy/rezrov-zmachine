import { ZMachine } from "../../interpreter/ZMachine";
import { Screen } from "../screen/interfaces";

export type InputState = {
  keyPress: boolean;
  resultVar: number;
  textBuffer?: number;
  parseBuffer?: number;
  time?: unknown;
  routine?: unknown;
};

export class InputHandler {
  private machine: ZMachine;
  private screen: Screen;

  constructor(machine: ZMachine, screen: Screen) {
    this.machine = machine;
    this.screen = screen;
  }

  handleInput(inputState: InputState): void {
    // Input handling logic will go here
  }

  // Additional input handling methods will go here
}
