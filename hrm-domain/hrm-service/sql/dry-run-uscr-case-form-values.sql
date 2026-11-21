-- Copyright (C) 2021-2026 Technology Matters
-- This program is free software: you can redistribute it and/or modify
-- it under the terms of the GNU Affero General Public License as published
-- by the Free Software Foundation, either version 3 of the License, or
-- (at your option) any later version.
--
-- This program is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
-- GNU Affero General Public License for more details.
--
-- You should have received a copy of the GNU Affero General Public License
-- along with this program.  If not, see https://www.gnu.org/licenses/.

-- Dry run for migration 20261117110000-migrate-uscr-case-form-values.js.
-- These SELECT statements show the old and new values without modifying data.

SELECT
  "caseId",
  "sectionId",
  'caseReport' AS "sectionType",
  'primaryDisposition' AS field,
  "sectionTypeSpecificData"->>'primaryDisposition' AS "oldValue",
  CASE "sectionTypeSpecificData"->>'primaryDisposition'
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
  END AS "newValue"
FROM "CaseSections"
WHERE "sectionType" = 'caseReport'
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

SELECT cs."caseId", cs."sectionId", cs."sectionType", 'tangibleResourcesProvided' AS field,
       element.value AS "oldValue",
       CASE element.value
         WHEN 'Transportation: CIRCLE Team Transport'
           THEN 'Transportation: CIRCLE Team Transport '
       END AS "newValue"
FROM "CaseSections" cs
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(cs."sectionTypeSpecificData"->'tangibleResourcesProvided') = 'array'
    THEN cs."sectionTypeSpecificData"->'tangibleResourcesProvided' ELSE '[]'::jsonb END
) AS element(value)
WHERE cs."sectionType" = 'caseReport'
  AND element.value = 'Transportation: CIRCLE Team Transport';

SELECT cs."caseId", cs."sectionId", cs."sectionType", 'informationProvided' AS field,
       element.value AS "oldValue",
       CASE element.value
         WHEN 'Employment or Education Services' THEN 'Employment or Education Resources'
       END AS "newValue"
FROM "CaseSections" cs
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(cs."sectionTypeSpecificData"->'informationProvided') = 'array'
    THEN cs."sectionTypeSpecificData"->'informationProvided' ELSE '[]'::jsonb END
) AS element(value)
WHERE cs."sectionType" = 'caseReport'
  AND element.value = 'Employment or Education Services';

SELECT cs."caseId", cs."sectionId", cs."sectionType", 'referralProvided' AS field,
       element.value AS "oldValue",
       CASE element.value
         WHEN 'Mental Health Provider: DMH Portal' THEN 'Mental Health Provider: DMH'
       END AS "newValue"
FROM "CaseSections" cs
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(cs."sectionTypeSpecificData"->'referralProvided') = 'array'
    THEN cs."sectionTypeSpecificData"->'referralProvided' ELSE '[]'::jsonb END
) AS element(value)
WHERE cs."sectionType" = 'caseReport'
  AND element.value = 'Mental Health Provider: DMH Portal';

SELECT cs."caseId", cs."sectionId", cs."sectionType", 'serviceObtained' AS field,
       element.value AS "oldValue",
       CASE element.value
         WHEN 'Employment/Education Enrollment Established' THEN 'Established Employment'
         WHEN 'Established Benefits : CalFresh ' THEN 'Benefits Established: CalFresh'
         WHEN 'Established Benefits : CalWorks ' THEN 'Benefits Established: General Relief'
         WHEN 'Established Benefits : GR ' THEN 'Benefits Established: MediCal'
         WHEN 'Established Benefits : MediCal ' THEN 'Benefits Established: Social Security Benefits (SSI/SSDI/SSA)'
         WHEN 'Mental Health Care ' THEN 'Behavioral Health: Established mental health provider'
         WHEN 'SUD Treatment : Collaborative' THEN 'SUD Treatment: Collaborative'
         WHEN 'SUD Treatment : Other' THEN 'SUD Treatment: Other'
         WHEN 'Veterans Services/Benefits' THEN 'Benefits Established: Veterans Services/Benefits'
       END AS "newValue"
FROM "CaseSections" cs
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(cs."sectionTypeSpecificData"->'serviceObtained') = 'array'
    THEN cs."sectionTypeSpecificData"->'serviceObtained' ELSE '[]'::jsonb END
) AS element(value)
WHERE cs."sectionType" = 'caseReport'
  AND element.value IN (
    'Employment/Education Enrollment Established',
    'Established Benefits : CalFresh ',
    'Established Benefits : CalWorks ',
    'Established Benefits : GR ',
    'Established Benefits : MediCal ',
    'Mental Health Care ',
    'SUD Treatment : Collaborative',
    'SUD Treatment : Other',
    'Veterans Services/Benefits'
  );

SELECT cs."caseId", cs."sectionId", cs."sectionType", 'issueReport' AS field,
       element.value AS "oldValue",
       CASE element.value
         WHEN 'Deceased person discovered /Death witnessed'
           THEN 'Deceased person discovered / Death witnessed'
         WHEN 'Intervention request made to Child Protective Services.'
           THEN 'Intervention request made to Child Protective Services'
         WHEN 'The filing of a police report;' THEN 'The filing of a police report'
       END AS "newValue"
FROM "CaseSections" cs
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(cs."sectionTypeSpecificData"->'issueReport') = 'array'
    THEN cs."sectionTypeSpecificData"->'issueReport' ELSE '[]'::jsonb END
) AS element(value)
WHERE cs."sectionType" = 'caseReport'
  AND element.value IN (
    'Deceased person discovered /Death witnessed',
    'Intervention request made to Child Protective Services.',
    'The filing of a police report;'
  );

SELECT cs."caseId", cs."sectionId", cs."sectionType", 'substancesUsed' AS field,
       element.value AS "oldValue",
       CASE element.value
         WHEN 'Cannabis (marijuana, pot, grass, hash, etc.)' THEN 'Cannabis (marijuana, pot, grass, hash, etc.) '
         WHEN 'Cocaine (coke, crack, etc.)' THEN 'Cocaine (coke, crack, etc.) '
         WHEN 'Inhalants (nitrous, glue, petrol, paint thinner, etc.)' THEN 'Inhalants (nitrous, glue, petrol, paint thinner, etc.) '
         WHEN 'Sedatives or Sleeping Pills (Valium, Serepax, Rohypnol, etc.)' THEN 'Sedatives or Sleeping Pills (Valium, Serepax, Rohypnol, etc.) '
         WHEN 'Opioids (heroin, morphine, methadone, codeine, fentanyl etc.)' THEN 'Opioids (heroin, morphine, methadone, codeine, fentanyl etc.) '
       END AS "newValue"
FROM "CaseSections" cs
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(cs."sectionTypeSpecificData"->'substancesUsed') = 'array'
    THEN cs."sectionTypeSpecificData"->'substancesUsed' ELSE '[]'::jsonb END
) AS element(value)
WHERE cs."sectionType" = 'sudSurvey'
  AND element.value IN (
    'Cannabis (marijuana, pot, grass, hash, etc.)',
    'Cocaine (coke, crack, etc.)',
    'Inhalants (nitrous, glue, petrol, paint thinner, etc.)',
    'Sedatives or Sleeping Pills (Valium, Serepax, Rohypnol, etc.)',
    'Opioids (heroin, morphine, methadone, codeine, fentanyl etc.)'
  );
