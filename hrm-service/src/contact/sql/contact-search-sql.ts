import { selectCoalesceCsamReportsByContactId } from '../../csam-report/sql/csam-report-get-sql';

export const SELECT_CONTACT_SEARCH = `
        SELECT 
        (count(*) OVER())::INTEGER AS "totalCount",
        contacts.*, reports."csamReports" 
        FROM "Contacts" contacts
        LEFT JOIN LATERAL (
          ${selectCoalesceCsamReportsByContactId('contacts')}
        ) reports ON true
        WHERE contacts."accountSid" = $<accountSid>
        AND ($<helpline> IS NULL OR contacts."helpline" = $<helpline>)
        AND (
          ($<lastNamePattern> IS NULL AND $<firstNamePattern> IS NULL)
          OR (
            "rawJson"->>'callType' IN ($<dataCallTypes:csv>)
            AND (
              $<lastNamePattern> IS NULL 
              OR "rawJson"->'childInformation'->>'lastName' ILIKE $<lastNamePattern>
              OR "rawJson"->'childInformation'->'name'->>'lastName' ILIKE $<lastNamePattern>
            )
            AND (
              $<firstNamePattern> IS NULL 
              OR "rawJson"->'childInformation'->>'firstName' ILIKE $<firstNamePattern>
              OR "rawJson"->'childInformation'->'name'->>'firstName' ILIKE $<firstNamePattern>
            )
          )
          OR (
            "rawJson"->>'callType' = 'Someone calling about a child'
            AND (
              $<lastNamePattern> IS NULL 
              OR "rawJson"->'callerInformation'->>'lastName' ILIKE $<lastNamePattern> 
              OR "rawJson"->'callerInformation'->'name'->>'lastName' ILIKE $<lastNamePattern>
            )
            AND (
              $<firstNamePattern> IS NULL
              OR "rawJson"->'callerInformation'->>'firstName' ILIKE $<firstNamePattern>
              OR "rawJson"->'callerInformation'->'name'->>'firstName' ILIKE $<firstNamePattern>
            )
          )
        )
        AND (
          $<counselor> IS NULL OR contacts."twilioWorkerId" = $<counselor>
        )
        AND (
          $<phoneNumberPattern> IS NULL
          OR "number" ILIKE $<phoneNumberPattern>
          OR regexp_replace("rawJson"#>>'{childInformation,phone1}', '\\D', '', 'g') ILIKE $<phoneNumberPattern>
          OR regexp_replace("rawJson"#>>'{childInformation,phone2}', '\\D', '', 'g') ILIKE $<phoneNumberPattern>
          OR regexp_replace("rawJson"#>>'{callerInformation,phone1}', '\\D', '', 'g') ILIKE $<phoneNumberPattern>
          OR regexp_replace("rawJson"#>>'{callerInformation,phone2}', '\\D', '', 'g') ILIKE $<phoneNumberPattern>
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
          $<onlyDataContacts> != true OR (
            "rawJson"->>'callType' IN ($<dataCallTypes:csv>)
          )
        )
        ORDER BY contacts."timeOfContact" DESC
        OFFSET $<offset>
        LIMIT $<limit>
`;
