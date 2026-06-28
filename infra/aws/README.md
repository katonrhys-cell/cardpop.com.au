# CardPop — GitHub ↔ AWS integration

This wires GitHub Actions to AWS so CI/CD uses **short-lived OIDC credentials**
instead of long-lived secrets, reads its secrets from **SSM Parameter Store**,
and stores CI artifacts in **S3** instead of GitHub.

Everything is provisioned by one CloudFormation stack:
[`cloudformation/github-aws-integration.yml`](cloudformation/github-aws-integration.yml).

Region assumed throughout: **`ap-southeast-2` (Sydney)**. Change it consistently
in the workflows and the commands below if you use another region.

---

## What it creates

| Resource | Purpose |
|---|---|
| GitHub OIDC provider | Lets GitHub Actions assume an IAM role with no stored AWS keys |
| `cardpop-github-actions` role | Assumed by **GitHub-hosted** runners (deploy, snyk, e2e, lighthouse) |
| `cardpop-ec2-runner` role + instance profile | Identity for the **self-hosted EC2 runner** (optional) |
| `cardpop-ci-ssm-and-artifacts` policy | Shared: read `/cardpop/*` SSM secrets + read/write the artifacts bucket |
| `cardpop-ci-artifacts-<acct>-<region>` S3 bucket | CI artifacts, private, 30-day expiry |

---

## One-time bootstrap

### 1. Deploy the stack

```bash
aws cloudformation deploy \
  --template-file infra/aws/cloudformation/github-aws-integration.yml \
  --stack-name cardpop-github-aws \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-southeast-2 \
  --parameter-overrides GitHubOrg=katonrhys-cell GitHubRepo=cardpop.com.au
```

If the account **already has** a GitHub OIDC provider, add
`CreateOIDCProvider=false` (an account can only have one). If you don't want the
EC2 runner role, add `CreateEc2RunnerRole=false`.

Read the outputs you'll need:

```bash
aws cloudformation describe-stacks --stack-name cardpop-github-aws \
  --region ap-southeast-2 --query 'Stacks[0].Outputs' --output table
```

### 2. Put the secret values in SSM

These replace the GitHub Actions secrets. `SecureString` encrypts them with the
account's default `aws/ssm` KMS key (the policy already grants decrypt via SSM).

```bash
REGION=ap-southeast-2
aws ssm put-parameter --region $REGION --name /cardpop/vercel/token      --type SecureString --value 'YOUR_VERCEL_TOKEN'
aws ssm put-parameter --region $REGION --name /cardpop/vercel/org_id     --type String       --value 'YOUR_VERCEL_ORG_ID'
aws ssm put-parameter --region $REGION --name /cardpop/vercel/project_id --type String       --value 'YOUR_VERCEL_PROJECT_ID'
aws ssm put-parameter --region $REGION --name /cardpop/snyk/token        --type SecureString --value 'YOUR_SNYK_TOKEN'
```

(`org_id` / `project_id` aren't sensitive, so they're plain `String`. To update a
value later, append `--overwrite`.)

### 3. Set the GitHub repo variables

Settings → Secrets and variables → Actions → **Variables** (not Secrets):

| Variable | Value |
|---|---|
| `AWS_ROLE_ARN` | `GitHubActionsRoleArn` output from step 1 |
| `AWS_CI_ARTIFACTS_BUCKET` | `CiArtifactsBucketName` output from step 1 |

### 4. Cut over and clean up

After the first successful `main` deploy using SSM, delete the now-unused GitHub
secrets `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `SNYK_TOKEN`.

---

## Self-hosted EC2 runner — wiring & checklist

Your `deploy.yml` runs lint/test/build on `runs-on: self-hosted` (the EC2 box)
and the final `deploy` job on GitHub-hosted `ubuntu-latest`. So today **the EC2
runner needs no AWS credentials** — only the GitHub-hosted `deploy` job talks to
AWS, and it does so via OIDC.

What to verify on the runner so it stays healthy:

- **Trigger safety (most important).** `deploy.yml` only runs on `push` to `main`,
  so untrusted fork PRs never execute on your runner — keep it that way. Never add
  a `pull_request` trigger to a workflow that runs on `self-hosted` unless the
  runner is ephemeral and isolated. (`ci.yml`, `e2e.yml`, `snyk` deliberately stay
  on GitHub-hosted runners for this reason.)
- **AWS CLI present** — only required if you move an AWS step onto the runner (see
  below). `aws --version` should work for the runner's user.
- **Node 24 + npm** — `setup-node` handles the toolchain, but the box needs a base
  build environment (git, build-essential) for `npm ci`.
- **Run as a non-root service user**, auto-start via the runner's `svc.sh`, and keep
  the runner application updated.
- **Least privilege.** If you attach the instance profile below, the EC2 role grants
  *only* SSM read on `/cardpop/*` + the artifacts bucket — nothing else.

### Optional: attach the instance profile

The stack creates a `cardpop-ec2-runner` instance profile. Attaching it lets jobs
on the runner reach SSM/S3 through the instance's own identity (via IMDS) — no OIDC
needed for self-hosted jobs:

```bash
aws ec2 associate-iam-instance-profile \
  --region ap-southeast-2 \
  --instance-id i-xxxxxxxxxxxxxxxxx \
  --iam-instance-profile Name=cardpop-ec2-runner
```

Verify from on the box: `aws sts get-caller-identity` should show the
`cardpop-ec2-runner` role.

### Optional: move `deploy` onto the runner (drop OIDC + token entirely)

Because deploy only runs on `main`, you *can* move the `deploy` job to
`runs-on: self-hosted`. With the instance profile attached, the runner reads the
Vercel secrets straight from SSM via IMDS — you can then delete the
`Configure AWS credentials (OIDC)` step and the `id-token: write` permission from
that job. This trades GitHub-hosted minutes for a dependency on the single runner
being online. I left deploy on `ubuntu-latest` + OIDC by default since that's
where it runs today; say the word and I'll switch it.

---

## Cost

- **OIDC + SSM Parameter Store (Standard):** $0.
- **S3 artifacts:** a few MB/run, ~$0/month at this volume (30-day auto-expiry).
- **EC2 runner:** unchanged by this work — you already pay for that instance.

See the chat thread for the fuller cost breakdown.
