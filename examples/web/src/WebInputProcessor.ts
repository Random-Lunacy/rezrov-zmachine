import { BaseInputProcessor, InputState, Logger, ZMachine } from 'rezrov-zmachine';
import type { WebScreen } from './WebScreen';

export class WebInputProcessor extends BaseInputProcessor {
  private readonly logger: Logger;
  private readonly screen: WebScreen;
  private readonly inputEl: HTMLInputElement;
  private readonly textOutputEl: HTMLDivElement;
  private isWaitingForInput = false;
  private inputHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    screen: WebScreen,
    inputEl: HTMLInputElement,
    textOutputEl: HTMLDivElement,
    options?: { logger?: Logger }
  ) {
    super();
    this.logger = options?.logger || new Logger('WebInputProcessor');
    this.screen = screen;
    this.inputEl = inputEl;
    this.textOutputEl = textOutputEl;
  }

  protected doStartTextInput(machine: ZMachine, _state: InputState): void {
    this.logger.debug('Starting text input');
    this.isWaitingForInput = true;
    this.inputEl.value = '';
    this.inputEl.disabled = false;
    this.inputEl.style.visibility = 'visible';
    this.inputEl.focus();

    const handleSubmit = (e: KeyboardEvent): void => {
      e.preventDefault();
      if (!this.isWaitingForInput) return;

      const input = this.inputEl.value;
      this.inputEl.value = '';

      this.echoInput(input);
      this.isWaitingForInput = false;
      this.inputEl.disabled = true;

      const h = this.inputHandler;
      if (h) {
        this.inputEl.removeEventListener('keydown', h);
        this.inputHandler = null;
      }

      const termChar = this.processTerminatingCharacters(input);
      this.onInputComplete(machine, input, termChar);
    };

    const h = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSubmit(e);
      }
    };
    this.inputHandler = h;
    this.inputEl.addEventListener('keydown', h);
  }

  protected doStartCharInput(machine: ZMachine, _state: InputState): void {
    this.logger.debug('Starting char input');
    this.isWaitingForInput = true;
    this.inputEl.value = '';
    this.inputEl.disabled = false;
    this.inputEl.style.visibility = 'visible';
    this.inputEl.placeholder = '[press any key]';
    this.inputEl.focus();

    const handleKey = (e: KeyboardEvent): void => {
      if (!this.isWaitingForInput) return;

      e.preventDefault();
      e.stopPropagation();

      let key = '';
      const keyMap: Record<string, number> = {
        Enter: 13,
        Escape: 27,
        Backspace: 8,
        ArrowUp: 129,
        ArrowDown: 130,
        ArrowLeft: 131,
        ArrowRight: 132,
      };

      if (keyMap[e.key] !== undefined) {
        key = String.fromCharCode(keyMap[e.key]);
      } else if (e.key === ' ') {
        key = ' ';
      } else if (e.key.length === 1 && e.key.charCodeAt(0) >= 32) {
        key = e.key;
      }

      if (key !== '') {
        const h = this.inputHandler;
        if (h) {
          this.inputEl.removeEventListener('keydown', h);
          this.inputHandler = null;
        }
        this.inputEl.placeholder = '';
        this.inputEl.disabled = true;
        this.isWaitingForInput = false;

        this.onKeyPress(machine, key);
      }
    };

    this.inputHandler = handleKey;
    this.inputEl.addEventListener('keydown', handleKey);
  }

  cancelInput(machine: ZMachine): void {
    super.cancelInput(machine);
    if (this.inputHandler) {
      this.inputEl.removeEventListener('keydown', this.inputHandler);
      this.inputHandler = null;
    }
    this.isWaitingForInput = false;
    this.inputEl.disabled = true;
  }

  async promptForFilename(machine: ZMachine, operation: string): Promise<string> {
    const filename = window.prompt(`Enter filename for ${operation}:`, 'save.dat');
    return filename || 'save.dat';
  }

  private echoInput(input: string): void {
    const span = document.createElement('span');
    span.textContent = input + '\n';
    span.style.color = '#e0e0e0';
    this.textOutputEl.appendChild(span);
    this.textOutputEl.parentElement!.scrollTop = this.textOutputEl.parentElement!.scrollHeight;
  }
}
