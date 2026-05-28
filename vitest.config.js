import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const alias = { '@': path.resolve(__dirname, '.') };
const extensions = ['.jsx', '.js', '.tsx', '.ts', '.json'];

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'pb_migrations/**',
        'pb_hooks/**',
        'tools/**',
        'plugins/**',
        'tests/**',
        'public/**',
        'styles/**',
        '*.config.*',
      ],
    },
    projects: [
      {
        // Frontend tests — React components, hooks, client utils
        plugins: [react()],
        resolve: { alias, extensions },
        test: {
          name: 'frontend',
          include: ['tests/frontend/**/*.test.{js,jsx}'],
          environment: 'happy-dom',
          globals: true,
          setupFiles: ['./tests/setup.js'],
        },
      },
      {
        // Backend tests — Express routes and server utilities
        resolve: { alias, extensions },
        test: {
          name: 'backend',
          include: ['tests/backend/**/*.test.js'],
          environment: 'node',
          globals: true,
          setupFiles: ['./tests/backend/setup.js'],
        },
      },
    ],
  },
});
