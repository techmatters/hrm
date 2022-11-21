export const SELECT_POST_SURVEYS_BY_CONTACT_TASK = `
  SELECT     
    "contactTaskId",
    "accountSid",
    "taskId",
    "data",
    "createdAt",
    "updatedAt" 
  FROM "PostSurveys" AS ps
  WHERE ps."accountSid" = $<accountSid> AND ps."contactTaskId" = $<contactTaskId>
`;
