module.exports = {
  up: queryInterface => {
    return queryInterface.sequelize.query(`
    UPDATE "Cases" casesToUpdate
    -- Set the existing info to have a new property called 'counsellorNotes' with the JSON array from the subquery
    SET casesToUpdate.info = jsonb_set(casesToUpdate.info, '{counsellorNotes}', cn."counsellorNotes")
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
  down: async queryInterface => {
    return queryInterface.sequelize.query(`
        UPDATE "Cases" casesToUpdate
        -- No, really, that's how you remove a key from a jsonb blob :-P
        SET casesToUpdate.info = casesToUpdate.info - 'counsellorNotes' 
    `);
  },
};
