# Resource Scripts

A set of utility scripts to maintain the resources service & associated data

## import-khp-json

Build first, then run:
````bash
npm run build-scripts
npm run import-khp-json ACxxx [-- --only-generate-sql]
````

Single command:
````bash
npm run build-and-import-khp-json ACxxx [-- --only-generate-sql]
````

This script imports resources into the Aselo resource database from a JSON file. It is intended to be run from the root directory of the resources-service package.

It performs the following steps:
1. Parses a JSON file formatted to the same specification as the responses from the KHP resource import API
2. Converts it into a universal format for importing resources into the Aselo resources service.
3. Generates a set of SQL statements to insert the resources into the database.
4. Runs the generated SQL statements against the target database.

All the intermediate steps are written out to the resource-json directory, the transformed 'aselo' format and all the SQL are there for you to inspect.

### Usage

Currently, the script is hardcoded to read the input from `./resource-json/khp-sample.json` and write the output to the same directory. This is an obvious area for possible improvement in the future.

The script has one mandatory argument, the SID of the Twilio account to import resources for. This argument must be first (see example above).

It also has one optional argument, `--only-generate-sql`, which will cause the script to skip the final step of running the generated SQL statements against the target database. You can then take these scripts and run them manually in pgAdmin or similar, they will run against any database with a valid resources schema.