SELECT DISTINCT ON (cases.id)
  cases.*,
  COALESCE(json_agg(DISTINCT contacts.*) FILTER (WHERE contacts.id IS NOT NULL), '[]') AS "connectedContacts"
FROM
  "Cases" cases,
  jsonb_to_record(info) AS info_as_table(households jsonb, perpetrators jsonb)
LEFT JOIN LATERAL json_array_elements(households::JSON) h ON TRUE
LEFT JOIN LATERAL json_array_elements(perpetrators::JSON) p ON TRUE
LEFT JOIN LATERAL (
  SELECT * FROM "Contacts" c WHERE c."caseId" = "cases".id
  ) contacts ON true
WHERE
  CASE WHEN :helpline IS NULL THEN TRUE
  ELSE  cases.helpline = :helpline
  END
  AND CASE WHEN :firstName IS NULL THEN TRUE
  ELSE
  (
    households IS NOT NULL AND h.value->'household'->'name'->>'firstName' ILIKE :firstName
    OR perpetrators IS NOT NULL AND p.value->'perpetrator'->'name'->>'firstName' ILIKE :firstName
  )
  END
  AND CASE WHEN :lastName IS NULL THEN TRUE
  ELSE
  (
    households IS NOT NULL AND h.value->'household'->'name'->>'lastName' ILIKE :lastName
    OR perpetrators IS NOT NULL AND p.value->'perpetrator'->'name'->>'lastName' ILIKE :lastName
  )
  END
  AND CASE WHEN :dateFrom IS NULL THEN TRUE
  ELSE cases."createdAt" >= :dateFrom::DATE
  END
  AND CASE WHEN :dateTo IS NULL THEN TRUE
  ELSE cases."createdAt" <= :dateTo::DATE
  END
  AND CASE WHEN :phoneNumber IS NULL THEN TRUE
  ELSE
  (
    households IS NOT NULL AND
    (
      regexp_replace(h.value->'household'->'location'->>'phone1', '\D', '', 'g') ILIKE :phoneNumber
      OR regexp_replace(h.value->'household'->'location'->>'phone2', '\D', '', 'g') ILIKE :phoneNumber
    )
    OR perpetrators IS NOT NULL AND
    (
      regexp_replace(p.value->'perpetrator'->'location'->>'phone1', '\D', '', 'g') ILIKE :phoneNumber
      OR regexp_replace(p.value->'perpetrator'->'location'->>'phone2', '\D', '', 'g') ILIKE :phoneNumber
    )
  )
  END
GROUP BY cases.id
;