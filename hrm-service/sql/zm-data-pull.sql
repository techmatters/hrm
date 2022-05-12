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