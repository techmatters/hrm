jest.mock('@tech-matters/hrm-ssm-cache');

jest.mock('aws-sdk', () => {
  const SQSMocked = {
    deleteMessage: () => jest.fn(),
    receiveMessage: jest.fn(() => {
      return {
        promise: jest.fn().mockResolvedValue({
          Messages: [],
        }),
      };
    }),
    sendMessage: jest.fn().mockReturnThis(),
    promise: jest.fn(),
  };
  return {
    SQS: jest.fn(() => SQSMocked),
  };
});
