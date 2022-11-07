# Run flex-plugins e2e tests against locally running docker version of hrm-service

## Requirements

Working aws credentials with access to local ssm parameters configured in your terminal

_This probably doesn't work on windows yet_

## Steps

1. Build the docker container locally with: `npm run -w hrm-service docker:build`
2. Start the hrm db with: `npm run docker:compose:db:up`
3. Optionally run localstack for AWS resources with: `npm run localstack:init`
4. Bring up the hrm service container with: `npm run docker:compose:service:up`
5. Get logs from `npm run docker:compose:logs`
6. Follow the instructions for importing the current dev db into your local postgres server [here](./import-dev-db-locally.md).
7. In another terminal, follow the instructions in the flex-plugins/plugin-hrm-form to get the flex plugin running locally against the local docker service with the correct configuration files for e2e testing
8. Follow the instructions in the flex-plugins/e2e-tests readme to run the e2e tests locally
