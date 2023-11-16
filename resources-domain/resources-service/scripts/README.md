# Resource Scripts

A set of utility scripts to maintain the resources service & associated data

## ElasticSearch

### reindexResources

````bash
npm run reindex [-- [--environment <environment>] [--accountSid <accountSid>] [--to <to>] [--from <from>] [--resourceId <resourceId> ...] [--verbose]]
````

This script kicks off a reindex of the ElasticSearch resources index, taking resources from the database and uploading them to the ElasticSearch index.

It performs the following steps:
1. Determines the private IP of one of the HRM ECS tasks.
2. Loads the correct static key from S3 to call the endpoint
3. Calls the internal HRM endpoint to kick off the reindex.
4. Returns the result of the reindex.


### Usage

Prerequisites:

#### Running Locally

* You need to have MFA authenticated credentials available on your CLI so your account can assume roles (this is a difficult process so using the devops box as instructed below might be preferable)
* You need to be on the management VPN (or the correct eu-west-1 environment VPN) to run this script.
* [eu-west-1 only] Your VPN connection needs to be associated with the private subnet (either AZ).

#### Running on the DevOps box

* SSH into the devops box
* Ensure you have the HRM source tree checked out.
* In the root of the source tree run:
````bash
docker run -it --rm --name reindex-resources --env AWS_REGION=us-east-1 -v "$PWD":/usr/src/app -w /usr/src/app node:18-slim npm install
docker run -it --rm --name reindex-resources --env AWS_REGION=us-east-1 -v "$PWD":/usr/src/app -w /usr/src/app node:18-slim npm run build
docker run -it --rm --name reindex-resources --env AWS_REGION=us-east-1 -v "$PWD":/usr/src/app -w /usr/src/app node:18-slim node ./node_modules/@tech-matters/resources-service/scripts-dist/scripts/elasticsearch/reindexResources.js [...args]
````

Arguments:
--environment / -e: The environment to run the reindex on. Defaults to 'development'.
--accountSid / -a: Specify this to limit the scope of the reindex to a single account. If you are specifying any resource IDs, you must also specify an accountSid. This is because the resource IDs are only unique within an account.
--resourceId / -r: Use this to specify individual resources you want to reindex. Can be specified multiple times. An accountSid must also be specified.
--from / -f: Specify this to limit the scope of the reindex to resources created after this date. Must be in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ). Can be used in conjunction with --accountSid to reindex a single account, or to reindex resources created after a certain date across all accounts.
--to / -t: Specify this to limit the scope of the reindex to resources created before this date. Must be in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ). Can be used in conjunction with --accountSid to reindex a single account, or to reindex resources created before a certain date across all accounts.
--verbose / -v: Specify this to get the ID of every resource indexed, and the ID and error details of every resource that failed to index.

