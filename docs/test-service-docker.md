# Run flex-plugins e2e tests against locally running docker version of hrm-service

1. Build the docker contianer locally with: `npm run -w hrm-service docker:build`
2. Start the hrm db with: `npm run docker:compose:db:up`
3. Optionally run localstack for AWS resources with: `npm run localstack:init`
4. Bring up the hrm service container with: `npm run docker:compose:service:up`
5. Get logs from `npm run docker:compose:logs`
6. Run tests with: `npm run test:docker:service` - this is only tested on nix and requires aws-cli to be installed locally
