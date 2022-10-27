# hrm

[![Actions Status](https://github.com/tech-matters/hrm/workflows/hrm-ci/badge.svg)](https://github.com/tech-matters/hrm/actions)

The Helpline Relationship Management (HRM) system is the backend for the Aselo system. It is built as an Express/NodeJS REST API accessed by the [Aselo frontend](https://www.twilio.com/docs/flex/developer/plugins). See [aselo.org](https://aselo.org/) or [contact Aselo](https://aselo.org/contact-us/) for more information.

## git-secrets

In order to prevent sensitive credentials to be leaked, please follow this instructions to setup `git-secrets`.

- Install [git-secrets](https://github.com/awslabs/git-secrets) in your computer.
- Go into the repo root folder.
- Run `git secrets --register-aws`.
- Run `git config --local core.hooksPath .githooks/`.

## Local Development

### Requirements

[nvm](https://github.com/nvm-sh/nvm) or [nvm-windows](https://github.com/coreybutler/nvm-windows)
[docker](https://docs.docker.com/get-docker/)

### Initial setup

#### NVM (install/use)

Use nvm to ensure we use the same node/npm versions for each product. The first time you setup this repo (or if `nvm use` throws a missing version error), run `nvm install` to install the version of node specified in `.nvmrc`. Then run `nvm use` to switch to that version in the future. Without NVM: YMMV. `nvm-windows` does not support `.nvmrc`. Windows instructions are coming soon!

#### NPM Install

From the root directory run `npm ci`. This will install dependencies for all packages and manage their interdependencies for local development automatically using npm workspaces.

#### Compile Typescript

From the root directory run `npm run build`. This will compile all typescript files in the repo and output them to appropriate `dist` folders.

### Running tests

To run all tests across all of the monorepo packages, run `npm test` from the root directory.

There are several types of tests, (unit, service, e2e). These can be run using workspaces by running something like `npm run -w hrm-service test:unit` from the root directory. You can also run the tests by navigating into the package directory and running `npm run test:service`.

The primary test paths all do setup and teardown of required resources. This can add time to the test cycle. There are `:run` sub-scripts for tests that require setup and teardown like service and e2e tests. If you already have a test db docker container running, you can run these using workspaces by running something like `npm run -w hrm-service test:service:run` from the root directory. You can also run the tests by navigating into the package directory and running `npm run test:service:run`.

### Running HRM service locally

#### Starting HRM db

From the root directory run `npm run docker:compose:db:up`. This will start a docker container with a postgres database for the HRM service to use.

The HRM node service will update the schema to the latest version when you run it.

You can then populate the DB with valid, up-to-date data by running the `./hrm-service/sql/multi-tenant-sample-data.sql`, either with pgAdmin installed on your host, a CLI client running on the host, or the one running in the container

The db container created doesn't provide a volume on the host for storing data in persistently, meaning every time you restart it, it reverts to it's initial state.

This can be handy for some use cases like deterministic testing, but would get annoying for data to day dev. To allow your container to restart with the same data it had when it shut down, you should use `npm run docker:compose:db-persistent:up` instead.

#### Starting HRM service

This requires an `./hrm-service/dist/.env` file to be present. Contents of that file are outside the scope of this documentation currently.

You can run the full stack quickly by running `npm run build-and-start` from the root directory (after running `npm ci`). This will start the hrm-service and hrm-jobs packages.

Running hrm jobs requires a lot of extra time and local resources. If you are only working on core hrm-service features, you can just run the hrm-service portion of the stack by running `npm run build-and-start:service` from the root directory.

#### Redeploying jobs to localstack after code changes

If you modify a lambda job, you must redeploy with `npm run localstack:deploy` for localstack to pick up the changes. The `npm run test:e2e` script will do this for you, but will use the longer `localstack:init` script. For faster test running use `npm run localstack:deploy` and then `npm run test:e2e --workspaces --if-present`

#### Localstack (and all docker-compose) logs

Run `npm run docker:compose::logs` to tail logs from localstack, including output from lambda functions.

#### Destroy localstack and all docker containers

run `npm run docker:compose:down` to destroy the localstack and all docker based infrastructure running locally.

## Managing packages for sub modules

Package management is handled at the root level for sub modules. Since the package.lock is managed at the root level, you can't just run "npm add {package}" in a sub module. Instead, you must run "npm add {package} -w {sub module name}" from the root directory.

## Additional Documentation

- [Debugging Service Jest](./docs/debugging-service-jest.md)
- [Testing Service Docker Build](./docs/test-service-docker.md)
- [Import Dev Db to local postgres](./docs/import-dev-db-locally.md)
