export const retryable = <TParams, T>(
  action: (params: TParams) => Promise<T>,
  failValue: T = undefined,
) => {
  const retryableAction = async (params: TParams, retryCount = 0): Promise<T> => {
    let result: T = failValue;
    try {
      result = await action(params);
    } catch (err) {
      if (retryCount < 60) {
        await new Promise(resolve => setTimeout(resolve, 250));
        return retryableAction(params, retryCount + 1);
      }
    }

    return result;
  };
  return retryableAction;
};