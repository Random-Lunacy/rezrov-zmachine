import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: 'fs/promises', replacement: path.resolve(__dirname, 'src/shim-fs-promises.ts') },
      { find: 'fs', replacement: path.resolve(__dirname, 'src/shim-fs.ts') },
      { find: 'path', replacement: path.resolve(__dirname, 'src/shim-path.ts') },
      { find: 'node:path', replacement: path.resolve(__dirname, 'src/shim-path.ts') },
      { find: 'glob', replacement: path.resolve(__dirname, 'src/shim-glob.ts') },
      { find: 'node:url', replacement: 'url' },
      { find: 'node:fs', replacement: path.resolve(__dirname, 'src/shim-fs.ts') },
      { find: 'node:fs/promises', replacement: path.resolve(__dirname, 'src/shim-fs-promises.ts') },
      { find: 'node:events', replacement: 'events' },
      { find: 'node:stream', replacement: 'stream-browserify' },
      { find: 'node:string_decoder', replacement: 'string_decoder' },
      { find: 'rezrov-zmachine', replacement: path.resolve(__dirname, '../../dist/index.js') },
    ],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      external: [],
    },
  },
  optimizeDeps: {
    include: ['buffer'],
  },
  define: {
    'process.stdout.isTTY': 'false',
    global: 'globalThis',
  },
});
