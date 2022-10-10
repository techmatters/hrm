# Lambda workers for hrm jobs

## Local Testing

### Initial setup

1. I strongly encourage the use of nvm to ensure consistent node versions across local dev envs ([\*nix](https://github.com/nvm-sh/nvm#installing-and-updating) or [Windows](https://github.com/coreybutler/nvm-windows)) use `nvm install` to install the version of node specified in `.nvmrc` the first time and `nvm use` to switch to that version in the future. Without NVM: YMMV.
2. run `npm ci` to install dependencies for lambda stack

### Running tests

Run `npm run test` to run all tests. This will perform a full setup for localstack, so it will take a long time.

If localstack is already initialized, you can run `npm run test:localstack:e2e:quick` to run the e2e tests without re-initializing localstack.

Unit tests are currently inline with the code. They can be run with `npm run test:unit`.

Service tests are coming soon assuming there aren't any changes to the way we manage localstack!

See options for individual tests in `package.json`

### Localstack logs

Run `npm run localstack:logs` to tail logs from localstack, including output from lambda functions.

### Redeploying after code changes

If you modify a lambda, you must redeploy with `npm run local:deploy` for localstack to pick up the changes.

If you modify a library, you must run the `compile` npm script and then `local:deploy` to pick up the changes.

### Destroy localstack

run `npm run docker:compose:down` to destroy the localstack infrastructure.
