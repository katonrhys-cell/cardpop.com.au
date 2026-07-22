import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const alias = { '@': path.resolve(__dirname, '.') };
const extensions = ['.jsx', '.js', '.tsx', '.ts', '.json'];

// The self-hosted CI runner is a low-core MacBook Air. Vitest's default fork
// pool spawns one worker per CPU, which overwhelms the machine and produces
// "Failed to start forks worker" / "Timeout waiting for worker to respond"
// errors that fail the suite even though the tests themselves pass. Cap the
// worker count (override with VITEST_MAX_FORKS) so the pool stays within what
// the host can actually schedule. Defaults to half the cores, max 4.
const cpuCount =
  typeof os.availableParallelism === 'function'
    ? os.availableParallelism()
    : os.cpus().length;
const maxWorkers = Number(process.env.VITEST_MAX_FORKS) ||
  Math.max(1, Math.min(4, Math.floor(cpuCount / 2)));

export default defineConfig({
  test: {
    // Raised from the 5s default: under-resourced runners need headroom so
    // a slow-to-start worker doesn't trip a spurious timeout. Some page modules
    // (AddEditCardPage, LocalMapPage) have large imports that can take 15+ seconds.
    testTimeout: 30000,
    hookTimeout: 15000,
    // Vitest 4: pool sizing is top-level (poolOptions was removed).
    pool: 'forks',
    minWorkers: 1,
    maxWorkers,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'tools/**',
        'tests/**',
        'public/**',
        'styles/**',
        '*.config.*',
      ],
      // Regression floors, NOT targets. Set a few points below the current
      // aggregate coverage so `npm run test:coverage` (wired into CI) fails only
      // when a change meaningfully *drops* coverage — new untested code, or a
      // deleted test. Ratchet these upward as coverage improves; never lower
      // them to make a red build pass. Current (2026-07): ~53% stmts / 38%
      // branches / 43% funcs / 57% lines.
      thresholds: {
        statements: 48,
        branches: 33,
        functions: 38,
        lines: 50,
      },
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
