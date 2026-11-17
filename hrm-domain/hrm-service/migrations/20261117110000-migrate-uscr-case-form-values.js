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
    'Engaged - [DMH] Emergency Services Requested':
      'Emergency Services Requested: DMH',
    'Returned to 911 - Out of Scope': 'Returned to 911: Out of Scope',
    'Returned to 911 - Out of Area': 'Returned to 911: Out of Area',
  },
};

const multiselectMappings = {
  tangibleResourcesProvided: {
    'Transportation: CIRCLE Team Transport':
      'Transportation: CIRCLE Team Transport ',
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
};

const quoteSql = value => `'${value.replace(/'/g, "''")}'`;
const reverseFieldMappings = mappings =>
  Object.fromEntries(
    Object.entries(mappings).map(([field, fieldMappings]) => [
      field,
      Object.fromEntries(
        Object.entries(fieldMappings).map(([oldValue, newValue]) => [
          newValue,
          oldValue,
        ]),
      ),
    ]),
  );

const updateScalar = (field, mappings) => {
  const cases = Object.entries(mappings)
    .map(([oldValue, newValue]) => `WHEN ${quoteSql(oldValue)} THEN ${quoteSql(newValue)}`)
    .join('\n          ');
  const values = Object.keys(mappings).map(quoteSql).join(', ');

  return `
    UPDATE "Cases"
    SET "info" = jsonb_set(
      "info",
      '{${field}}',
      to_jsonb(CASE "info"->>'${field}' ${cases} END),
      false
    )
    WHERE "info"->>'${field}' IN (${values});
  `;
};

const updateMultiselect = (field, mappings) => {
  const oldValues = Object.keys(mappings);
  const removeValues = oldValues.map(quoteSql).join(', ');
  const replaceValues = Object.entries(mappings)
    .map(
      ([oldValue, newValue]) =>
        `${quoteSql(newValue)}, ` +
        `(COALESCE(("info"->'${field}'->>${quoteSql(newValue)})::boolean, false) OR ` +
        `COALESCE(("info"->'${field}'->>${quoteSql(oldValue)})::boolean, false))`,
    )
    .join(',\n        ');
  const oldValueArray = oldValues.map(quoteSql).join(', ');

  return `
    UPDATE "Cases"
    SET "info" = jsonb_set(
      "info",
      '{${field}}',
      (("info"->'${field}') - ARRAY[${removeValues}]::text[]) ||
        jsonb_build_object(${replaceValues}),
      false
    )
    WHERE jsonb_typeof("info"->'${field}') = 'object'
      AND ("info"->'${field}') ?| ARRAY[${oldValueArray}]::text[];
  `;
};

const migrateValues = async (queryInterface, mappings, update) => {
  for (const [field, fieldMappings] of Object.entries(mappings)) {
    // Keep each field update separate so failed/partial runs can be safely repeated.
    // eslint-disable-next-line no-await-in-loop
    await queryInterface.sequelize.query(update(field, fieldMappings));
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
      reverseFieldMappings(scalarMappings),
      updateScalar,
    );
    await migrateValues(
      queryInterface,
      reverseFieldMappings(multiselectMappings),
      updateMultiselect,
    );
  },
};
