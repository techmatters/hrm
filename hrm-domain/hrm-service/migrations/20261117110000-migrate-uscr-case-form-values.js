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
'use strict';

const { getTwilioAccountSid } = require('@tech-matters/aselo-config');

const upQueries = [
  `
    UPDATE "CaseSections"
    SET "sectionTypeSpecificData" = jsonb_set(
      "sectionTypeSpecificData",
      '{primaryDisposition}',
      to_jsonb(CASE "sectionTypeSpecificData"->>'primaryDisposition'
        WHEN 'Gone on Arrival' THEN 'Gone On Arrival'
        WHEN 'Engaged - Assisted' THEN 'Engaged: Assisted'
        WHEN 'Engaged - Unable to assist' THEN 'Engaged: Unable to Assist'
        WHEN 'Engaged - Return to 911 - Reported issue unresolved'
          THEN 'Returned to 911: Reported Issue Unresolved'
        WHEN 'Engaged - [LAPD] Emergency Services Requested'
          THEN 'Emergency Services Requested: LAPD'
        WHEN 'Engaged - [LAFD/EMS] Emergency Services Requested'
          THEN 'Emergency Services Requested: LAFD/EMS'
        WHEN 'Engaged - [DMH] Emergency Services Requested'
          THEN 'Emergency Services Requested: DMH'
        WHEN 'Returned to 911 - Out of Scope' THEN 'Returned to 911: Out of Scope'
        WHEN 'Returned to 911 - Out of Area' THEN 'Returned to 911: Out of Area'
      END),
      false
    )
    WHERE "sectionType" = 'caseReport'
      AND "accountSid" = :accountSid
      AND "sectionTypeSpecificData"->>'primaryDisposition' IN (
        'Gone on Arrival',
        'Engaged - Assisted',
        'Engaged - Unable to assist',
        'Engaged - Return to 911 - Reported issue unresolved',
        'Engaged - [LAPD] Emergency Services Requested',
        'Engaged - [LAFD/EMS] Emergency Services Requested',
        'Engaged - [DMH] Emergency Services Requested',
        'Returned to 911 - Out of Scope',
        'Returned to 911 - Out of Area'
      );
  `,
  `
    UPDATE "CaseSections" cs
    SET "sectionTypeSpecificData" = jsonb_set(
      cs."sectionTypeSpecificData",
      '{tangibleResourcesProvided}',
      (
        SELECT COALESCE(jsonb_agg(to_jsonb(mapped.value) ORDER BY mapped.ordinality), '[]'::jsonb)
        FROM (
          SELECT DISTINCT ON (new_value) new_value AS value, ordinality
          FROM (
            SELECT CASE value
              WHEN 'Transportation: CIRCLE Team Transport'
                THEN 'Transportation: CIRCLE Team Transport '
              ELSE value
            END AS new_value, ordinality
            FROM jsonb_array_elements_text(cs."sectionTypeSpecificData"->'tangibleResourcesProvided')
              WITH ORDINALITY AS entry(value, ordinality)
          ) AS remapped
          ORDER BY new_value, ordinality
        ) AS mapped
      ),
      false
    )
    WHERE cs."sectionType" = 'caseReport'
      AND cs."accountSid" = :accountSid
      AND jsonb_typeof(cs."sectionTypeSpecificData"->'tangibleResourcesProvided') = 'array'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(cs."sectionTypeSpecificData"->'tangibleResourcesProvided') AS entry(value)
        WHERE value = 'Transportation: CIRCLE Team Transport'
      );
  `,
  `
    UPDATE "CaseSections" cs
    SET "sectionTypeSpecificData" = jsonb_set(
      cs."sectionTypeSpecificData",
      '{informationProvided}',
      (
        SELECT COALESCE(jsonb_agg(to_jsonb(mapped.value) ORDER BY mapped.ordinality), '[]'::jsonb)
        FROM (
          SELECT DISTINCT ON (new_value) new_value AS value, ordinality
          FROM (
            SELECT CASE value
              WHEN 'Employment or Education Services' THEN 'Employment or Education Resources'
              ELSE value
            END AS new_value, ordinality
            FROM jsonb_array_elements_text(cs."sectionTypeSpecificData"->'informationProvided')
              WITH ORDINALITY AS entry(value, ordinality)
          ) AS remapped
          ORDER BY new_value, ordinality
        ) AS mapped
      ),
      false
    )
    WHERE cs."sectionType" = 'caseReport'
      AND cs."accountSid" = :accountSid
      AND jsonb_typeof(cs."sectionTypeSpecificData"->'informationProvided') = 'array'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(cs."sectionTypeSpecificData"->'informationProvided') AS entry(value)
        WHERE value = 'Employment or Education Services'
      );
  `,
  `
    UPDATE "CaseSections" cs
    SET "sectionTypeSpecificData" = jsonb_set(
      cs."sectionTypeSpecificData",
      '{referralProvided}',
      (
        SELECT COALESCE(jsonb_agg(to_jsonb(mapped.value) ORDER BY mapped.ordinality), '[]'::jsonb)
        FROM (
          SELECT DISTINCT ON (new_value) new_value AS value, ordinality
          FROM (
            SELECT CASE value
              WHEN 'Mental Health Provider: DMH Portal' THEN 'Mental Health Provider: DMH'
              ELSE value
            END AS new_value, ordinality
            FROM jsonb_array_elements_text(cs."sectionTypeSpecificData"->'referralProvided')
              WITH ORDINALITY AS entry(value, ordinality)
          ) AS remapped
          ORDER BY new_value, ordinality
        ) AS mapped
      ),
      false
    )
    WHERE cs."sectionType" = 'caseReport'
      AND cs."accountSid" = :accountSid
      AND jsonb_typeof(cs."sectionTypeSpecificData"->'referralProvided') = 'array'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(cs."sectionTypeSpecificData"->'referralProvided') AS entry(value)
        WHERE value = 'Mental Health Provider: DMH Portal'
      );
  `,
  `
    UPDATE "CaseSections" cs
    SET "sectionTypeSpecificData" = jsonb_set(
      cs."sectionTypeSpecificData",
      '{serviceObtained}',
      (
        SELECT COALESCE(jsonb_agg(to_jsonb(mapped.value) ORDER BY mapped.ordinality), '[]'::jsonb)
        FROM (
          SELECT DISTINCT ON (new_value) new_value AS value, ordinality
          FROM (
            SELECT CASE value
              WHEN 'Employment/Education Enrollment Established' THEN 'Established Employment'
              WHEN 'Established Benefits : CalFresh ' THEN 'Benefits Established: CalFresh'
              WHEN 'Established Benefits : CalWorks ' THEN 'Benefits Established: General Relief'
              WHEN 'Established Benefits : GR ' THEN 'Benefits Established: MediCal'
              WHEN 'Established Benefits : MediCal '
                THEN 'Benefits Established: Social Security Benefits (SSI/SSDI/SSA)'
              WHEN 'Mental Health Care '
                THEN 'Behavioral Health: Established mental health provider'
              WHEN 'SUD Treatment : Collaborative' THEN 'SUD Treatment: Collaborative'
              WHEN 'SUD Treatment : Other' THEN 'SUD Treatment: Other'
              WHEN 'Veterans Services/Benefits'
                THEN 'Benefits Established: Veterans Services/Benefits'
              ELSE value
            END AS new_value, ordinality
            FROM jsonb_array_elements_text(cs."sectionTypeSpecificData"->'serviceObtained')
              WITH ORDINALITY AS entry(value, ordinality)
          ) AS remapped
          ORDER BY new_value, ordinality
        ) AS mapped
      ),
      false
    )
    WHERE cs."sectionType" = 'caseReport'
      AND cs."accountSid" = :accountSid
      AND jsonb_typeof(cs."sectionTypeSpecificData"->'serviceObtained') = 'array'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(cs."sectionTypeSpecificData"->'serviceObtained') AS entry(value)
        WHERE value IN (
          'Employment/Education Enrollment Established',
          'Established Benefits : CalFresh ',
          'Established Benefits : CalWorks ',
          'Established Benefits : GR ',
          'Established Benefits : MediCal ',
          'Mental Health Care ',
          'SUD Treatment : Collaborative',
          'SUD Treatment : Other',
          'Veterans Services/Benefits'
        )
      );
  `,
  `
    UPDATE "CaseSections" cs
    SET "sectionTypeSpecificData" = jsonb_set(
      cs."sectionTypeSpecificData",
      '{issueReport}',
      (
        SELECT COALESCE(jsonb_agg(to_jsonb(mapped.value) ORDER BY mapped.ordinality), '[]'::jsonb)
        FROM (
          SELECT DISTINCT ON (new_value) new_value AS value, ordinality
          FROM (
            SELECT CASE value
              WHEN 'Deceased person discovered /Death witnessed'
                THEN 'Deceased person discovered / Death witnessed'
              WHEN 'Intervention request made to Child Protective Services.'
                THEN 'Intervention request made to Child Protective Services'
              WHEN 'The filing of a police report;' THEN 'The filing of a police report'
              ELSE value
            END AS new_value, ordinality
            FROM jsonb_array_elements_text(cs."sectionTypeSpecificData"->'issueReport')
              WITH ORDINALITY AS entry(value, ordinality)
          ) AS remapped
          ORDER BY new_value, ordinality
        ) AS mapped
      ),
      false
    )
    WHERE cs."sectionType" = 'caseReport'
      AND cs."accountSid" = :accountSid
      AND jsonb_typeof(cs."sectionTypeSpecificData"->'issueReport') = 'array'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(cs."sectionTypeSpecificData"->'issueReport') AS entry(value)
        WHERE value IN (
          'Deceased person discovered /Death witnessed',
          'Intervention request made to Child Protective Services.',
          'The filing of a police report;'
        )
      );
  `,
  `
    UPDATE "CaseSections" cs
    SET "sectionTypeSpecificData" = jsonb_set(
      cs."sectionTypeSpecificData",
      '{substancesUsed}',
      (
        SELECT COALESCE(jsonb_agg(to_jsonb(mapped.value) ORDER BY mapped.ordinality), '[]'::jsonb)
        FROM (
          SELECT DISTINCT ON (new_value) new_value AS value, ordinality
          FROM (
            SELECT CASE value
              WHEN 'Cannabis (marijuana, pot, grass, hash, etc.)'
                THEN 'Cannabis (marijuana, pot, grass, hash, etc.) '
              WHEN 'Cocaine (coke, crack, etc.)' THEN 'Cocaine (coke, crack, etc.) '
              WHEN 'Inhalants (nitrous, glue, petrol, paint thinner, etc.)'
                THEN 'Inhalants (nitrous, glue, petrol, paint thinner, etc.) '
              WHEN 'Sedatives or Sleeping Pills (Valium, Serepax, Rohypnol, etc.)'
                THEN 'Sedatives or Sleeping Pills (Valium, Serepax, Rohypnol, etc.) '
              WHEN 'Opioids (heroin, morphine, methadone, codeine, fentanyl etc.)'
                THEN 'Opioids (heroin, morphine, methadone, codeine, fentanyl etc.) '
              ELSE value
            END AS new_value, ordinality
            FROM jsonb_array_elements_text(cs."sectionTypeSpecificData"->'substancesUsed')
              WITH ORDINALITY AS entry(value, ordinality)
          ) AS remapped
          ORDER BY new_value, ordinality
        ) AS mapped
      ),
      false
    )
    WHERE cs."sectionType" = 'sudSurvey'
      AND cs."accountSid" = :accountSid
      AND jsonb_typeof(cs."sectionTypeSpecificData"->'substancesUsed') = 'array'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(cs."sectionTypeSpecificData"->'substancesUsed') AS entry(value)
        WHERE value IN (
          'Cannabis (marijuana, pot, grass, hash, etc.)',
          'Cocaine (coke, crack, etc.)',
          'Inhalants (nitrous, glue, petrol, paint thinner, etc.)',
          'Sedatives or Sleeping Pills (Valium, Serepax, Rohypnol, etc.)',
          'Opioids (heroin, morphine, methadone, codeine, fentanyl etc.)'
        )
      );
  `,
];

// Rollback reverts every matching value, not just values changed by up; this may undo values
// entered with the new form after the upgrade.
const downQueries = [
  `
    UPDATE "CaseSections"
    SET "sectionTypeSpecificData" = jsonb_set(
      "sectionTypeSpecificData",
      '{primaryDisposition}',
      to_jsonb(CASE "sectionTypeSpecificData"->>'primaryDisposition'
        WHEN 'Gone On Arrival' THEN 'Gone on Arrival'
        WHEN 'Engaged: Assisted' THEN 'Engaged - Assisted'
        WHEN 'Engaged: Unable to Assist' THEN 'Engaged - Unable to assist'
        WHEN 'Returned to 911: Reported Issue Unresolved'
          THEN 'Engaged - Return to 911 - Reported issue unresolved'
        WHEN 'Emergency Services Requested: LAPD'
          THEN 'Engaged - [LAPD] Emergency Services Requested'
        WHEN 'Emergency Services Requested: LAFD/EMS'
          THEN 'Engaged - [LAFD/EMS] Emergency Services Requested'
        WHEN 'Emergency Services Requested: DMH'
          THEN 'Engaged - [DMH] Emergency Services Requested'
        WHEN 'Returned to 911: Out of Scope' THEN 'Returned to 911 - Out of Scope'
        WHEN 'Returned to 911: Out of Area' THEN 'Returned to 911 - Out of Area'
      END),
      false
    )
    WHERE "sectionType" = 'caseReport'
      AND "accountSid" = :accountSid
      AND "sectionTypeSpecificData"->>'primaryDisposition' IN (
        'Gone On Arrival',
        'Engaged: Assisted',
        'Engaged: Unable to Assist',
        'Returned to 911: Reported Issue Unresolved',
        'Emergency Services Requested: LAPD',
        'Emergency Services Requested: LAFD/EMS',
        'Emergency Services Requested: DMH',
        'Returned to 911: Out of Scope',
        'Returned to 911: Out of Area'
      );
  `,
  `
    UPDATE "CaseSections" cs
    SET "sectionTypeSpecificData" = jsonb_set(
      cs."sectionTypeSpecificData",
      '{tangibleResourcesProvided}',
      (
        SELECT COALESCE(jsonb_agg(to_jsonb(mapped.value) ORDER BY mapped.ordinality), '[]'::jsonb)
        FROM (
          SELECT DISTINCT ON (new_value) new_value AS value, ordinality
          FROM (
            SELECT CASE value
              WHEN 'Transportation: CIRCLE Team Transport '
                THEN 'Transportation: CIRCLE Team Transport'
              ELSE value
            END AS new_value, ordinality
            FROM jsonb_array_elements_text(cs."sectionTypeSpecificData"->'tangibleResourcesProvided')
              WITH ORDINALITY AS entry(value, ordinality)
          ) AS remapped
          ORDER BY new_value, ordinality
        ) AS mapped
      ),
      false
    )
    WHERE cs."sectionType" = 'caseReport'
      AND cs."accountSid" = :accountSid
      AND jsonb_typeof(cs."sectionTypeSpecificData"->'tangibleResourcesProvided') = 'array'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(cs."sectionTypeSpecificData"->'tangibleResourcesProvided') AS entry(value)
        WHERE value = 'Transportation: CIRCLE Team Transport '
      );
  `,
  `
    UPDATE "CaseSections" cs
    SET "sectionTypeSpecificData" = jsonb_set(
      cs."sectionTypeSpecificData",
      '{informationProvided}',
      (
        SELECT COALESCE(jsonb_agg(to_jsonb(mapped.value) ORDER BY mapped.ordinality), '[]'::jsonb)
        FROM (
          SELECT DISTINCT ON (new_value) new_value AS value, ordinality
          FROM (
            SELECT CASE value
              WHEN 'Employment or Education Resources' THEN 'Employment or Education Services'
              ELSE value
            END AS new_value, ordinality
            FROM jsonb_array_elements_text(cs."sectionTypeSpecificData"->'informationProvided')
              WITH ORDINALITY AS entry(value, ordinality)
          ) AS remapped
          ORDER BY new_value, ordinality
        ) AS mapped
      ),
      false
    )
    WHERE cs."sectionType" = 'caseReport'
      AND cs."accountSid" = :accountSid
      AND jsonb_typeof(cs."sectionTypeSpecificData"->'informationProvided') = 'array'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(cs."sectionTypeSpecificData"->'informationProvided') AS entry(value)
        WHERE value = 'Employment or Education Resources'
      );
  `,
  `
    UPDATE "CaseSections" cs
    SET "sectionTypeSpecificData" = jsonb_set(
      cs."sectionTypeSpecificData",
      '{referralProvided}',
      (
        SELECT COALESCE(jsonb_agg(to_jsonb(mapped.value) ORDER BY mapped.ordinality), '[]'::jsonb)
        FROM (
          SELECT DISTINCT ON (new_value) new_value AS value, ordinality
          FROM (
            SELECT CASE value
              WHEN 'Mental Health Provider: DMH' THEN 'Mental Health Provider: DMH Portal'
              ELSE value
            END AS new_value, ordinality
            FROM jsonb_array_elements_text(cs."sectionTypeSpecificData"->'referralProvided')
              WITH ORDINALITY AS entry(value, ordinality)
          ) AS remapped
          ORDER BY new_value, ordinality
        ) AS mapped
      ),
      false
    )
    WHERE cs."sectionType" = 'caseReport'
      AND cs."accountSid" = :accountSid
      AND jsonb_typeof(cs."sectionTypeSpecificData"->'referralProvided') = 'array'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(cs."sectionTypeSpecificData"->'referralProvided') AS entry(value)
        WHERE value = 'Mental Health Provider: DMH'
      );
  `,
  `
    UPDATE "CaseSections" cs
    SET "sectionTypeSpecificData" = jsonb_set(
      cs."sectionTypeSpecificData",
      '{serviceObtained}',
      (
        SELECT COALESCE(jsonb_agg(to_jsonb(mapped.value) ORDER BY mapped.ordinality), '[]'::jsonb)
        FROM (
          SELECT DISTINCT ON (new_value) new_value AS value, ordinality
          FROM (
            SELECT CASE value
              WHEN 'Established Employment' THEN 'Employment/Education Enrollment Established'
              WHEN 'Benefits Established: CalFresh' THEN 'Established Benefits : CalFresh '
              WHEN 'Benefits Established: General Relief' THEN 'Established Benefits : CalWorks '
              WHEN 'Benefits Established: MediCal' THEN 'Established Benefits : GR '
              WHEN 'Benefits Established: Social Security Benefits (SSI/SSDI/SSA)'
                THEN 'Established Benefits : MediCal '
              WHEN 'Behavioral Health: Established mental health provider'
                THEN 'Mental Health Care '
              WHEN 'SUD Treatment: Collaborative' THEN 'SUD Treatment : Collaborative'
              WHEN 'SUD Treatment: Other' THEN 'SUD Treatment : Other'
              WHEN 'Benefits Established: Veterans Services/Benefits'
                THEN 'Veterans Services/Benefits'
              ELSE value
            END AS new_value, ordinality
            FROM jsonb_array_elements_text(cs."sectionTypeSpecificData"->'serviceObtained')
              WITH ORDINALITY AS entry(value, ordinality)
          ) AS remapped
          ORDER BY new_value, ordinality
        ) AS mapped
      ),
      false
    )
    WHERE cs."sectionType" = 'caseReport'
      AND cs."accountSid" = :accountSid
      AND jsonb_typeof(cs."sectionTypeSpecificData"->'serviceObtained') = 'array'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(cs."sectionTypeSpecificData"->'serviceObtained') AS entry(value)
        WHERE value IN (
          'Established Employment',
          'Benefits Established: CalFresh',
          'Benefits Established: General Relief',
          'Benefits Established: MediCal',
          'Benefits Established: Social Security Benefits (SSI/SSDI/SSA)',
          'Behavioral Health: Established mental health provider',
          'SUD Treatment: Collaborative',
          'SUD Treatment: Other',
          'Benefits Established: Veterans Services/Benefits'
        )
      );
  `,
  `
    UPDATE "CaseSections" cs
    SET "sectionTypeSpecificData" = jsonb_set(
      cs."sectionTypeSpecificData",
      '{issueReport}',
      (
        SELECT COALESCE(jsonb_agg(to_jsonb(mapped.value) ORDER BY mapped.ordinality), '[]'::jsonb)
        FROM (
          SELECT DISTINCT ON (new_value) new_value AS value, ordinality
          FROM (
            SELECT CASE value
              WHEN 'Deceased person discovered / Death witnessed'
                THEN 'Deceased person discovered /Death witnessed'
              WHEN 'Intervention request made to Child Protective Services'
                THEN 'Intervention request made to Child Protective Services.'
              WHEN 'The filing of a police report' THEN 'The filing of a police report;'
              ELSE value
            END AS new_value, ordinality
            FROM jsonb_array_elements_text(cs."sectionTypeSpecificData"->'issueReport')
              WITH ORDINALITY AS entry(value, ordinality)
          ) AS remapped
          ORDER BY new_value, ordinality
        ) AS mapped
      ),
      false
    )
    WHERE cs."sectionType" = 'caseReport'
      AND cs."accountSid" = :accountSid
      AND jsonb_typeof(cs."sectionTypeSpecificData"->'issueReport') = 'array'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(cs."sectionTypeSpecificData"->'issueReport') AS entry(value)
        WHERE value IN (
          'Deceased person discovered / Death witnessed',
          'Intervention request made to Child Protective Services',
          'The filing of a police report'
        )
      );
  `,
  `
    UPDATE "CaseSections" cs
    SET "sectionTypeSpecificData" = jsonb_set(
      cs."sectionTypeSpecificData",
      '{substancesUsed}',
      (
        SELECT COALESCE(jsonb_agg(to_jsonb(mapped.value) ORDER BY mapped.ordinality), '[]'::jsonb)
        FROM (
          SELECT DISTINCT ON (new_value) new_value AS value, ordinality
          FROM (
            SELECT CASE value
              WHEN 'Cannabis (marijuana, pot, grass, hash, etc.) '
                THEN 'Cannabis (marijuana, pot, grass, hash, etc.)'
              WHEN 'Cocaine (coke, crack, etc.) ' THEN 'Cocaine (coke, crack, etc.)'
              WHEN 'Inhalants (nitrous, glue, petrol, paint thinner, etc.) '
                THEN 'Inhalants (nitrous, glue, petrol, paint thinner, etc.)'
              WHEN 'Sedatives or Sleeping Pills (Valium, Serepax, Rohypnol, etc.) '
                THEN 'Sedatives or Sleeping Pills (Valium, Serepax, Rohypnol, etc.)'
              WHEN 'Opioids (heroin, morphine, methadone, codeine, fentanyl etc.) '
                THEN 'Opioids (heroin, morphine, methadone, codeine, fentanyl etc.)'
              ELSE value
            END AS new_value, ordinality
            FROM jsonb_array_elements_text(cs."sectionTypeSpecificData"->'substancesUsed')
              WITH ORDINALITY AS entry(value, ordinality)
          ) AS remapped
          ORDER BY new_value, ordinality
        ) AS mapped
      ),
      false
    )
    WHERE cs."sectionType" = 'sudSurvey'
      AND cs."accountSid" = :accountSid
      AND jsonb_typeof(cs."sectionTypeSpecificData"->'substancesUsed') = 'array'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(cs."sectionTypeSpecificData"->'substancesUsed') AS entry(value)
        WHERE value IN (
          'Cannabis (marijuana, pot, grass, hash, etc.) ',
          'Cocaine (coke, crack, etc.) ',
          'Inhalants (nitrous, glue, petrol, paint thinner, etc.) ',
          'Sedatives or Sleeping Pills (Valium, Serepax, Rohypnol, etc.) ',
          'Opioids (heroin, morphine, methadone, codeine, fentanyl etc.) '
        )
      );
  `,
];

const runQueries = async (queryInterface, queries, accountSid) => {
  for (const query of queries) {
    // Keep each field update separate so failed/partial runs can be safely repeated.
    // eslint-disable-next-line no-await-in-loop
    await queryInterface.sequelize.query(query, { replacements: { accountSid } });
  }
};

const getUscrAccountSid = async () => {
  const environment = process.env.NODE_ENV;
  if (!['production', 'staging'].includes(environment)) return undefined;
  return getTwilioAccountSid({ shortCode: 'USCR', environment });
};

module.exports = {
  up: async queryInterface => {
    const accountSid = await getUscrAccountSid();
    if (accountSid) await runQueries(queryInterface, upQueries, accountSid);
  },
  down: async queryInterface => {
    const accountSid = await getUscrAccountSid();
    if (accountSid) await runQueries(queryInterface, downQueries, accountSid);
  },
};
