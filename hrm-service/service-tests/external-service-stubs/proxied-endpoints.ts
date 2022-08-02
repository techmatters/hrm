import { Mockttp, getLocal, generateCACertificate } from 'mockttp';

let mockServer: Mockttp;

async function mockttpServer() {
  if (!mockServer) {
    const https = await generateCACertificate();
    mockServer = getLocal({ https });
  }
  return mockServer;
}

export async function start(): Promise<void> {
  const server = await mockttpServer();
  await server.start(8088);
  await server.forAnyRequest().thenPassThrough();
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
  await server
    .forPost(
      accountSid
        ? `https://iam.twilio.com/v1/Accounts/${accountSid}/Tokens/validate`
        : twilioIamAnyAccountPattern,
    )
    .thenJson(200, <TokenValidatorResponse>{
      worker_sid: mockWorkerSid,
      roles: mockRoles,
    });
}
