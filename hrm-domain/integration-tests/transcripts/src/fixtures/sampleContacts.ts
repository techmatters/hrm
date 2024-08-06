import { NewContactRecord } from '@tech-matters/hrm-types/Contact';

export const MINIMAL_CONTACT: NewContactRecord = {
  conversationDuration: 0,
  queueName: 'x',
  channel: 'web',
  rawJson: {
    categories: {},
    childInformation: {},
    caseInformation: {},
    callType: 'Child calling about self',
  },
  twilioWorkerId: 'WK-integration-test-counselor',
  taskId: 'TK-integration-test',

  helpline: '',
  number: '',
  timeOfContact: new Date().toISOString(),
  channelSid: '',
  serviceSid: '',
  createdBy: 'WK-integration-test-counselor',
};
