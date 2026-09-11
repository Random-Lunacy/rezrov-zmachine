import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';
import sortClassMembers from 'eslint-plugin-sort-class-members';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default defineConfig([
  // '.vitest/' and 'html-report/' hold generated Vitest HTML reports (Vitest 5 writes
  // to '.vitest/' by default). Without these entries ESLint walks megabytes of bundled
  // report assets and appears to hang.
  globalIgnores([
    'prettier.config.cjs',
    '**/dist/',
    '**/node_modules/',
    '**/coverage/**',
    '**/tests/',
    '**/.vitest/**',
    '**/html-report/**',
  ]),
  {
    extends: compat.extends(
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:prettier/recommended'
    ),

    plugins: {
      '@typescript-eslint': typescriptEslint,
      prettier,
      'sort-class-members': sortClassMembers,
    },

    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },

    rules: {
      'prettier/prettier': 'error',
      'no-console': 'warn',
      'no-debugger': 'warn',
      'eol-last': ['error', 'always'],

      'sort-class-members/sort-class-members': [
        'error',
        {
          order: ['[static-properties]', '[static-methods]', '[properties]', 'constructor', '[methods]'],

          accessorPairPositioning: 'getThenSet',
        },
      ],

      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],

    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
]);
