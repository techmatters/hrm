import { newErrorResult, newSuccessResult } from '@tech-matters/types';

export type CallHrmApiParameters = {
  urlPath: string;
  authHeader: string;
  requestData?: any;
};

const callHrmApi = async ({ urlPath, requestData, authHeader }: CallHrmApiParameters) => {
  const body = requestData ? JSON.stringify(requestData) : undefined;

  // @ts-ignore global fetch available because node 18
  const response = await fetch(`${process.env.HRM_BASE_URL}/${urlPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    },
    body,
  });

  if (!response.ok) {
    const error = await response.json();
    return newErrorResult({
      message: error.message,
      statusCode: response.status,
    });
  }

  const result = await response.json();
  return newSuccessResult({ result });
};

export default callHrmApi;
