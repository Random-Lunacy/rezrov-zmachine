import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: [{ find: 'rezrov-zmachine', replacement: path.resolve(__dirname, '../../dist/index.js') }],
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
