export const assertExhaustive = (param: never) => {
  const exhaustiveCheck: never = param;
  throw new Error(`Unhandled case: ${exhaustiveCheck}`);
};
