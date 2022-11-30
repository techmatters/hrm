import { selectContactsWithCsamReports } from '../../contact/sql/contact-get-sql';

export const PULL_DUE_JOBS_SQL = `
  WITH due AS (
    UPDATE "ContactJobs" SET "lastAttempt" = CURRENT_TIMESTAMP, "numberOfAttempts" = "numberOfAttempts" + 1
    WHERE "completed" IS NULL AND "numberOfAttempts" < $<jobMaxAttempts> AND ("lastAttempt" IS NULL OR "lastAttempt" <= $<lastAttemptedBefore>::TIMESTAMP WITH TIME ZONE) RETURNING *
  )
  SELECT due.*, to_jsonb(contacts.*) AS "resource" FROM due LEFT JOIN LATERAL (
  ${selectContactsWithCsamReports(
    'Contacts',
  )} WHERE c."accountSid" = due."accountSid" AND c."id" = due."contactId") AS contacts ON true
`;

export const COMPLETE_JOB_SQL = `
  UPDATE "ContactJobs" SET
      "completed" = CURRENT_TIMESTAMP,
      "completionPayload" = $<completionPayload:json>::JSONB
  WHERE "id" = $<id>
  RETURNING *
`;

export const APPEND_FAILED_ATTEMPT_PAYLOAD = `
  UPDATE "ContactJobs"
  SET
    "failedAttemptsPayloads" =
      COALESCE("failedAttemptsPayloads", '{}'::JSONB) || jsonb_set(
        "failedAttemptsPayloads", -- target
        format('{%s}', $<attemptNumber>)::text[], -- path
        COALESCE("failedAttemptsPayloads"#>format('{%s}', $<attemptNumber>)::text[], '[]'::JSONB) || $<attemptPayload:json>::JSONB, -- value
        true -- create if not exists
      )
  WHERE id = $<id>
  RETURNING *
`;
