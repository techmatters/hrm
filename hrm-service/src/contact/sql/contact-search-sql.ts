export const SELECT_CONTACT_SEARCH = `
        SELECT 
        (count(*) OVER())::INTEGER AS "totalCount",
        contacts.*, reports."csamReports" 
        FROM "Contacts" contacts
        LEFT JOIN LATERAL (
          SELECT COALESCE(jsonb_agg(to_jsonb(r)), '[]') AS  "csamReports" 
          FROM "CSAMReports" r 
          WHERE r."contactId" = contacts.id AND r."accountSid" = contacts."accountSid"
        ) reports ON true
        WHERE contacts."accountSid" = $<accountSid>
        AND ($<helpline> IS NULL OR contacts."helpline" = $<helpline>)
        AND (
          ($<lastNamePattern> IS NULL AND $<firstNamePattern> IS NULL)
          OR (
            "rawJson"->>'callType' IN ($<dataCallTypes:csv>)
            AND
            ($<lastNamePattern> IS NULL OR "rawJson"->'childInformation'->'name'->>'lastName' ILIKE $<lastNamePattern>)
            AND
            ($<firstNamePattern> IS NULL OR "rawJson"->'childInformation'->'name'->>'firstName' ILIKE $<firstNamePattern>)
          )
          OR (
            "rawJson"->>'callType' = 'Someone calling about a child'
            AND
            ($<lastNamePattern> IS NULL OR "rawJson"->'callerInformation'->'name'->>'lastName' ILIKE $<lastNamePattern>)
            AND
            ($<firstNamePattern> IS NULL OR "rawJson"->'callerInformation'->'name'->>'firstName' ILIKE $<firstNamePattern>)
          )
        )
        AND (
          $<counselor> IS NULL OR contacts."twilioWorkerId" = $<counselor>
        )
        AND (
          $<phoneNumberPattern> IS NULL
          OR "number" ILIKE $<phoneNumberPattern>
          OR regexp_replace("rawJson"#>>'{childInformation,location,phone1}', '\\D', '', 'g') ILIKE $<phoneNumberPattern>
          OR regexp_replace("rawJson"#>>'{childInformation,location,phone2}', '\\D', '', 'g') ILIKE $<phoneNumberPattern>
          OR regexp_replace("rawJson"#>>'{callerInformation,location,phone1}', '\\D', '', 'g') ILIKE $<phoneNumberPattern>
          OR regexp_replace("rawJson"#>>'{callerInformation,location,phone2}', '\\D', '', 'g') ILIKE $<phoneNumberPattern>
        )
        AND (
          $<dateFrom> IS NULL OR contacts."timeOfContact" >= $<dateFrom>
        )
        AND (
          $<dateTo> IS NULL OR contacts."timeOfContact" <= $<dateTo>
        )
        AND (
          $<contactNumber> IS NULL OR contacts."number" = $<contactNumber> 
        )
        AND (
          $<onlyDataContact> != true OR (
            "rawJson"->>'callType' IN ($<dataCallTypes:csv>)
          )
        )
        ORDER BY contacts."timeOfContact" DESC
        OFFSET $<offset>
        LIMIT $<limit>
`;
