export const pollCompletedContactJobsFromQueue = async (): Promise<{
  Messages: { ReceiptHandle: string; Body: string }[];
}> => {
  return {
    Messages: [],
  };
};

export const deleteCompletedContactJobsFromQueue = async (ReceiptHandle: any) => {
  return ReceiptHandle;
};
