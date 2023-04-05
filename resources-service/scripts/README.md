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

## update-cloudsearch-domain

Build first, then run:
````bash
npm run build-scripts
npm run update-cloudsearch-domain
````

Single command:
````bash
npm run build-and-update-cloudsearch-domain
````

This script updates the CloudSearch domain with the latest resources from the Aselo resource database. It is intended to be run from the root directory of the resources-service package.

It performs the following steps:

1. Queries the Aselo resource database for resources with a updateSequenceNumber greater than the lastIndexedUpdateSequenceNumber in the Globals table.
2. Converts the resources into an AWS SDK search document object.
3. Adds the documents to a batch until adding any more would exceed the maximum batch size.
4. Uploads the batch to the CloudSearch domain.
5. Waits 10 seconds and then starts the next batch.
6. Continues until all the queried resources have been uploaded.

TODO: 
* Add an option to run the script in 'dry run' mode, which will not upload any documents to the CloudSearch domain.
* Add an option to update the lastIndexedUpdateSequenceNumber in the Globals table after the script has finished, so the same scripts aren't indexed again next time.

### Usage

The script takes no parameters.
Instead it reads the same environment variables as the resources-service for the database URL, username and password, as well as the cloudsearch domain search URL.
The script is uploading, not searching, but the AWS SDK takes the search URL and infers the upload URL from it, so that is what needs to be provided.