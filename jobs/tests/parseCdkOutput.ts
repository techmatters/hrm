import cdkOutput from '../cdk/outputs.json';

export const getStackOutput = (id: string) => {
  return cdkOutput[id as keyof typeof cdkOutput];
};
