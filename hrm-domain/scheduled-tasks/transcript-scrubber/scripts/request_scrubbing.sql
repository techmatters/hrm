-- Copyright (C) 2021-2023 Technology Matters
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU Affero General Public License as published
-- by the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
-- GNU Affero General Public License for more details.
--
-- You should have received a copy of the GNU Affero General Public License
-- along with this program.  If not, see https://www.gnu.org/licenses/.


-- A script to request scrubbing of transcripts for a given account and time period
-- This script will create a new 'scrub-transcript' job for each contact that has an S3 script transcript media item attached to it
-- You can specify a list of specific contact IDS for targeted queries, but the account SID, from date, and to date are still required
-- You can set the 'forceOverwrite' flag to true to create a new scrub job even if scrubbed transcript media already exists for the contact
-- You can set the 'skipContactsWithJobsAlreadyInProgress' flag to true to avoid creating duplicate jobs of those that are already in progress
-- Remember, only one scrubbed ConversationMedia item will be added per contact, if one already exists when a scrub transcript job completes it will overwrite the existing item
-- So don't worry about creating duplicate scrubbed transcript items by setting the flags incorrectly, they are primarily there to save unnecessary work.

WITH
-- These are the 'parameters' for the query, adjust as necessary
	  "accountSid" AS (VALUES('ACd8a2e89748318adf6ddff7df6948deaf')),
	  "fromDate" AS (VALUES('2024-08-01 00:00:00'::TIMESTAMP WITH TIME ZONE)),
	  "toDate" AS (VALUES('2025-01-01 00:00:00'::TIMESTAMP WITH TIME ZONE)),
	  "contactIds" AS (VALUES(ARRAY[]::integer[])), -- Set the array to empty to not restrict the query to certain contact IDs
	  "forceOverwrite" AS (VALUES(false)), -- Create a new scrub job even if scrubbed transcript media already exists for the contact
	  "skipContactsWithJobsAlreadyInProgress" AS (VALUES(false)) -- Set this to avoid creating a new contact job if there is already a scrub transcript job 'in progress', i.e. it is not marked completed and has been attempted less than the maximum number of times (20)
-- Comment this line out if you want to preview what will be added rather than actually performing the INSERT operation
INSERT INTO public."ContactJobs"("contactId", "accountSid", "jobType", "requested", "additionalPayload")
SELECT DISTINCT
	c.id AS "contactId",
	c."accountSid",
	'scrub-transcript' AS "jobType",
	CURRENT_DATE AS "requested",
	jsonb_build_object('originalLocation', cm."storeTypeSpecificData"->'location') as "additionalPayload"
FROM
"Contacts" AS c INNER JOIN
"ConversationMedias" AS cm ON cm."contactId" = c."id" AND cm."accountSid"=c."accountSid" LEFT JOIN
"ConversationMedias" AS "overwriteCm" ON "overwriteCm"."contactId" = c."id" AND "overwriteCm"."accountSid"=c."accountSid" AND "overwriteCm"."storeTypeSpecificData"->>'type'='scrubbed-transcript' LEFT JOIN
"ContactJobs" AS "cj" ON "cj"."contactId" = c."id" AND "cj"."accountSid"=c."accountSid" AND "cj"."jobType"='scrub-transcript' AND "cj"."completed" IS NULL AND cj."numberOfAttempts" < 20
WHERE
c."accountSid" = (TABLE "accountSid") AND
cm."storeType"='S3' AND
cm."storeTypeSpecificData"->>'type'='transcript' AND
cm."storeTypeSpecificData"->>'location' IS NOT NULL AND
((TABLE "forceOverwrite")=true OR "overwriteCm".id IS NULL) AND
((TABLE "skipContactsWithJobsAlreadyInProgress")=false OR "cj".id IS NULL) AND
(array_length((TABLE "contactIds"),1) IS NULL OR c.id=ANY((TABLE "contactIds")::integer[])) AND
c."timeOfContact" BETWEEN (TABLE "fromDate") AND (TABLE "toDate");