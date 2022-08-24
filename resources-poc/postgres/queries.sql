--Relational reference category update example - <300ms
UPDATE resource_relational."ResourceReferenceAttributeValues" SET "value" = 'node-updated-1' || substring("value" from char_length('reference-node-1'))
WHERE "accountSid" = 'ACCOUNT_5' AND left("value", char_length('reference-node-1')) = 'reference-node-1';

--Relational inline category update example - can take 6-8 seconds to run against a 1000000 resource DB split evenly across 10 helplines
--Reduced to ~500ms with an index on values
UPDATE resource_relational."ResourceStringAttributes" SET "value" = 'node-updated-1' || substring("value" from char_length('inline-node-1'))
WHERE "accountSid" = 'ACCOUNT_5' AND left("value", char_length('inline-node-1')) = 'inline-node-1';


--Document reference category update example - can take 6-8 seconds to run against a 1000000 resource DB split evenly across 10 helplines
UPDATE resource_document."Resources"
SET "attributes" = res."attributes" || jsonb_build_object('inlineCategories', COALESCE(mc.inlineCategory,'[]')) AS newValue,
							  res.*
							  FROM resource_document."Resources" AS res
INNER JOIN LATERAL (
	SELECT jsonb_agg(
		CASE WHEN (left(value, char_length('reference-node-1')) = 'reference-node-1') THEN 'node-updated-1' || substring(value from char_length('inline-node-1')+1) ELSE value END
	) AS inlineCategory FROM
	jsonb_array_elements_text(res."attributes"->'inlineCategories')
	AS matchingCategories

) AS mc ON true
WHERE "accountSid" = 'ACCOUNT_5' AND EXISTS(
	select
    from jsonb_array_elements_text(res."attributes"->'inlineCategories')
    WHERE left(value, char_length('inline-node-1')) = 'inline-node-1'
);
UPDATE resource_relational."ResourceReferenceAttributeValues" SET "value" = 'node-updated-1' || substring("value" from char_length('reference-node-1'))
  WHERE "accountSid" = 'ACCOUNT_5' AND left("value", char_length('reference-node-1')) = 'reference-node-1';

--Document inline category update example - can take 6-8 seconds to run against a 1000000 resource DB split evenly across 10 helplines
UPDATE resource_document."Resources"
SET "attributes" = res."attributes" || jsonb_build_object('referenceCategories', COALESCE(mc.inlineCategory,'[]')) AS newValue,
							  res.*
							  FROM resource_document."Resources" AS res
INNER JOIN LATERAL (
	SELECT jsonb_agg(
		CASE WHEN (left(value, char_length('inline-node-1')) = 'inline-node-1') THEN 'node-updated-1' || substring(value from char_length('inline-node-1')+1) ELSE value END
	) AS inlineCategory FROM
	jsonb_array_elements_text(res."attributes"->'inlineCategories')
	AS matchingCategories

) AS mc ON true
WHERE "accountSid" = 'ACCOUNT_5' AND EXISTS(
	select
    from jsonb_array_elements_text(res."attributes"->'inlineCategories')
    WHERE left(value, char_length('inline-node-1')) = 'inline-node-1'
);



-- Relational full document as sets (UNION could be replaced by a batch of separate selects)
-- Would need application side processing to produce a doc for an API and would need application side mapping if multiple resources were retrieved
WITH res AS (
    SELECT * as "attributes" FROM "Resources" WHERE r."name" = 'Test Resource 1000'
)
SELECT "resourceId", "accountSid", "key", "value"
	FROM "ResourceStringAttributes"
	WHERE res."id" = "resourceId" AND res."accountSid" = "accountSid"
UNION ALL
SELECT rra."resourceId", rra."accountSid", rrav."key", rrav."value"
	FROM "ResourceReferenceAttributes" rra
	LEFT JOIN "ResourceReferenceAttributeValues" rrav ON rra."referenceId" = rrav."id" AND rra."accountSid" = rrav."accountSid"
	WHERE r."id" = rra."resourceId" AND r."accountSid" = rra."accountSid"


-- Relational full document as JSON
SELECT r.*, jsonb_object_agg(refs.key, refs.values) as "attributes" FROM "Resources" r
LEFT JOIN LATERAL (
	SELECT "resourceId", "accountSid", "key", jsonb_agg("ResourceStringAttributes"."value") AS values
	FROM "ResourceStringAttributes"
	WHERE r."id" = "resourceId" AND r."accountSid" = "accountSid"
	GROUP BY "accountSid", "resourceId", "key"
UNION ALL
	SELECT rra."resourceId", rra."accountSid", rrav."key", jsonb_agg(rrav."value") AS values
	FROM "ResourceReferenceAttributes" rra
	LEFT JOIN "ResourceReferenceAttributeValues" rrav ON rra."referenceId" = rrav."id" AND rra."accountSid" = rrav."accountSid"
	WHERE r."id" = rra."resourceId" AND r."accountSid" = rra."accountSid"
	GROUP BY rra."accountSid", rra."resourceId", rrav."key"
) refs ON true
WHERE r."name" = 'Test Resource 1000'
GROUP BY r."id", r."name", r."accountSid"

-- Relational full document as JSON
SELECT r.* WHERE r."name" = 'Test Resource 1000'