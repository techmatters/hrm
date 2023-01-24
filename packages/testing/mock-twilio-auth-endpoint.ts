import { mockttpServer } from './mocking-proxy';

type TokenValidatorResponse = {
  worker_sid: string;
  roles: string[];
};

const twilioIamAnyAccountPattern: RegExp = /https:\/\/iam.twilio.com\/v1\/Accounts\/.+\/Tokens\/validate/;

export async function mockSuccessfulTwilioAuthentication(
  mockWorkerSid: string = 'WK-worker-sid',
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
