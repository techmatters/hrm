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

const scalarMappings = {
  caseReport: {
    primaryDisposition: {
      'Gone on Arrival': 'Gone On Arrival',
      'Engaged - Assisted': 'Engaged: Assisted',
      'Engaged - Unable to assist': 'Engaged: Unable to Assist',
      'Engaged - Return to 911 - Reported issue unresolved':
        'Returned to 911: Reported Issue Unresolved',
      'Engaged - [LAPD] Emergency Services Requested':
        'Emergency Services Requested: LAPD',
      'Engaged - [LAFD/EMS] Emergency Services Requested':
        'Emergency Services Requested: LAFD/EMS',
      'Engaged - [DMH] Emergency Services Requested': 'Emergency Services Requested: DMH',
      'Returned to 911 - Out of Scope': 'Returned to 911: Out of Scope',
      'Returned to 911 - Out of Area': 'Returned to 911: Out of Area',
    },
  },
};

const multiselectMappings = {
  caseReport: {
    tangibleResourcesProvided: {
      'Transportation: CIRCLE Team Transport': 'Transportation: CIRCLE Team Transport ',
    },
    informationProvided: {
      'Employment or Education Services': 'Employment or Education Resources',
    },
    referralProvided: {
      'Mental Health Provider: DMH Portal': 'Mental Health Provider: DMH',
    },
    serviceObtained: {
      'Employment/Education Enrollment Established': 'Established Employment',
      'Established Benefits : CalFresh': 'Benefits Established: CalFresh',
      'Established Benefits : CalWorks': 'Benefits Established: General Relief',
      'Established Benefits : GR': 'Benefits Established: MediCal',
      'Established Benefits : MediCal':
        'Benefits Established: Social Security Benefits (SSI/SSDI/SSA)',
      'Mental Health Care ': 'Behavioral Health: Established mental health provider',
      'SUD Treatment : Collaborative': 'SUD Treatment: Collaborative',
      'SUD Treatment : Other': 'SUD Treatment: Other',
      'Veterans Services/Benefits': 'Benefits Established: Veterans Services/Benefits',
    },
    issueReport: {
      'Deceased person discovered /Death witnessed':
        'Deceased person discovered / Death witnessed',
      'Intervention request made to Child Protective Services.':
        'Intervention request made to Child Protective Services',
      'The filing of a police report;': 'The filing of a police report',
    },
  },
  sudSurvey: {
    substancesUsed: {
      'Cannabis (marijuana, pot, grass, hash, etc.)':
        'Cannabis (marijuana, pot, grass, hash, etc.) ',
      'Cocaine (coke, crack, etc.)': 'Cocaine (coke, crack, etc.) ',
      'Inhalants (nitrous, glue, petrol, paint thinner, etc.)':
        'Inhalants (nitrous, glue, petrol, paint thinner, etc.) ',
      'Sedatives or Sleeping Pills (Valium, Serepax, Rohypnol, etc.)':
        'Sedatives or Sleeping Pills (Valium, Serepax, Rohypnol, etc.) ',
      'Opioids (heroin, morphine, methadone, codeine, fentanyl etc.)':
        'Opioids (heroin, morphine, methadone, codeine, fentanyl etc.) ',
    },
  },
};

const quoteSql = value => `'${value.replace(/'/g, "''")}'`;
const reverseSectionMappings = mappings =>
  Object.fromEntries(
    Object.entries(mappings).map(([sectionType, sectionMappings]) => [
      sectionType,
      Object.fromEntries(
        Object.entries(sectionMappings).map(([field, fieldMappings]) => [
          field,
          Object.fromEntries(
            Object.entries(fieldMappings).map(([oldValue, newValue]) => [
              newValue,
              oldValue,
            ]),
          ),
        ]),
      ),
    ]),
  );

const updateScalar = (sectionType, field, mappings) => {
  const cases = Object.entries(mappings)
    .map(
      ([oldValue, newValue]) => `WHEN ${quoteSql(oldValue)} THEN ${quoteSql(newValue)}`,
    )
    .join('\n          ');
  const values = Object.keys(mappings).map(quoteSql).join(', ');

  return `
    UPDATE "CaseSections"
    SET "sectionTypeSpecificData" = jsonb_set(
      "sectionTypeSpecificData",
      '{${field}}',
      to_jsonb(CASE "sectionTypeSpecificData"->>'${field}' ${cases} END),
      false
    )
    WHERE "sectionType" = ${quoteSql(sectionType)}
      AND "sectionTypeSpecificData"->>'${field}' IN (${values});
  `;
};

const updateMultiselect = (sectionType, field, mappings) => {
  const oldValues = Object.keys(mappings);
  const cases = Object.entries(mappings)
    .map(
      ([oldValue, newValue]) => `WHEN ${quoteSql(oldValue)} THEN ${quoteSql(newValue)}`,
    )
    .join('\n              ');
  const values = oldValues.map(quoteSql).join(', ');

  return `
    UPDATE "CaseSections" cs
    SET "sectionTypeSpecificData" = jsonb_set(
      cs."sectionTypeSpecificData",
      '{${field}}',
      (
        SELECT COALESCE(jsonb_agg(to_jsonb(mapped.value) ORDER BY mapped.ordinality), '[]'::jsonb)
        FROM (
          SELECT DISTINCT ON (mapped_value) mapped_value AS value, ordinality
          FROM (
            SELECT CASE value ${cases} ELSE value END AS mapped_value, ordinality
            FROM jsonb_array_elements_text(cs."sectionTypeSpecificData"->'${field}')
              WITH ORDINALITY AS entry(value, ordinality)
          ) AS remapped
          ORDER BY mapped_value, ordinality
        ) AS mapped
      ),
      false
    )
    WHERE cs."sectionType" = ${quoteSql(sectionType)}
      AND jsonb_typeof(cs."sectionTypeSpecificData"->'${field}') = 'array'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(cs."sectionTypeSpecificData"->'${field}') AS value
        WHERE value IN (${values})
      );
  `;
};

const migrateValues = async (queryInterface, sectionMappings, update) => {
  for (const [sectionType, fieldMappings] of Object.entries(sectionMappings)) {
    for (const [field, mappings] of Object.entries(fieldMappings)) {
      // Keep each field update separate so failed/partial runs can be safely repeated.
      // eslint-disable-next-line no-await-in-loop
      await queryInterface.sequelize.query(update(sectionType, field, mappings));
    }
  }
};

module.exports = {
  up: async queryInterface => {
    await migrateValues(queryInterface, scalarMappings, updateScalar);
    await migrateValues(queryInterface, multiselectMappings, updateMultiselect);
  },
  down: async queryInterface => {
    await migrateValues(
      queryInterface,
      reverseSectionMappings(scalarMappings),
      updateScalar,
    );
    await migrateValues(
      queryInterface,
      reverseSectionMappings(multiselectMappings),
      updateMultiselect,
    );
  },
};
