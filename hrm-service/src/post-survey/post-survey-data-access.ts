export type NewPostSurvey = {
  accountSid: string,
  contactTaskId: string,
  taskId: string,
  data: Record<string, any>
}

export type PostSurvey = NewPostSurvey & {
  id: string,
  createdAt: string,
}