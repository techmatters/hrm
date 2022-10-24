export const getMockMessage = async ({ lambdaName }: { lambdaName: string }) => {
  const generator = await import(`../src/${lambdaName}/tests/generateMockMessageBody`);
  return generator.generateMockMessageBody();
};
