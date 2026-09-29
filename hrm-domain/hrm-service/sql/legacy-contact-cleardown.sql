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
-- taskIds listed in Step 1, plus any Profiles/Identifiers created by them.
--
-- Ordering warning: if a target Contact was ever linked to a Case, run this
-- only after both cases-unlink-only and cases-delete-only have finished.
-- Deleting the Contact first leaves cases-delete-only unable to re-verify it
-- (404). Step 0 aborts automatically if that ordering is violated.
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

-- STEP 0: Abort if any orphaned Case exists (account-wide; may be unrelated).
SELECT
  CASE WHEN COUNT(*) > 0
    THEN CAST('Found system-created Case(s) with zero linked Contacts: ' || string_agg(c.id::text, ', ') || '. Finish cases-delete-only first, or confirm these are unrelated.' AS integer)
    ELSE 0
  END
FROM "Cases" c
WHERE c."accountSid" = :'accountsid'
  AND c."createdBy" = 'system'
  AND NOT EXISTS (
    SELECT 1 FROM "Contacts" ct WHERE ct."caseId" = c.id AND ct."accountSid" = c."accountSid"
  );

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
-- so that alone doesn't mean a real person touched this Contact.
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

-- STEP 4: A Profile/Identifier is safe to delete only if every Contact that
-- has EVER referenced it is in THIS run's proceed set (not merely legacy:
-- a legacy Contact from a different run, or a real one, still excludes it).
DROP TABLE IF EXISTS pg_temp."cleardown_safe_profiles";
CREATE TEMPORARY TABLE "cleardown_safe_profiles" AS
SELECT DISTINCT p.id AS "profileId", p."accountSid"
FROM "Profiles" p
JOIN "cleardown_targets" ct ON ct."profileId" = p.id AND ct."accountSid" = p."accountSid"
WHERE ct.outcome = 'proceed'
  AND NOT EXISTS (
    SELECT 1 FROM "Contacts" c
    WHERE c."profileId" = p.id AND c."accountSid" = p."accountSid"
      AND NOT EXISTS (
        SELECT 1 FROM "cleardown_targets" ct2
        WHERE ct2.id = c.id AND ct2."accountSid" = c."accountSid" AND ct2.outcome = 'proceed'
      )
  )
  AND NOT EXISTS (
    SELECT 1 FROM "ProfilesToProfileFlags" ptpf
    WHERE ptpf."profileId" = p.id AND ptpf."accountSid" = p."accountSid"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "ProfileSections" ps
    WHERE ps."profileId" = p.id AND ps."accountSid" = p."accountSid"
  );

-- An Identifier can link to more than one Profile (ProfilesToIdentifiers is
-- many-to-many); quick check here.
DROP TABLE IF EXISTS pg_temp."cleardown_safe_identifiers";
CREATE TEMPORARY TABLE "cleardown_safe_identifiers" AS
SELECT DISTINCT i.id AS "identifierId", i."accountSid"
FROM "Identifiers" i
JOIN "cleardown_targets" ct ON ct."identifierId" = i.id AND ct."accountSid" = i."accountSid"
WHERE ct.outcome = 'proceed'
  AND NOT EXISTS (
    SELECT 1 FROM "Contacts" c
    WHERE c."identifierId" = i.id AND c."accountSid" = i."accountSid"
      AND NOT EXISTS (
        SELECT 1 FROM "cleardown_targets" ct2
        WHERE ct2.id = c.id AND ct2."accountSid" = c."accountSid" AND ct2.outcome = 'proceed'
      )
  )
  AND NOT EXISTS (
    SELECT 1 FROM "ProfilesToIdentifiers" pti
    WHERE pti."identifierId" = i.id AND pti."accountSid" = i."accountSid"
      AND NOT EXISTS (
        SELECT 1 FROM "cleardown_safe_profiles" csp
        WHERE csp."profileId" = pti."profileId" AND csp."accountSid" = pti."accountSid"
      )
  );

-- STEP 5: REVIEW THIS. These are the Profiles/Identifiers Step 7 will delete.
SELECT 'profile' AS kind, "profileId" AS id, "accountSid" FROM "cleardown_safe_profiles"
UNION ALL
SELECT 'identifier' AS kind, "identifierId" AS id, "accountSid" FROM "cleardown_safe_identifiers";

-- STEP 6: Delete the Contacts. Referrals/ConversationMedias cascade
-- automatically. ContactJobs/CSAMReports aren't pre-checked: the import
-- never creates rows there, so a failure here means one exists unexpectedly.
DELETE FROM "Contacts" c
USING "cleardown_targets" ct
WHERE c.id = ct.id AND c."accountSid" = ct."accountSid" AND ct.outcome = 'proceed';

-- STEP 7: Delete the now-safe Profiles/Identifiers. 
DELETE FROM "Profiles" p
USING "cleardown_safe_profiles" sp
WHERE p.id = sp."profileId" AND p."accountSid" = sp."accountSid";

DELETE FROM "Identifiers" i
USING "cleardown_safe_identifiers" si
WHERE i.id = si."identifierId" AND i."accountSid" = si."accountSid";

-- STEP 8: Final log of what was deleted, ids only.
SELECT 'contact' AS kind, id, "taskId" AS detail FROM "cleardown_targets" WHERE outcome = 'proceed'
UNION ALL
SELECT 'profile' AS kind, "profileId" AS id, NULL AS detail FROM "cleardown_safe_profiles"
UNION ALL
SELECT 'identifier' AS kind, "identifierId" AS id, NULL AS detail FROM "cleardown_safe_identifiers";

-- No COMMIT here on purpose; see header docs.
