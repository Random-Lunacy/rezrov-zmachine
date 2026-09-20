import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // The web example imports the library by its published name, which in the
      // repo resolves through a `file:` link in examples/web/node_modules. CI
      // never installs that, so point the specifier at the TypeScript sources.
      { find: /^rezrov-zmachine$/, replacement: path.resolve(__dirname, 'src/index.ts') },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    // chalk samples the environment at import time and emits no escape codes
    // when stdout is not a TTY, which is every Vitest run. A *numeric*
    // FORCE_COLOR pins it to exactly level 1 (16 colors) and short-circuits the
    // branch that would otherwise report level 3 under GITHUB_ACTIONS, so the
    // console example's ANSI assertions are identical locally and in CI.
    // Safe globally: src/utils/log.ts colorizes from process.stdout.isTTY with
    // hardcoded escapes and never consults FORCE_COLOR or chalk.
    env: { FORCE_COLOR: '1' },
    include: ['tests/**/*.test.ts'],
    // Example tests opt into jsdom per file with a `@vitest-environment` docblock.
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/examples/**',
        '**/tests/**',
        'eslint.config.mjs',
        'prettier.config.cjs',
        'vitest.config.ts',
      ],
      thresholds: {
        global: {
          statements: 80,
          branches: 75,
          functions: 80,
          lines: 80,
        },
        // Core execution engine - must be rock solid
        'src/core/execution/Executor.ts': {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
        // Memory management - critical for VM correctness
        'src/core/memory/Memory.ts': {
          statements: 83,
          branches: 78,
          functions: 90,
          lines: 83,
        },
        // Currently implemented opcodes (V3/V5 focus)
        'src/core/opcodes/{math,memory,control,stack,string,call}.ts': {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
      },
    },
    testTimeout: 10000,
    reporters: ['default', 'html'],
    outputFile: {
      html: './html-report/test-report.html',
    },
  },
});
