// eslint-disable-next-line import/no-extraneous-dependencies
import { fetch } from 'undici';

declare global {
  var fetch: typeof import('undici').fetch;
}

const LOCAL_PRIVATEAI_URI_ENDPOINT = new URL(
  'http://localhost:8080/v3/process/files/uri',
);
const LOCAL_PRIVATEAI_HEALTH_ENDPOINT = new URL('http://localhost:8080/healthz');
const MAX_STARTUP_TIME_MILLIS = 10 * 60 * 1000;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const waitForPrivateAiToBeReady = async () => {
  let isReady = false;
  let timeoutTime = Date.now() + MAX_STARTUP_TIME_MILLIS;
  while (!isReady) {
    const response = await fetch(LOCAL_PRIVATEAI_HEALTH_ENDPOINT);
    if (response.ok) {
      isReady = true;
    }
    if (Date.now() > timeoutTime) {
      throw new Error('Private AI did not start in time');
    }
    console.log(
      `Waiting for ${Math.round(
        timeoutTime - Date.now() / 1000,
      )} more seconds for Private AI to be ready...`,
    );
    await delay(5000);
  }
};

export const executeTask = async () => {
  await waitForPrivateAiToBeReady();
  await fetch(LOCAL_PRIVATEAI_URI_ENDPOINT, {
    method: 'POST',
    body: JSON.stringify({ uri: '/samples/sample1.json' }),
  });
};

executeTask().catch(console.error);
