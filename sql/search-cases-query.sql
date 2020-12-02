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

SELECT * FROM (
  SELECT DISTINCT ON (cases.id) -- Do not return same case twice
    (count(*) OVER())::INTEGER AS "totalCount",
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
    info IS NULL OR jsonb_typeof(info) = 'object'
    AND
      CASE WHEN :helpline IS NULL THEN TRUE
      ELSE  cases.helpline = :helpline
      END
    AND
      CASE WHEN :closedCases::BOOLEAN = FALSE THEN cases.status <> 'closed'
      ELSE TRUE
      END
    AND
      CASE WHEN :counselor IS NULL THEN TRUE
      ELSE cases."twilioWorkerId" = :counselor
      END
    AND
      CASE WHEN :dateFrom IS NULL THEN TRUE
      ELSE cases."createdAt"::DATE >= :dateFrom::DATE
      END
    AND
      CASE WHEN :dateTo IS NULL THEN TRUE
      ELSE cases."createdAt"::DATE <= :dateTo::DATE
      END
    AND (

      -- search on childInformation of connectedContacts
      (
        CASE WHEN :firstName IS NULL THEN TRUE
        ELSE contacts."rawJson"->'childInformation'->'name'->>'firstName' ILIKE :firstName
        END
      AND
        CASE WHEN :lastName IS NULL THEN TRUE
        ELSE contacts."rawJson"->'childInformation'->'name'->>'lastName' ILIKE :lastName
        END
      AND
        CASE WHEN :phoneNumber IS NULL THEN TRUE
        ELSE (
          regexp_replace(contacts."rawJson"->'childInformation'->'location'->>'phone1', '\D', '', 'g') ILIKE :phoneNumber
          OR regexp_replace(contacts."rawJson"->'childInformation'->'location'->>'phone2', '\D', '', 'g') ILIKE :phoneNumber
          OR regexp_replace(contacts.number, '\D', '', 'g') ILIKE :phoneNumber
        )
        END
      )

      -- search on callerInformation of connectedContacts
    OR ( 
          CASE WHEN :firstName IS NULL THEN TRUE
          ELSE contacts."rawJson"->'callerInformation'->'name'->>'firstName' ILIKE :firstName
          END
        AND
          CASE WHEN :lastName IS NULL THEN TRUE
          ELSE contacts."rawJson"->'callerInformation'->'name'->>'lastName' ILIKE :lastName
          END
        AND
          CASE WHEN :phoneNumber IS NULL THEN TRUE
          ELSE (
            regexp_replace(contacts."rawJson"->'callerInformation'->'location'->>'phone1', '\D', '', 'g') ILIKE :phoneNumber
            OR regexp_replace(contacts."rawJson"->'callerInformation'->'location'->>'phone2', '\D', '', 'g') ILIKE :phoneNumber
            OR regexp_replace(contacts.number, '\D', '', 'g') ILIKE :phoneNumber
          )
          END
        )

      -- search on households
    OR (
          CASE WHEN :firstName IS NULL THEN TRUE
          ELSE h.value->'household'->'name'->>'firstName' ILIKE :firstName
          END
        AND
          CASE WHEN :lastName IS NULL THEN TRUE
          ELSE h.value->'household'->'name'->>'lastName' ILIKE :lastName
          END
        AND
          CASE WHEN :phoneNumber IS NULL THEN TRUE
          ELSE (
            regexp_replace(h.value->'household'->'location'->>'phone1', '\D', '', 'g') ILIKE :phoneNumber
            OR regexp_replace(h.value->'household'->'location'->>'phone2', '\D', '', 'g') ILIKE :phoneNumber
          )
          END
        )

      -- search on perpetrators
    OR (
          CASE WHEN :firstName IS NULL THEN TRUE
          ELSE p.value->'perpetrator'->'name'->>'firstName' ILIKE :firstName
          END
        AND
          CASE WHEN :lastName IS NULL THEN TRUE
          ELSE p.value->'perpetrator'->'name'->>'lastName' ILIKE :lastName
          END
        AND
          CASE WHEN :phoneNumber IS NULL THEN TRUE
          ELSE (
            regexp_replace(p.value->'perpetrator'->'location'->>'phone1', '\D', '', 'g') ILIKE :phoneNumber
            OR regexp_replace(p.value->'perpetrator'->'location'->>'phone2', '\D', '', 'g') ILIKE :phoneNumber
          )
          END
        )
    )
  GROUP BY cases.id
) "unorderedResults"
ORDER BY "createdAt" DESC
LIMIT :limit
OFFSET :offset
;
