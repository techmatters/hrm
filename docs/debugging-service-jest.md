# Debugging SQL in test runs

- this may be outdated

If you want to debug the queries hitting the DB as part of the tests, you can use 2 terminal sessions.

```shell
docker compose -f ./test-support/docker-compose-service-test.yml up # don't use the '-d' flag!
```

Then in the original (with the environment variables set) session run

```shell
jest --verbose
```

You should see all the SQL queries run by the tests logged out in the docker terminal.

After the run, Ctrl-C the docker compose session and run

```shell
docker compose -f ./test-support/docker-compose-service-test down
```
