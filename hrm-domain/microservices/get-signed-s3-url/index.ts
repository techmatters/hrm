import type { ALBEvent, ALBResult } from 'aws-lambda';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
};

export const handler = async (event: ALBEvent): Promise<ALBResult> => {
  if (event.httpMethod === 'GET') {
    try {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: 'success' }),
      };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify(err),
      };
    }
  }

  // Send HTTP 405: Method Not Allowed
  return {
    statusCode: 405,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Error: Method Not Allowed' }),
  };
};
