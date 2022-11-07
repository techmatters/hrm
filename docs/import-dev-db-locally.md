# Import development db from RDS

## Requirements

- Aselo VPN Access to development environment
- psql/pg_dump/pg_restore installed locally
- credentials for the development database

## Steps

1. Connect to the VPN

2. Run `pg_dump -U hrm -h development-postgres-rds.c9itqcbmhgxo.us-east-1.rds.amazonaws.com -W -F t hrmdb -f hrmdb.sql` to dump the database to a file after replacing the values in the angle brackets with the correct values.

3. Clear out the local db with: `psql -U rdsadmin -h 127.0.0.1 -d hrmdb -c "drop schema public cascade; create schema public;"`

4. Import the dev database with `pg_restore -U rdsadmin -h 127.0.0.1 -x -d hrmdb -1 hrmdb.sql`
