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

import { getSsmParameter } from '@tech-matters/ssm-cache';
import {
  getResourcesSearchIndexQueueUrl,
  getResourcesSearchIndexQueueUrlSsmPath,
} from '../../../src/resources-jobs/config';

jest.mock('@tech-matters/ssm-cache', () => ({ getSsmParameter: jest.fn() }));

test('preserves the queue path and forwards the cache duration', async () => {
  const originalEnvironment = process.env.NODE_ENV;
  const originalRegion = process.env.AWS_REGION;
  process.env.NODE_ENV = 'test';
  process.env.AWS_REGION = 'us-east-1';
  try {
    const path = '/test/us-east-1/sqs/jobs/hrm-resources-search/queue-url-index';
    expect(getResourcesSearchIndexQueueUrlSsmPath({})).toBe(path);
    (getSsmParameter as jest.Mock).mockResolvedValue('the-value');
    await expect(
      getResourcesSearchIndexQueueUrl({ cacheDurationMilliseconds: 1200 }),
    ).resolves.toBe('the-value');
    expect(getSsmParameter).toHaveBeenCalledWith(path, 1200, undefined);
  } finally {
    if (originalEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnvironment;
    if (originalRegion === undefined) delete process.env.AWS_REGION;
    else process.env.AWS_REGION = originalRegion;
  }
});
