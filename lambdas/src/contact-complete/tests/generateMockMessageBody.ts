const accountSids = ['testSid1', 'testSid2'];

export const generateMockMessageBody = () => {
  const accountSid = accountSids[Math.floor(Math.random() * accountSids.length)];
  const filePath = `accountSid/testFilePath-${Math.floor(Math.random() * 1000000)}`;
  return {
    jobId: Math.floor(Math.random() * 1000000),
    accountSid,
    contactId: Math.floor(Math.random() * 1000000),
    jobType: 'retrieve-contact-transcript',
    filePath,
    completionPayload: filePath,
  };
};
