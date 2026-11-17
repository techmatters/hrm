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
       element.value AS "oldValue", 'Transportation: CIRCLE Team Transport ' AS "newValue"
FROM "CaseSections" cs
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(cs."sectionTypeSpecificData"->'tangibleResourcesProvided') = 'array'
    THEN cs."sectionTypeSpecificData"->'tangibleResourcesProvided' ELSE '[]'::jsonb END
) AS element(value)
WHERE cs."sectionType" = 'caseReport'
  AND element.value = 'Transportation: CIRCLE Team Transport';

SELECT cs."caseId", cs."sectionId", cs."sectionType", 'informationProvided' AS field,
       element.value AS "oldValue", 'Employment or Education Resources' AS "newValue"
FROM "CaseSections" cs
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(cs."sectionTypeSpecificData"->'informationProvided') = 'array'
    THEN cs."sectionTypeSpecificData"->'informationProvided' ELSE '[]'::jsonb END
) AS element(value)
WHERE cs."sectionType" = 'caseReport'
  AND element.value = 'Employment or Education Services';

SELECT cs."caseId", cs."sectionId", cs."sectionType", 'referralProvided' AS field,
       element.value AS "oldValue", 'Mental Health Provider: DMH' AS "newValue"
FROM "CaseSections" cs
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(cs."sectionTypeSpecificData"->'referralProvided') = 'array'
    THEN cs."sectionTypeSpecificData"->'referralProvided' ELSE '[]'::jsonb END
) AS element(value)
WHERE cs."sectionType" = 'caseReport'
  AND element.value = 'Mental Health Provider: DMH Portal';

SELECT cs."caseId", cs."sectionId", cs."sectionType", 'serviceObtained' AS field,
       element.value AS "oldValue", mapping.new_value AS "newValue"
FROM "CaseSections" cs
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(cs."sectionTypeSpecificData"->'serviceObtained') = 'array'
    THEN cs."sectionTypeSpecificData"->'serviceObtained' ELSE '[]'::jsonb END
) AS element(value)
JOIN (VALUES
  ('Employment/Education Enrollment Established', 'Established Employment'),
  ('Established Benefits : CalFresh', 'Benefits Established: CalFresh'),
  ('Established Benefits : CalWorks', 'Benefits Established: General Relief'),
  ('Established Benefits : GR', 'Benefits Established: MediCal'),
  ('Established Benefits : MediCal', 'Benefits Established: Social Security Benefits (SSI/SSDI/SSA)'),
  ('Mental Health Care ', 'Behavioral Health: Established mental health provider'),
  ('SUD Treatment : Collaborative', 'SUD Treatment: Collaborative'),
  ('SUD Treatment : Other', 'SUD Treatment: Other'),
  ('Veterans Services/Benefits', 'Benefits Established: Veterans Services/Benefits')
) AS mapping(old_value, new_value) ON element.value = mapping.old_value
WHERE cs."sectionType" = 'caseReport';

SELECT cs."caseId", cs."sectionId", cs."sectionType", 'issueReport' AS field,
       element.value AS "oldValue", mapping.new_value AS "newValue"
FROM "CaseSections" cs
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(cs."sectionTypeSpecificData"->'issueReport') = 'array'
    THEN cs."sectionTypeSpecificData"->'issueReport' ELSE '[]'::jsonb END
) AS element(value)
JOIN (VALUES
  ('Deceased person discovered /Death witnessed', 'Deceased person discovered / Death witnessed'),
  ('Intervention request made to Child Protective Services.', 'Intervention request made to Child Protective Services'),
  ('The filing of a police report;', 'The filing of a police report')
) AS mapping(old_value, new_value) ON element.value = mapping.old_value
WHERE cs."sectionType" = 'caseReport';

SELECT cs."caseId", cs."sectionId", cs."sectionType", 'substancesUsed' AS field,
       element.value AS "oldValue", mapping.new_value AS "newValue"
FROM "CaseSections" cs
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(cs."sectionTypeSpecificData"->'substancesUsed') = 'array'
    THEN cs."sectionTypeSpecificData"->'substancesUsed' ELSE '[]'::jsonb END
) AS element(value)
JOIN (VALUES
  ('Cannabis (marijuana, pot, grass, hash, etc.)', 'Cannabis (marijuana, pot, grass, hash, etc.) '),
  ('Cocaine (coke, crack, etc.)', 'Cocaine (coke, crack, etc.) '),
  ('Inhalants (nitrous, glue, petrol, paint thinner, etc.)', 'Inhalants (nitrous, glue, petrol, paint thinner, etc.) '),
  ('Sedatives or Sleeping Pills (Valium, Serepax, Rohypnol, etc.)', 'Sedatives or Sleeping Pills (Valium, Serepax, Rohypnol, etc.) '),
  ('Opioids (heroin, morphine, methadone, codeine, fentanyl etc.)', 'Opioids (heroin, morphine, methadone, codeine, fentanyl etc.) ')
) AS mapping(old_value, new_value) ON element.value = mapping.old_value
WHERE cs."sectionType" = 'sudSurvey';
