export const pollCompletedContactJobs = async (): Promise<{
  Messages: { ReceiptHandle: string; Body: string }[];
}> => {
  return {
    Messages: [],
  };
};

export const deletedCompletedContactJobs = async (ReceiptHandle: any) => {
  return ReceiptHandle;
};
