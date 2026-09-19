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
