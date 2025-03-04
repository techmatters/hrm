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

import { handler } from '../../src';
import { Mockttp } from 'mockttp';
import { mockingProxy, mockSsmParameters } from '@tech-matters/testing';

const ACCOUNT_SID = 'ACservicetest';
process.env.BEACON_URL = 'http://google.com';

export const mockParameters = async (mockttp: Mockttp, queueName: string) => {
  await mockSsmParameters(mockttp, [
    {
      name: `/${process.env.NODE_ENV}/hrm/custom-integration/uscr/${ACCOUNT_SID}/latest_beacon_update_seen`,
      valueGenerator: () => queueName,
    },
  ]);
};

afterAll(async () => {
  await mockingProxy.stop();
});

beforeAll(async () => {
  await mockingProxy.start();
});

beforeEach(async () => {
  await mockParameters(await mockingProxy.mockttpServer(), 'queue-url');
});

describe('Beacon Polling Service - polling logic', () => {
  test("Returns less than the maximum records - doesn't query again", async () => {
    await handler();
  });
});
