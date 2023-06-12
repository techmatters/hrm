# Resource Scripts

A set of utility scripts to maintain the resources service & associated data

## ElasticSearch

### reindexResources

````bash
npm run reindexResources [-- [--environment <environment>] [--accountSid <accountSid>] [--to <to>] [--from <from>] [--resourceId <resourceId> ...] [--verbose]]
````

This script kicks off a reindex of the ElasticSearch resources index, taking resources from the database and uploading them to the ElasticSearch index.

It performs the following steps:
1. Determines the private IP of one of the HRM ECS tasks.
2. Loads the correct static key from S3 to call the endpoint
3. Calls the internal HRM endpoint to kick off the reindex.
4. Returns the result of the reindex.


### Usage

Prerequisites:

* You need to be on the VPN for the correct region / environment to run this script.
* Your VPN connection needs to be associated with the private subnet (either AZ).
* You need to have your AWS credentials set up correctly in your environment, including the correct region.

Arguments:
--environment / -e: The environment to run the reindex on. Defaults to 'development'.
--accountSid / -a: Specify this to limit the scope of the reindex to a single account. If you are specifying any resource IDs, you must also specify an accountSid. This is because the resource IDs are only unique within an account.
--resourceId / -r: Use this to specify individual resources you want to reindex. Can be specified multiple times. An accountSid must also be specified.
--from / -f: Specify this to limit the scope of the reindex to resources created after this date. Must be in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ). Can be used in conjunction with --accountSid to reindex a single account, or to reindex resources created after a certain date across all accounts.
--to / -t: Specify this to limit the scope of the reindex to resources created before this date. Must be in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ). Can be used in conjunction with --accountSid to reindex a single account, or to reindex resources created before a certain date across all accounts.
--verbose / -v: Specify this to get the ID of every resource indexed, and the ID and error details of every resource that failed to index.
