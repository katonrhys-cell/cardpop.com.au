# Self-hosted CI runner

The PR gate (`ci.yml`: lint + tests + build, ~4 minutes) and the Playwright
run (`e2e.yml`, ~10 minutes) are where the GitHub Actions minutes go. A private
repository bills every run a whole metered minute, the allowance is 2,000 a
month, and it ran out once on 2026-10-31 — which stopped *every* workflow,
including the Supabase migration push. Jobs on a **self-hosted runner** bill
nothing, so those two workflows run on a small Vultr box of our own, and the
hosted minutes are kept for the tiny jobs that must not depend on it.

| Workflow | Runs on | Why |
|---|---|---|
| `ci.yml` (verify) | self-hosted when `CI_RUNS_ON` is set | the big spender; every PR |
| `e2e.yml` | self-hosted when `CI_RUNS_ON` is set | the biggest spender; non-draft PRs |
| `deploy.yml`, `supabase-migrations.yml`, `migration-drift.yml`, `git-backup.yml`, `merchant-listings-check.yml`, `snyk-security.yml` | GitHub-hosted | seconds each, ~90 min/month in total; production deploys and the schema safety net must keep working when the CI box is down |

**The switch is one repository variable, not a code change.** Both heavy
workflows declare

```yaml
runs-on: ${{ fromJSON(vars.CI_RUNS_ON || '["ubuntu-latest"]') }}
```

so with the `CI_RUNS_ON` variable set to the runner's label list they run on
the box, and with the variable deleted they fall back to GitHub-hosted runners
instantly. If the box is ever down (a queued job waits for a runner and fails
after 24 hours), delete the variable, merge what you need, and set it again.

## The box

- **Separate from production.** CI executes pull-request code. It must never
  share a machine with the site, Stripe webhooks or the `.env`. One **Vultr
  Regular 2 vCPU / 4 GB** (~US$12–24/month) is right: the Vite build peaks at
  2–3 GB and Playwright runs Chromium; on 2 GB the setup script adds swap and
  the jobs are slower. 1 vCPU works but doubles the E2E time.
- **One runner, one job at a time.** `verify` and `e2e` on the same PR queue
  behind each other instead of racing for the box's memory. Register a second
  runner (run the script again with another `RUNNER_NAME`) only on an 8 GB box.
- **Persistent, not ephemeral.** The runner keeps its work directory and the
  npm cache between jobs, which is what makes `npm ci` fast. The trade-off is
  that a job could leave state behind for the next; acceptable for a
  single-maintainer private repository where only collaborators' PRs run.
  `/etc/cron.weekly/cardpop-runner-tidy` clears the temp area weekly.
- **Outbound only.** The firewall allows SSH in and nothing else; the runner
  long-polls GitHub, so no inbound port is needed.

## Provision (once)

1. Create the VPS: Ubuntu 24.04, Sydney (same as the site, but it could be
   anywhere), with your SSH key.
2. Get a **registration token**: repository → Settings → Actions → Runners →
   *New self-hosted runner* → Linux. Copy the value after `--token`. It is
   valid for one hour and is exchanged for the runner's own credential during
   setup; nothing to store afterwards.
3. Bootstrap as root (`ADMIN_IP` optional, locks SSH to that address):

   ```bash
   scp deploy/setup-runner.sh root@<runner-ip>:
   ssh root@<runner-ip> 'RUNNER_TOKEN=<token> ADMIN_IP=<your-ip> bash setup-runner.sh'
   ```

   It installs Node 24, Playwright's Chromium system libraries, the AWS CLI
   (the E2E job uploads its report to S3 on failure), adds swap under 4 GB,
   creates the unprivileged `runner` user, downloads the latest
   `actions/runner` release (checksum-verified against the release notes),
   registers it with the labels `self-hosted, linux, x64, cardpop-ci`, and runs
   it as a systemd service. The runner should show **Idle** on the Runners page.
4. **Flip the switch**: Settings → Secrets and variables → Actions →
   **Variables** → New repository variable:

   ```
   Name:  CI_RUNS_ON
   Value: ["self-hosted","linux","x64","cardpop-ci"]
   ```

5. Open or re-run any PR. The job's log header names the runner; the
   Actions → Usage page stops counting minutes for `verify` and `e2e`.

## Day to day

- **Logs**: `journalctl -u 'actions.runner.*' -f` on the box; per-job logs are
  in the Actions UI as usual.
- **Updates**: the runner updates itself when GitHub releases a new version;
  `unattended-upgrades` patches the OS. Reboot monthly or when
  `/var/run/reboot-required` appears; the service is enabled and comes back.
- **Node version**: `actions/setup-node` still installs the version the
  workflow asks for into its own tool cache, so the box's system Node (used
  by the Playwright and runner tooling) doesn't have to track `.nvmrc`.
- **Disk**: `du -sh /opt/actions-runner/_work ~runner/.npm /root/.cache`. The
  weekly cron trims temp files and verifies the npm cache; `rm -rf
  /opt/actions-runner/_work/<repo>` is safe when the runner is idle.
- **Re-registering** (new repo URL, lost registration): get a fresh token and
  run the script again — `config.sh --replace` re-registers under the same name.
- **Removing** the runner: `cd /opt/actions-runner && sudo ./svc.sh stop &&
  sudo ./svc.sh uninstall && sudo -u runner ./config.sh remove --token <token>`
  (a removal token from the Runners page), then destroy the VPS and delete the
  `CI_RUNS_ON` variable so the workflows go back to hosted runners.

## What the workflows assume about the box

- Chromium's **system libraries are pre-installed** (`playwright install-deps`
  at setup), so `e2e.yml` installs only the browser binary there; on hosted
  runners it still runs `--with-deps`. The two steps are selected with
  `runner.environment`.
- **No sudo** is granted to the `runner` user. A workflow step that needs root
  on the box is a setup-script change, not a workflow change.
- `aws` is on the path for the failure-report upload; the OIDC role is the
  same `AWS_ROLE_ARN` repository variable as before (self-hosted runners mint
  the same `id-token`).

`tests/backend/workflowRunners.test.js` checks that the two heavy workflows
use the variable switch with a hosted fallback and that the deploy and
migration workflows stay on GitHub-hosted runners.
