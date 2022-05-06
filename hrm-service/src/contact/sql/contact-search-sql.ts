import { endOfDay, startOfDay, parseISO } from 'date-fns';

// Intentionally adding only the types of interest here
const callTypes = {
  child: 'Child calling about self',
  caller: 'Someone calling about a child',
};

type QueryParams = {
  accountSid: string;
  firstNamePattern?: string;
  lastNamePattern?: string;
  phoneNumberPattern?: string;
  counselor?: string;
  dateTo?: string;
  dateFrom?: string;
  contactNumber?: string;
  onlyDataContact: boolean;
  dataCallTypes: string[];
  limit: number;
  offset: number;
};

export const searchParametersToQueryParameters = (
  accountSid: string,
  {
    firstName,
    lastName,
    phoneNumber,
    dateFrom,
    dateTo,
    ...restOfSearch
  }: {
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    dateFrom?: string;
    dateTo?: string;
  },
  limit: number,
  offset: number,
): QueryParams => {
  const queryParams: QueryParams = {
    ...{
      helpline: undefined,
      lastNamePattern: undefined,
      firstNamePattern: undefined,
      phoneNumberPattern: undefined,
      counselor: undefined,
      contactNumber: undefined,
      onlyDataContact: false,
    },
    dateFrom: dateFrom ? startOfDay(parseISO(dateFrom)).toISOString() : undefined,
    dateTo: dateTo ? endOfDay(parseISO(dateTo)).toISOString() : undefined,
    ...restOfSearch,
    accountSid,
    dataCallTypes: Object.values(callTypes),
    limit,
    offset,
  };
  if (firstName) {
    queryParams.firstNamePattern = `%${firstName}%`;
  }
  if (lastName) {
    queryParams.lastNamePattern = `%${lastName}%`;
  }
  if (phoneNumber) {
    queryParams.phoneNumberPattern = `%${phoneNumber.replace(/[\D]/gi, '')}%`;
  }
  return queryParams;
};

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
