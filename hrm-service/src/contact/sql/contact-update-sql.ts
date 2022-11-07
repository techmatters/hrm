import { selectSingleContactByIdSql } from './contact-get-sql';

const ID_WHERE_CLAUSE = `WHERE "accountSid" = $<accountSid> AND "id"=$<contactId>`;

export const UPDATE_RAWJSON_BY_ID = `WITH updated AS (
UPDATE "Contacts" 
SET "rawJson" = COALESCE("rawJson", '{}'::JSONB) 
-- Case Information and / or category patch
  || (
  -- non category case information supplied
      CASE WHEN $<caseInformation> IS NOT NULL 
      THEN (
        jsonb_build_object(
          'caseInformation', 
          $<caseInformation>::JSONB || 
          CASE WHEN $<categories> IS NOT NULL 
          THEN 
            -- New categories are supplied along with new case information, so overwrite those too
            jsonb_build_object('categories', $<categories>::JSONB) 
          ELSE 
            -- Ensure the existing categories are retained if no new ones are supplied
            CASE WHEN "rawJson"->'caseInformation'->'categories' IS NOT NULL THEN jsonb_build_object('categories', "rawJson"->'caseInformation'->'categories') ELSE '{}'::JSONB END
          END
        )
      ) 
      ELSE 
        CASE WHEN $<categories> IS NOT NULL 
        -- New categories are supplied but not other case information, so overwrite the categories property whilst leaving all the other case information properties as is.
        THEN jsonb_build_object('caseInformation', COALESCE("rawJson"->'caseInformation', '{}'::JSONB) || jsonb_build_object('categories', $<categories>::JSONB))
        ELSE '{}'::JSONB END 
      END
  )
  || (CASE WHEN $<callerInformation> IS NOT NULL THEN jsonb_build_object('callerInformation', $<callerInformation>::JSONB) ELSE '{}'::JSONB END)
  || (CASE WHEN $<childInformation> IS NOT NULL THEN jsonb_build_object('childInformation', $<childInformation>::JSONB) ELSE '{}'::JSONB END),
  "updatedBy" = $<updatedBy>,
  "updatedAt" = CURRENT_TIMESTAMP
${ID_WHERE_CLAUSE}
RETURNING *
)
${selectSingleContactByIdSql('updated')}
`;

export const UPDATE_CASEID_BY_ID = `WITH updated AS (
UPDATE "Contacts" 
SET 
  "caseId" = $<caseId>
${ID_WHERE_CLAUSE}
RETURNING *
)
${selectSingleContactByIdSql('updated')}
`;

export const UPDATE_CONVERSATION_MEDIA_BY_ID = `
  UPDATE "Contacts"
  SET
    "rawJson" = COALESCE("rawJson", '{}'::JSONB) || jsonb_build_object('conversationMedia', COALESCE($<conversationMedia:json>::JSONB, "rawJson"->'conversationMedia', '[]'::JSONB))
  ${ID_WHERE_CLAUSE}
`;
