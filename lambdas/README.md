# Lambda workers for hrm jobs

## Local Testing

### Initial setup

1. I strongly encourage the use of nvm to ensure consistent node versions across local dev envs ([\*nix](https://github.com/nvm-sh/nvm#installing-and-updating) or [Windows](https://github.com/coreybutler/nvm-windows)) use `nvm install` to install the version of node specified in `.nvmrc` the first time and `nvm use` to switch to that version in the future. Without NVM: YMMV.
2. run `npm ci` to install dependencies for lambda stack
3. run `npm run localstack:init` to setup all lambda dependencies and build the localstack infrastructure locally in docker.
4. run `npm run localstack:logs` to tail logs from localstack container

### Running tests

Run `npm run test` to run all tests. This will perform a full setup for localstack, so it will take a long time.

If localstack is already initialized, you can run `npm run test:localstack:e2e:quick` to run the e2e tests without re-initializing localstack.

Unit tests are currently tests inline with the code. They can be run with `npm run test:unit`.

Service tests are coming soon!

See options for individual tests in `package.json`

### Redeploying after code changes

If you modify a lambda, you have to redeploy with `npm run local:deploy` for localstack to pick up the changes.

### Destroy localstack

run `npm run docker:compose:down` to destroy the localstack infrastructure.
