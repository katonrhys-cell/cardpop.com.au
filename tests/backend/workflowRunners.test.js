import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

// Which workflows run on the self-hosted CI runner (docs/ci-runner.md):
// the PR gate (which also runs the E2E) is selected by the CI_RUNS_ON repository variable
// with a GitHub-hosted fallback, and the production/schema jobs stay hosted
// so a dead CI box can never block a deploy or the migration safety net.

const dir = path.resolve(__dirname, '../../.github/workflows');
const load = (file) => yaml.load(readFileSync(path.join(dir, file), 'utf8'));
const runsOn = (file) => Object.values(load(file).jobs).map((job) => job['runs-on']);

const VARIABLE_SWITCH = "${{ fromJSON(vars.CI_RUNS_ON || '[\"ubuntu-latest\"]') }}";

describe('workflow runners', () => {
  it('runs the PR gate (lint, tests, build, E2E) on the self-hosted runner when CI_RUNS_ON is set, hosted otherwise', () => {
    for (const value of runsOn('ci.yml')) expect(value).toBe(VARIABLE_SWITCH);
  });

  it('keeps the deploy and schema workflows on GitHub-hosted runners', () => {
    for (const file of ['deploy.yml', 'supabase-migrations.yml', 'migration-drift.yml']) {
      for (const value of runsOn(file)) expect(value, file).toBe('ubuntu-latest');
    }
  });

  it('never hard-codes a self-hosted label (the variable is the only switch)', () => {
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.yml'))) {
      const text = readFileSync(path.join(dir, file), 'utf8');
      expect(text, file).not.toMatch(/runs-on:\s*\[?\s*["']?self-hosted/);
    }
  });

  it('installs the Playwright browser without sudo on the self-hosted box', () => {
    const steps = load('ci.yml').jobs.verify.steps;
    const hosted = steps.find((s) => s.name === 'Install Playwright Chromium');
    const self = steps.find((s) => s.name === 'Install Playwright Chromium (self-hosted)');
    expect(hosted.if).toBe("env.E2E == 'true' && runner.environment == 'github-hosted'");
    expect(hosted.run).toContain('--with-deps');
    expect(self.if).toBe("env.E2E == 'true' && runner.environment == 'self-hosted'");
    expect(self.run).not.toContain('--with-deps');
    expect(self.run).not.toContain('sudo');
    // The hosted-runner apt cleanup needs sudo, so it must not run on the box.
    const apt = steps.find((s) => s.name === 'Remove broken Microsoft apt repos');
    expect(apt.if).toContain("runner.environment == 'github-hosted'");
  });
});
