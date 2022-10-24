jest.mock('aws-sdk', () => {
  const SQSMocked = {
    sendMessage: jest.fn().mockReturnThis(),
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
