/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

import { mockttpServer } from './mocking-proxy';

type TokenValidatorResponse = {
  worker_sid: string;
  roles: string[];
};

const twilioIamAnyAccountPattern: RegExp =
  /https:\/\/iam.twilio.com\/v1\/Accounts\/.+\/Tokens\/validate/;

let priority = 0;

export async function mockSuccessfulTwilioAuthentication(
  mockWorkerSid: string = 'WK-worker-sid',
  mockRoles: string[] = [],
  accountSid: string | undefined = undefined,
): Promise<void> {
  const server = await mockttpServer();
  console.debug(
    'Mocking successful Twilio authentication',
    accountSid,
    mockWorkerSid,
    mockRoles,
  );
  await server
    .forPost(
      accountSid
        ? `https://iam.twilio.com/v1/Accounts/${accountSid}/Tokens/validate`
        : twilioIamAnyAccountPattern,
    )
    .always()
    .asPriority(++priority) // This is to ensure the latest mock is the one that is used
    .thenCallback(async req => {
      const responseBody: TokenValidatorResponse = {
        worker_sid: mockWorkerSid,
        roles: mockRoles,
      };
      console.debug(
        'Twilio authentication request:',
        req.url,
        await req.body.getText(),
        'response:',
        responseBody,
      );
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(responseBody),
      };
    });
}
