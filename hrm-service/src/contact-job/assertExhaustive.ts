// Function to test that there are no unhandled cases in a switch statement
export const assertExhaustive = (param: never) => {
  const exhaustiveCheck: never = param;
  throw new Error(`Unhandled case: ${exhaustiveCheck}`);
};
