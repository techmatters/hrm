// eslint-disable-next-line import/no-extraneous-dependencies
import { Mockttp, getLocal, generateCACertificate } from 'mockttp';
// eslint-disable-next-line import/no-extraneous-dependencies
import { createGlobalProxyAgent } from 'global-agent';

let mockServer: Mockttp;

async function mockttpServer() {
  if (!mockServer) {
    console.log('CREATING ENDPOINT SERVER');
    const https = await generateCACertificate();
    // Just wave through them self signed certs... :-/
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    mockServer = getLocal({ https });
  }
  return mockServer;
}

export async function start(): Promise<void> {
  const server = await mockttpServer();
  await server.start();
  console.log('STARTED ENDPOINT SERVER');
  await server.forAnyRequest().thenPassThrough();
  const global = createGlobalProxyAgent();
  // Filter local requests out from proxy to prevent loops.
  global.NO_PROXY = 'localhost*,127.0.*,local.home*';
  global.HTTP_PROXY = `http://localhost:${server.port}`;
}

export async function stop(): Promise<void> {
  const server = await mockttpServer();
  await server.stop();
}

type TokenValidatorResponse = {
  worker_sid: string;
  roles: string[];
};

const twilioIamAnyAccountPattern: RegExp = /https:\/\/iam.twilio.com\/v1\/Accounts\/.+\/Tokens\/validate/;

export async function mockSuccessfulTwilioAuthentication(
  mockWorkerSid: string = 'worker-sid',
  mockRoles: string[] = [],
  accountSid: string | undefined = undefined,
): Promise<void> {
  const server = await mockttpServer();
  server.reset();
  await server.forAnyRequest().thenPassThrough();
  await server
    .forPost(
      accountSid
        ? `https://iam.twilio.com/v1/Accounts/${accountSid}/Tokens/validate`
        : twilioIamAnyAccountPattern,
    )
    .thenJson(200, <TokenValidatorResponse>{
      worker_sid: mockWorkerSid,
      roles: mockRoles,
      valid: true,
    });
}
