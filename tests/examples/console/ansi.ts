/**
 * SGR escape pairs chalk emits, so console-example assertions read as intent
 * rather than as escape soup.
 *
 * Deliberately hardcoded rather than built by calling chalk: a test file lives
 * under tests/, so `import chalk` here resolves to the root's chalk (4.x, a
 * transitive dep of patch-package) — a different instance and major from the
 * chalk 6 the example resolves from examples/console/node_modules. Asserting on
 * literals sidesteps that entirely, and is safe because these codes are
 * identical across chalk 4, 5 and 6 at any color level >= 1.
 *
 * Not named *.test.ts, so Vitest never collects it.
 */

export const SGR = {
  // Foreground
  black: ['\x1b[30m', '\x1b[39m'],
  red: ['\x1b[31m', '\x1b[39m'],
  green: ['\x1b[32m', '\x1b[39m'],
  yellow: ['\x1b[33m', '\x1b[39m'],
  blue: ['\x1b[34m', '\x1b[39m'],
  magenta: ['\x1b[35m', '\x1b[39m'],
  cyan: ['\x1b[36m', '\x1b[39m'],
  white: ['\x1b[37m', '\x1b[39m'],
  gray: ['\x1b[90m', '\x1b[39m'],
  // Background
  bgBlack: ['\x1b[40m', '\x1b[49m'],
  bgRed: ['\x1b[41m', '\x1b[49m'],
  bgGreen: ['\x1b[42m', '\x1b[49m'],
  bgYellow: ['\x1b[43m', '\x1b[49m'],
  bgBlue: ['\x1b[44m', '\x1b[49m'],
  bgMagenta: ['\x1b[45m', '\x1b[49m'],
  bgCyan: ['\x1b[46m', '\x1b[49m'],
  bgWhite: ['\x1b[47m', '\x1b[49m'],
  bgBlackBright: ['\x1b[100m', '\x1b[49m'],
  // Modifiers
  bold: ['\x1b[1m', '\x1b[22m'],
  italic: ['\x1b[3m', '\x1b[23m'],
  inverse: ['\x1b[7m', '\x1b[27m'],
} as const;

export type SgrName = keyof typeof SGR;

/**
 * Wrap `text` in the given styles, innermost first — matching how chalk nests
 * when its calls are applied in sequence.
 */
export function wrap(text: string, ...styles: SgrName[]): string {
  return styles.reduce((acc, name) => {
    const [open, close] = SGR[name];
    return `${open}${acc}${close}`;
  }, text);
}
