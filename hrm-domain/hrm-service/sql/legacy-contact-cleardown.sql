-- Copyright (C) 2021-2026 Technology Matters
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


-- CHI-4024: clear-down for legacy iCarol-imported Contacts. Only touches
-- taskIds listed in Step 1. Does not touch Profiles/Identifiers at all, see
-- legacy-profile-cleardown.sql for that, a separate, standalone pass you can
-- run any time, independent of how many times you run this script.
--
-- Ordering warning: if a target Contact was ever linked to a Case, run this
-- only after both cases-unlink-only and cases-delete-only have finished.
-- Deleting the Contact first leaves cases-delete-only unable to re-verify it
-- (404). Step 0 aborts automatically if it detects this; pass
-- -v skip_case_guard=1 to proceed anyway once you've confirmed a flagged
-- Case is unrelated to this run.
--
-- Follow-up warning: search index is never notified.
-- Deleted contacts stay searchable until a manual reindex.
--
-- Two ways to run the script:
--
-- Dry run/Review only (never deletes): run it as a normal -f script.
-- No COMMIT ever runs, so Postgres rolls it back on disconnect.
--   psql -v accountsid=<accountSid> -f legacy-contact-cleardown.sql <connection>
--
-- The real run: open psql interactively, then load this file from
-- inside that session so it doesn't disconnect at the end. Read the
-- "REVIEW THIS" output, then type COMMIT yourself (or ROLLBACK to cancel).
--   psql -v accountsid=<accountSid> <connection>
--   \i legacy-contact-cleardown.sql
--   -- (review the output, then:)
--   COMMIT;

\set ON_ERROR_STOP on

-- Abort if no accountsid provided.
\if :{?accountsid}
\else
  \echo accountsid variable is not set. Run with -v accountsid=<accountSid>.
  \q
\endif

--ROLLBACK;
START TRANSACTION;

-- STEP 0: Abort if any system-created Case exists with zero linked Contacts.
-- That's only possible if an earlier cases-delete-only run didn't finish.
-- Account-wide, so a Case from unrelated tooling could trigger this; pass
-- -v skip_case_guard=1 once you've confirmed that's the case. skip_case_guard
-- defaults to false (guard runs) if never set, so =0/=false also runs it.
\if :{?skip_case_guard}
\else
  \set skip_case_guard false
\endif

\if :skip_case_guard
  \echo Skipping the orphaned-Case guard (skip_case_guard was set to a true value).
\else
  SELECT
    CASE WHEN COUNT(*) > 0
      THEN CAST('Found system-created Case(s) with zero linked Contacts: ' || string_agg(c.id::text, ', ') || '. Finish cases-delete-only first, or pass -v skip_case_guard=1 if unrelated.' AS integer)
      ELSE 0
    END
  FROM "Cases" c
  WHERE c."accountSid" = :'accountsid'
    AND c."createdBy" = 'system'
    AND NOT EXISTS (
      SELECT 1 FROM "Contacts" ct WHERE ct."caseId" = c.id AND ct."accountSid" = c."accountSid"
    );
\endif

-- Generate taskids.csv first from an audit log, e.g.:
--   aws s3 cp s3://<bucket>/icarol-import-audit-logs/<runId>.jsonl - | jq -r '.taskId' > taskids.csv

-- STEP 1: EDIT THIS PATH. Loads the bounded taskId list from a local file
-- (one taskId per line, no header), generated from the relevant run's S3
-- audit log.
DROP TABLE IF EXISTS pg_temp."cleardown_target_task_ids";
CREATE TEMPORARY TABLE "cleardown_target_task_ids" ("taskId" text);
\copy "cleardown_target_task_ids" FROM 'taskids.csv' WITH (FORMAT csv, HEADER false)

-- STEP 2: Sort each target into an outcome. 'proceed' is the only one that
-- gets deleted later. 'system' is included alongside createdBy because
-- cases-unlink-only's connectToCase call always sets updatedBy to 'system',
-- so that alone doesn't mean a real person touched this Contact. profileId/
-- identifierId are shown for reference only, this script never acts on them.
DROP TABLE IF EXISTS pg_temp."cleardown_targets";
CREATE TEMPORARY TABLE "cleardown_targets" AS
SELECT DISTINCT
  c.id,
  t."taskId",
  c."accountSid",
  c."caseId",
  c."profileId",
  c."identifierId",
  CASE
    WHEN c.id IS NULL THEN 'not-found'
    WHEN NOT starts_with(c."taskId", 'TK_legacy_') THEN 'not-legacy'
    WHEN c."caseId" IS NOT NULL THEN 'skipped-linked-to-case'
    WHEN c."updatedBy" IS DISTINCT FROM c."createdBy"
      AND c."updatedBy" IS DISTINCT FROM 'system' THEN 'skipped-touched-since-import'
    ELSE 'proceed'
  END AS outcome
FROM "cleardown_target_task_ids" t
LEFT JOIN "Contacts" c ON c."taskId" = t."taskId" AND c."accountSid" = :'accountsid';

-- STEP 3: REVIEW THIS. Anything not 'proceed' stays untouched below.
SELECT * FROM "cleardown_targets" ORDER BY outcome, id;

-- STEP 4: Delete the Contacts. Referrals/ConversationMedias cascade
-- automatically. ContactJobs/CSAMReports aren't pre-checked: the import
-- never creates rows there, so a failure here means one exists unexpectedly.
-- Any Profile/Identifier this orphans is left alone, see
-- legacy-profile-cleardown.sql.
DELETE FROM "Contacts" c
USING "cleardown_targets" ct
WHERE c.id = ct.id AND c."accountSid" = ct."accountSid" AND ct.outcome = 'proceed';

-- STEP 5: Final log of what was deleted, ids only.
SELECT id, "taskId" FROM "cleardown_targets" WHERE outcome = 'proceed';

-- No COMMIT here on purpose; see header docs.
