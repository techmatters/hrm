export class ContactRecord {
  id: number;
  rawJson?: any;
  queueName?: string;
  twilioWorkerId?: string;
  createdBy?: string;
  helpline?: string;
  number?: string;
  channel?: string;
  conversationDuration?: number;
  accountSid: string;
  timeOfContact?: Date;
  taskId?: string;
  channelSid?: string;
  serviceSid?: string;
}

export type Contact = ContactRecord & {
  csamReports: any[]
}