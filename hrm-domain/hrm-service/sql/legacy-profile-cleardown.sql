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


-- CHI-4024: general-purpose clean-up of orphaned Profiles/Identifiers (zero
-- linked Contacts), for one account. Not tied to any specific Contact
-- clear-down run or batch, run this whenever, as many times as you like.
--
-- Why this is safe to run standalone: a Profile/Identifier with zero linked
-- Contacts has no value regardless of how it got that way (per PR #1155
-- review). A later re-import with the same identifier just recreates the
-- link via getOrCreateProfileWithIdentifier, it doesn't need the old row to
-- still exist. So you can run legacy-contact-cleardown.sql as many times as
-- needed first, and only run this afterward, once, when you're done.
--
-- Two ways to run the script:
--
-- Dry run/Review only (never deletes): run it as a normal -f script.
-- No COMMIT ever runs, so Postgres rolls it back on disconnect.
--   psql -v accountsid=<accountSid> -f legacy-profile-cleardown.sql <connection>
--
-- The real run: open psql interactively, then load this file from
-- inside that session so it doesn't disconnect at the end. Read the
-- "REVIEW THIS" output, then type COMMIT yourself (or ROLLBACK to cancel).
--   psql -v accountsid=<accountSid> <connection>
--   \i legacy-profile-cleardown.sql
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

-- STEP 1: Find every Profile with zero Contacts currently pointing to it.
DROP TABLE IF EXISTS pg_temp."cleardown_safe_profiles";
CREATE TEMPORARY TABLE "cleardown_safe_profiles" AS
SELECT p.id AS "profileId", p."accountSid"
FROM "Profiles" p
WHERE p."accountSid" = :'accountsid'
  AND NOT EXISTS (
    SELECT 1 FROM "Contacts" c
    WHERE c."profileId" = p.id AND c."accountSid" = p."accountSid"
  );

-- STEP 2: REVIEW THIS. These Profiles will be deleted below. has_flags/
-- has_sections are informational only, they don't exclude anything, just
-- flag a profile worth double-checking before it's gone.
SELECT
  sp."profileId" AS id,
  EXISTS (
    SELECT 1 FROM "ProfilesToProfileFlags" ptpf
    WHERE ptpf."profileId" = sp."profileId" AND ptpf."accountSid" = sp."accountSid"
  ) AS has_flags,
  EXISTS (
    SELECT 1 FROM "ProfileSections" ps
    WHERE ps."profileId" = sp."profileId" AND ps."accountSid" = sp."accountSid"
  ) AS has_sections
FROM "cleardown_safe_profiles" sp
ORDER BY id;

-- STEP 3: Find every Identifier with zero Contacts pointing to it directly,
-- where every Profile it's linked to (ProfilesToIdentifiers is many-to-one
-- in principle, even if nothing creates that today) is also in the safe set
-- above.
DROP TABLE IF EXISTS pg_temp."cleardown_safe_identifiers";
CREATE TEMPORARY TABLE "cleardown_safe_identifiers" AS
SELECT i.id AS "identifierId", i."accountSid"
FROM "Identifiers" i
WHERE i."accountSid" = :'accountsid'
  AND NOT EXISTS (
    SELECT 1 FROM "Contacts" c
    WHERE c."identifierId" = i.id AND c."accountSid" = i."accountSid"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "ProfilesToIdentifiers" pti
    WHERE pti."identifierId" = i.id AND pti."accountSid" = i."accountSid"
      AND NOT EXISTS (
        SELECT 1 FROM "cleardown_safe_profiles" csp
        WHERE csp."profileId" = pti."profileId" AND csp."accountSid" = pti."accountSid"
      )
  );

-- STEP 4: REVIEW THIS. These Identifiers will be deleted below.
SELECT "identifierId" AS id FROM "cleardown_safe_identifiers" ORDER BY id;

-- STEP 5: Delete the Profiles. ProfilesToIdentifiers/ProfilesToProfileFlags/
-- ProfileSections all cascade automatically.
DELETE FROM "Profiles" p
USING "cleardown_safe_profiles" sp
WHERE p.id = sp."profileId" AND p."accountSid" = sp."accountSid";

-- STEP 6: Delete the Identifiers. ProfilesToIdentifiers cascades.
DELETE FROM "Identifiers" i
USING "cleardown_safe_identifiers" si
WHERE i.id = si."identifierId" AND i."accountSid" = si."accountSid";

-- STEP 7: Final log of what was deleted, ids only.
SELECT 'profile' AS kind, "profileId" AS id FROM "cleardown_safe_profiles"
UNION ALL
SELECT 'identifier' AS kind, "identifierId" AS id FROM "cleardown_safe_identifiers";

-- No COMMIT here on purpose; see header docs.
