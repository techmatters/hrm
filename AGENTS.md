# AGENTS.md

Guidance for coding agents working in this repository (the Aselo HRM backend monorepo).

## Repository layout

This is a single npm workspaces project rooted here (see `workspaces` in `package.json`);
run all commands below from the repository root unless stated otherwise.

| Directory | What it is |
| --- | --- |
| `hrm-domain/` | HRM service (`hrm-service`), core logic (`hrm-core`), lambdas, scheduled tasks and integration tests |
| `resources-domain/` | Resources service, its lambdas and packages |
| `packages/` | Shared libraries used across domains |
| `lambdas/` | Shared lambda packages, `job-complete`, and the `Dockerfile` used to build every lambda image |
| `cdk/` | CDK stacks used to stand up LocalStack for local development and tests |
| `test-support/` | Docker compose files and helpers for service / integration tests |
| `docs/` | Developer how-tos (debugging, local DB import, etc.) |

## Coding standards

Follow the Aselo coding standards at https://github.com/techmatters/aselo-coding-standards
when writing or reviewing code in this repository.

## Licence headers

All source files carry the AGPL licence header from `license-header.tpl`, with the holder
"Technology Matters". Add it to any new source file — copy the header from a neighbouring
file, keeping the same comment style. CI enforces this (see below).

## Secrets

This is a public repository. Never commit credentials, account SIDs, tokens or other
private data. The repo uses `git-secrets` hooks (`.githooks/`). Local env files downloaded
with `npm run ssm:local` are git-ignored — keep it that way.

## Validation before requesting a PR review

CI (`.github/workflows/hrm-ci.yml` and `check-license-header.yml`) runs on every push.
Before opening a PR or requesting a review, run the equivalent checks locally and fix
anything they raise. There is no need to run them after every individual edit.

Use Node 22 (`.nvmrc`). Steps 5–7 need Docker.

1. `npm ci` — install the workspace
2. `npm run build` — TypeScript must compile (`tsc -b` across all project references)
3. `npm run lint` — ESLint must be clean (`npm run lint:fix` to auto-fix)
4. `npm run test:unit` — unit tests must pass in every workspace
5. `npm run test:service` — service tests must pass. This starts Elasticsearch via
   `docker-compose.es.yml`, and each workspace with service tests brings up (and tears
   down) its own Postgres container, so ports 9200, 5433 and 5434 must be free. The
   beacon-poller service tests also run the HRM service from a local image, so build it
   first: `docker build -f hrm-domain/hrm-service/Dockerfile -t hrm-service .`
6. `npm run license:check` — every source file must carry the licence header
   (`npm run license:add` to fix)
7. If you changed a `Dockerfile`, dependencies, or the build of a lambda or the HRM
   service, CI also builds the Docker images. Check they still build:
   - HRM service: already built in step 5
   - A lambda (CI builds each one listed in the `build-lambda-containers` matrix of
     `hrm-ci.yml`), e.g. for `hrm-domain/lambdas/files-urls`:
     `docker build -f lambdas/Dockerfile --build-arg lambda_dir=hrm-domain/lambdas --build-arg lambda_name=files-urls .`

If any step fails, fix the problem and start again from step 2 until you get a clean run.

While iterating, you can scope tests to a single workspace, e.g.
`npm run test:unit -w hrm-domain/hrm-core` — but run the full set above before asking
for a review.

The HRM integration tests (`hrm-integration-test.yml`) are triggered manually and need
private registry credentials; they are not required before a review.

## Pull requests

Write PR descriptions using the template in
[`.github/pull_request_template.md`](.github/pull_request_template.md): keep all its
sections (Description, Checklist, Other Related Issues, Verification steps, AFTER YOU
MERGE), tick only the checklist items that actually apply, note any required migrations
under Verification steps, and put the primary issue key (e.g. `CHI-1234`) in the PR title.
