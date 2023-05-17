/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

module.exports = {
  up: async queryInterface => {
    await queryInterface.sequelize.query(`UPDATE "Cases" AS casesToUpdate
SET "info" = jsonb_set(casesToUpdate."info", '{referrals}', ar."auditReferrals")
FROM
(
    SELECT
        ca."caseId",
        COALESCE(jsonb_agg(r.value || jsonb_build_object('id', ca.id::text, 'twilioWorkerId', ca."twilioWorkerId", 'createdAt',ca."createdAt")) FILTER (WHERE r.value IS NOT NULL), '[]') AS "auditReferrals"
    FROM public."CaseAudits" ca
        LEFT JOIN LATERAL
        jsonb_array_elements(jsonb_path_query_array(ca."newValue"->'info'->'referrals', CONCAT('$[', COALESCE(jsonb_array_length(ca."previousValue"->'info'->'referrals'), 0), ' to ', jsonb_array_length(ca."newValue"->'info'->'referrals'), ']')::jsonpath))
         r ON true
    WHERE
        ca."caseId" IS NOT NULL AND
        COALESCE(jsonb_array_length(ca."previousValue"->'info'->'referrals'), 0) < jsonb_array_length(ca."newValue"->'info'->'referrals')
    GROUP BY ca."caseId"
) ar
WHERE casesToUpdate.id = ar."caseId"`);
    return queryInterface.sequelize.query(`
    UPDATE "Cases" AS casesToUpdate
    -- Set the existing info to have a new property called 'counsellorNotes' with the JSON array from the subquery
    SET "info" = jsonb_set(casesToUpdate.info, '{counsellorNotes}', cn."counsellorNotes")
    FROM
    (
      SELECT
        ca."caseId",
        -- Aggregate all the added notes for a single Case ID into a jsonb array ordered by the case audit ID (which should be the order they were added)
        COALESCE(jsonb_agg(jsonb_build_object('note', n.value, 'id', ca.id::text, 'twilioWorkerId', ca."twilioWorkerId", 'createdAt',ca."createdAt") ORDER BY ca.id) FILTER (WHERE n.value IS NOT NULL), '[]') AS "counsellorNotes"
      FROM 
        public."CaseAudits" ca
      LEFT JOIN LATERAL
        -- Get all the notes in the newValue that are at indexes higher than the highers index in the previousValue notes (obviously only works if notes are only ever added to the end) and expands to a record for each
        -- Practically notes are only added one at a time, but if there are any cases of multiple notes being added in a single audited operation, this should still work
        jsonb_array_elements_text(jsonb_path_query_array(ca."newValue"->'info'->'notes', CONCAT('$[', COALESCE(jsonb_array_length(ca."previousValue"->'info'->'notes'), 0), ' to ', jsonb_array_length(ca."newValue"->'info'->'notes'), ']')::jsonpath)) n ON true
      WHERE
        ca."caseId" IS NOT NULL AND
        -- Find all audits where a note is added, this should include creation audits if they have a note
        COALESCE(jsonb_array_length(ca."previousValue"->'info'->'notes'), 0) < jsonb_array_length(ca."newValue"->'info'->'notes')
      GROUP BY ca."caseId"
    ) cn
    WHERE casesToUpdate.id = cn."caseId"
    `);
  },
  down: queryInterface => {
    // Not sure if there's any value to removing the additional referral properties in a rollback? The update is idempotent anyway.
    // The same could be said for counsellorNotes, but that rollback is pretty simple, whereas removing the extra props from referrals is a PITA
    return queryInterface.sequelize.query(`
        UPDATE "Cases" casesToUpdate
        SET "info" = casesToUpdate.info - 'counsellorNotes' 
    `);
  },
};
