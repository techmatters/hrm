/**
 * Given a date range (dateFrom & dateTo),
 * returns the required columns to transcript a contact chat ("accountSid", "serviceSid", "channelSid")
 * for all of the contacts created in that range.
 */
export const selectColumnsForTranscript = () => `
  SELECT "accountSid", "serviceSid", "channelSid" 
  FROM "Contacts" 
  WHERE ("serviceSid" != '') IS TRUE
    AND ("channelSid" != '') IS TRUE
    AND (
      $<dateFrom> IS NULL OR "createdAt" >= $<dateFrom>
      -- $<dateFrom> IS NULL OR "timeOfContact" >= $<dateFrom>
    )
    AND (
      $<dateTo> IS NULL OR "createdAt" <= $<dateTo>
      -- $<dateTo> IS NULL OR "timeOfContact" <= $<dateTo>
    );
`;
