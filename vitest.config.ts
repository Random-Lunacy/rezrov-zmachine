// This is a Vitest configuration file that sets up the testing environment for a Node.js application.
// It specifies the use of global variables, the testing environment, the inclusion of test files, and coverage reporting options.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/examples/**',
        '**/tests/**',
        'eslint.config.mjs',
        'prettier.config.cjs',
        'vitest.config.ts',
      ],
    },
    testTimeout: 10000,
    reporters: ['default', 'html'],
    outputFile: {
      html: './coverage/test-report.html',
    },
  },
});
