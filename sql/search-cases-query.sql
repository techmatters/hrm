/*
 * Search cases based on given params:
 * - helpline
 * - firstName
 * - lastName
 * - dateFrom
 * - dateTo
 * - phoneNumber
 *
 * It returns the matched cases with their connectedContacts
 */
SELECT DISTINCT ON (cases.id) -- Do not return same case twice
  cases.*,
  -- build "connectedContacts": an aggregate contacts as an array of json objects
  COALESCE(json_agg(DISTINCT contacts.*) FILTER (WHERE contacts.id IS NOT NULL), '[]') AS "connectedContacts"
FROM
  "Cases" cases,
  -- Transform "info" column as a table with columns "households" and "perpetrators"
  jsonb_to_record(info) AS info_as_table(households jsonb, perpetrators jsonb)
-- Extract every household/perpetrator as a record and apply a join
LEFT JOIN LATERAL json_array_elements(households::JSON) h ON TRUE
LEFT JOIN LATERAL json_array_elements(perpetrators::JSON) p ON TRUE
-- Join contacts on contacts.caseId column
LEFT JOIN LATERAL (
  SELECT * FROM "Contacts" c WHERE c."caseId" = "cases".id
  ) contacts ON true
WHERE
    CASE WHEN :helpline IS NULL THEN TRUE
    ELSE  cases.helpline = :helpline
    END
  AND
  -- search on firstName of households and perpetrators
    CASE WHEN :firstName IS NULL THEN TRUE
    ELSE (
      households IS NOT NULL AND h.value->'household'->'name'->>'firstName' ILIKE :firstName
      OR perpetrators IS NOT NULL AND p.value->'perpetrator'->'name'->>'firstName' ILIKE :firstName
    )
    END
  AND
    -- search on lastName of households and perpetrators
    CASE WHEN :lastName IS NULL THEN TRUE
    ELSE (
      households IS NOT NULL AND h.value->'household'->'name'->>'lastName' ILIKE :lastName
      OR perpetrators IS NOT NULL AND p.value->'perpetrator'->'name'->>'lastName' ILIKE :lastName
    )
    END
  AND
    CASE WHEN :dateFrom IS NULL THEN TRUE
    ELSE cases."createdAt" >= :dateFrom::DATE
    END
  AND
    CASE WHEN :dateTo IS NULL THEN TRUE
    ELSE cases."createdAt" <= :dateTo::DATE
    END
  AND
    -- search on phone1 and phone2 of households and perpetrators
    CASE WHEN :phoneNumber IS NULL THEN TRUE
    ELSE (
      households IS NOT NULL AND (
        regexp_replace(h.value->'household'->'location'->>'phone1', '\D', '', 'g') ILIKE :phoneNumber
        OR regexp_replace(h.value->'household'->'location'->>'phone2', '\D', '', 'g') ILIKE :phoneNumber
      )
      OR perpetrators IS NOT NULL AND (
        regexp_replace(p.value->'perpetrator'->'location'->>'phone1', '\D', '', 'g') ILIKE :phoneNumber
        OR regexp_replace(p.value->'perpetrator'->'location'->>'phone2', '\D', '', 'g') ILIKE :phoneNumber
      )
    )
    END
GROUP BY cases.id
;