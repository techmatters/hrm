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

ALTER TABLE public."Contacts"
      DROP COLUMN IF EXISTS "finalizedAt";

DELETE
	FROM public."SequelizeMeta" WHERE "name" LIKE '20231010145200%';

DROP INDEX IF EXISTS public."Contacts_taskId_accountSid_idx";

DELETE
	FROM public."SequelizeMeta" WHERE "name" LIKE '20231006%';

UPDATE "Contacts" cupdate SET "rawJson" = ((COALESCE("rawJson", '{}'::JSONB)
      -- Case Information and / or category patch
      || jsonb_build_object('caseInformation',  "rawJson"->'caseInformation' || jsonb_build_object('categories', "contactCategoryMaps"."categoryMap"))
    ) - 'categories') FROM
        (
          -- Convert the full expansion to the
          -- Probably a less verbose way to do this, but it is a one off migration, so meh.
          SELECT
          id AS "contactId", "accountSid", jsonb_object_agg(category, subcategories) AS "categoryMap"
          FROM (
            SELECT
            id, "accountSid", category, jsonb_object_agg(subcategory, subcategoryFlag) as subcategories
            FROM
            (
              SELECT
              id, "accountSid",
              category,
              subcategoryRecord AS subcategory,
              true AS subcategoryFlag
              FROM
              (
                SELECT
                id, "accountSid",
                (category).key AS category,
                jsonb_array_elements_text((category).value) AS subcategoryRecord
                FROM
                (
                  SELECT
                  id, "accountSid",
                  jsonb_each("rawJson"->'categories') as category
                  FROM "Contacts"
                ) AS expansion1
              ) AS expansion2
            )
            AS expansion3
            GROUP BY id, "accountSid", category
          )
          AS recompact
          GROUP BY id, "accountSid"
        ) AS "contactCategoryMaps"
WHERE "contactCategoryMaps"."contactId" = cupdate.id AND "contactCategoryMaps"."accountSid" = cupdate."accountSid";

DELETE
	FROM public."SequelizeMeta" WHERE "name" LIKE '20230926114100%';

UPDATE "Contacts" SET "rawJson" = COALESCE("rawJson", '{}'::JSONB)
      -- Case Information and placeholder case summary
      || jsonb_build_object('caseInformation',  "rawJson"->'caseInformation' || jsonb_build_object('callSummary', COALESCE("rawJson"->'caseInformation'->>'callSummary', ''))
    )