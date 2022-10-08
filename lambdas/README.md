# Lambda workers for hrm jobs

## Local Testing

### Initial setup

1. I strongly encourage the use of nvm to ensure consistent node versions across local dev envs ([\*nix](https://github.com/nvm-sh/nvm#installing-and-updating) or [Windows](https://github.com/coreybutler/nvm-windows)) use `nvm install` to install the version of node specified in `.nvmrc` the first time and `nvm use` to switch to that version in the future. Without NVM: YMMV.
2. run `npm ci` to install dependencies for lambda stack
3. run `npm run local:init` to setup all lambda dependencies and build the localstack infrastructure locally in docker. This will begin streaming localstack logs when complete.

### Running tests

run `npm run test` to run all tests

Note: currently this will just inject some messages into the individual queues so you can review output. This will be updated to run tests against the lambda functions in the future.

See options for individual tests in `package.json`

### Redeploying after code changes

If you modify a lambda, you have to redeploy with `npm run local:deploy` for localstack to pick up the changes.

### Destroy localstack

run `npm run docker:compose:down` to destroy the localstack infrastructure.
