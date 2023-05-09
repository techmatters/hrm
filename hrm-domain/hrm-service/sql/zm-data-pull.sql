-- Copyright (C) 2021-2023 Technology Matters
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

SELECT 
	"createdAt",
	"twilioWorkerId" as counselor, -- TODO: print counselor name in the future
	"timeOfContact",
	"rawJson"->'childInformation'->>'gender' as gender,
	"rawJson"->'childInformation'->>'age' as age,
	"rawJson"->'childInformation'->>'province' as province,
	"rawJson"->'childInformation'->>'district' as district,
	"rawJson"->'childInformation'->>'phone1' as phone1,
	"rawJson"->'caseInformation'->>'callSummary' as callsummary,
	string_agg('[' || categories.key || ']: ' || subcategories.key, ', ') as categories
FROM
  public."Contacts" contacts
  left join lateral jsonb_each("rawJson"->'caseInformation'->'categories') categories on true
  left join lateral jsonb_each_text(categories.value) subcategories on true
where
  "createdAt" >= '2021-11-01' -- Fill dateFrom
  and "createdAt" < '2021-12-01' -- Fill dateTo (exclusive)
  and "accountSid" = 'XXXXXXXXXX' -- Fill accountSid
  and subcategories.value = 'true'
group by "createdAt", "twilioWorkerId", "timeOfContact", "rawJson" 
order by "createdAt";