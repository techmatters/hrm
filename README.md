[![Actions Status](https://github.com/tech-matters/hrm/workflows/hrm-ci/badge.svg)](https://github.com/tech-matters/hrm/actions)
# hrm

The Helpline Relationship Management (HRM) system is the backend for the Aselo system.  It is built as an Express/NodeJS REST API accessed by the [Aselo frontend](https://www.twilio.com/docs/flex/developer/plugins).  See [aselo.org](https://aselo.org/) or [contact Aselo](https://aselo.org/contact-us/) for more information.

## git-secrets
In order to prevent sensitive credentials to be leaked, please follow this instructions to setup `git-secrets`.
- Install [git-secrets](https://github.com/awslabs/git-secrets) in your computer.
- Go into the repo root folder.
- Run `git secrets --register-aws`.
- Run `git config --local core.hooksPath .githooks/`.

## Running tests

The easiest way to run the tests locally is to run the test DB in docker.

Ensure you have the following environment variables set on the terminal session you want to run your tests from:
```
POSTGRES_PORT=5433
API_KEY='anything'
RUNNING_TEST=true
```

Then, in the HRM root, run

```shell
docker compose -f ./docker-compose-test.yml up -d
jest --verbose                                      # tests will run here 
docker compose -f ./docker-compose-test.yml down    # if you forget this, the DB will not be cleared down & be in a dirty state for the next run, which could make tests unstable
```

### Debugging SQL in test runs

If you want to debug the queries hitting the DB as part of the tests, you can use 2 terminal sessions.

In a new terminal session run:

```shell
docker compose -f ./docker-compose-test.yml up # don't use the '-d' flag!
```

Then in the original (with the environment variables set) session run

```shell
jest --verbose 
```

You should see all the SQL queries run by the tests logged out in the docker terminal.

After the run, Ctrl-C the docker compose session and run 
```shell
docker compose -f ./docker-compose-test.yml down
```
in any terminal window.