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
  id AS "caseId",
  'primaryDisposition' AS field,
  "info"->>'primaryDisposition' AS "oldValue",
  CASE "info"->>'primaryDisposition'
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
FROM "Cases"
WHERE "info"->>'primaryDisposition' IN (
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

SELECT c.id AS "caseId", 'tangibleResourcesProvided' AS field,
       e.key AS "oldValue", 'Transportation: CIRCLE Team Transport ' AS "newValue",
       e.value AS selected
FROM "Cases" c
CROSS JOIN LATERAL jsonb_each(
  CASE WHEN jsonb_typeof(c."info"->'tangibleResourcesProvided') = 'object'
    THEN c."info"->'tangibleResourcesProvided' ELSE '{}'::jsonb END
) e
WHERE e.key = 'Transportation: CIRCLE Team Transport';

SELECT c.id AS "caseId", 'informationProvided' AS field,
       e.key AS "oldValue", 'Employment or Education Resources' AS "newValue",
       e.value AS selected
FROM "Cases" c
CROSS JOIN LATERAL jsonb_each(
  CASE WHEN jsonb_typeof(c."info"->'informationProvided') = 'object'
    THEN c."info"->'informationProvided' ELSE '{}'::jsonb END
) e
WHERE e.key = 'Employment or Education Services';

SELECT c.id AS "caseId", 'referralProvided' AS field,
       e.key AS "oldValue", 'Mental Health Provider: DMH' AS "newValue",
       e.value AS selected
FROM "Cases" c
CROSS JOIN LATERAL jsonb_each(
  CASE WHEN jsonb_typeof(c."info"->'referralProvided') = 'object'
    THEN c."info"->'referralProvided' ELSE '{}'::jsonb END
) e
WHERE e.key = 'Mental Health Provider: DMH Portal';

SELECT c.id AS "caseId", 'serviceObtained' AS field, e.key AS "oldValue",
       m.new_value AS "newValue", e.value AS selected
FROM "Cases" c
CROSS JOIN LATERAL jsonb_each(
  CASE WHEN jsonb_typeof(c."info"->'serviceObtained') = 'object'
    THEN c."info"->'serviceObtained' ELSE '{}'::jsonb END
) e
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
) AS m(old_value, new_value) ON e.key = m.old_value;

SELECT c.id AS "caseId", 'issueReport' AS field, e.key AS "oldValue",
       m.new_value AS "newValue", e.value AS selected
FROM "Cases" c
CROSS JOIN LATERAL jsonb_each(
  CASE WHEN jsonb_typeof(c."info"->'issueReport') = 'object'
    THEN c."info"->'issueReport' ELSE '{}'::jsonb END
) e
JOIN (VALUES
  ('Deceased person discovered /Death witnessed', 'Deceased person discovered / Death witnessed'),
  ('Intervention request made to Child Protective Services.', 'Intervention request made to Child Protective Services'),
  ('The filing of a police report;', 'The filing of a police report')
) AS m(old_value, new_value) ON e.key = m.old_value;

SELECT c.id AS "caseId", 'substancesUsed' AS field, e.key AS "oldValue",
       m.new_value AS "newValue", e.value AS selected
FROM "Cases" c
CROSS JOIN LATERAL jsonb_each(
  CASE WHEN jsonb_typeof(c."info"->'substancesUsed') = 'object'
    THEN c."info"->'substancesUsed' ELSE '{}'::jsonb END
) e
JOIN (VALUES
  ('Cannabis (marijuana, pot, grass, hash, etc.)', 'Cannabis (marijuana, pot, grass, hash, etc.) '),
  ('Cocaine (coke, crack, etc.)', 'Cocaine (coke, crack, etc.) '),
  ('Inhalants (nitrous, glue, petrol, paint thinner, etc.)', 'Inhalants (nitrous, glue, petrol, paint thinner, etc.) '),
  ('Sedatives or Sleeping Pills (Valium, Serepax, Rohypnol, etc.)', 'Sedatives or Sleeping Pills (Valium, Serepax, Rohypnol, etc.) '),
  ('Opioids (heroin, morphine, methadone, codeine, fentanyl etc.)', 'Opioids (heroin, morphine, methadone, codeine, fentanyl etc.) ')
) AS m(old_value, new_value) ON e.key = m.old_value;
