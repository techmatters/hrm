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
	FROM public."SequelizeMeta" WHERE "name" LIKE '20230926%';