# Running a local DB with Docker

- this is possibly outdated, see top level documentation

As an alternative to installing Postgres on your local workstation, you can use postgres docker containers for local development

This has a couple of advantages:

- Less locally installed dependencies - all you need locally is Docker (which most devs need)
- Changing Postgres version is simple, just run a different image, instead of having to run multiple local versions
- You are always running Linux Postgres, so any differences between the Linux version we deploy with and MacOS / Windows builds will not affect local dev

This directory comes with a docker-compose.yml that will run a Postgres container and deploy the HRM schema (and create the required users) on port 5432

Linux users can run the container standalone with a host network, but on Mac or Windows, use the docker compose file to take care of the networking jiggerypokery required to allow stuff running on the host to connect into it

Just run these commands in this directory (i.e /docker-database/ ):

```
docker compose build
docker compose up
```

The HRM node service will update the schema to the latest version when you run it.

You can then populate the DB with data valid, up-to-date data by running the `/sql/multi-tenant-sample-data.sql`, either with pgAdmin installed on your host, a CLI client running on the host, or the one running in the container

## Persisting Data

The current `docker-compose.yml` doesn't provide a volume on the host for storing data in persistently, meaning every time you restart it, it reverts to it's initial state.

This can be handy for some use cases like deterministic testing, but would get annoying for data to day dev. To allow your container to restart with the same data it had when it shut down, you should use `docker-compose-persistent.yml` instead, i.e.

```
docker compose -f ./docker-compose-persistent.yml build
docker compose -f ./docker-compose-persistent.yml up
```
