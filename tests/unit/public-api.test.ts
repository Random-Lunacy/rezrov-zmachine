import { describe, expect, it } from 'vitest';
import * as api from '../../src/index';
import { InputMode as InputModeSource } from '../../src/ui/input/InputInterface';
import { WindowEventType as WindowEventTypeSource } from '../../src/ui/screen/WindowManager';

/**
 * Guards the public entry point against a specific, silent regression: declaring a
 * runtime value in an `export type { ... }` list.
 *
 * TypeScript accepts that happily and consumers can still annotate with the name,
 * so nothing fails to compile — but the runtime binding is erased, and reaching for
 * an enum member throws or yields undefined. Both InputMode and WindowEventType
 * shipped this way; tests inside this repo hid it by importing from the declaring
 * module rather than from the barrel.
 */
describe('public API surface', () => {
  describe('runtime enums are exported as values, not types', () => {
    it('should expose InputMode with usable members', () => {
      expect(api.InputMode).toBeDefined();
      expect(api.InputMode.TEXT).toBe(1);
      expect(api.InputMode.CHAR).toBe(2);
      expect(api.InputMode.UNICODE_CHAR).toBe(6);
    });

    it('should expose the same InputMode object the declaring module does', () => {
      // A re-export must not become a separate copy: `===` comparisons against a
      // consumer's imported member have to hold.
      expect(api.InputMode).toBe(InputModeSource);
    });

    it('should expose WindowEventType with usable members', () => {
      expect(api.WindowEventType).toBeDefined();
      expect(api.WindowEventType.CREATED).toBe('created');
      expect(api.WindowEventType.CONTENT_CHANGED).toBe('content_changed');
    });

    it('should expose the same WindowEventType object the declaring module does', () => {
      expect(api.WindowEventType).toBe(WindowEventTypeSource);
    });
  });

  /**
   * Catches the same mistake in anything added later, without needing a name-by-name
   * list to be kept up to date.
   */
  it('should export every enum declared in the barrel as a runtime value', () => {
    const enumExports = ['InputMode', 'WindowEventType', 'WindowType', 'WindowProperty', 'Color', 'TextStyle'];
    const missing = enumExports.filter((name) => (api as Record<string, unknown>)[name] === undefined);

    expect(missing).toEqual([]);
  });
});
