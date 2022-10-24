jest.mock('aws-sdk', () => {
  const SQSMocked = {
    sendMessage: jest.fn(() => {
      return {
        promise: jest.fn().mockResolvedValue({ MessageId: '12345' }),
      };
    }),
    receiveMessage: jest.fn(() => {
      return {
        promise: jest.fn().mockResolvedValue({
          Messages: [],
        }),
      };
    }),
    promise: jest.fn(),
  };
  return {
    SQS: jest.fn(() => SQSMocked),
  };
});

jest.mock('@tech-matters/hrm-ssm-cache');
