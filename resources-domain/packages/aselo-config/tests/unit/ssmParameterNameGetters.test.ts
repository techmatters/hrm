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

import {
  getResourcesImportApiAuthHeaderSsmPath,
  getResourcesImportApiBaseUrlSsmPath,
  getResourcesImportApiKeySsmPath,
  getResourcesSearchIndexQueueUrlSsmPath,
  getTwilioShortHelplineSsmPath,
} from '../../ssmParameterNameGetters';

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.AWS_REGION = 'us-east-1';
});

test('builds resources-specific SSM paths', () => {
  expect(getTwilioShortHelplineSsmPath({ accountSid: 'AC123' })).toBe(
    '/test/twilio/AC123/short_helpline',
  );
  expect(getResourcesSearchIndexQueueUrlSsmPath({})).toBe(
    '/test/us-east-1/sqs/jobs/hrm-resources-search/queue-url-index',
  );
  expect(getResourcesImportApiBaseUrlSsmPath({ accountSid: 'AC123' })).toBe(
    '/test/resources/AC123/import_api/base_url',
  );
  expect(getResourcesImportApiKeySsmPath({ accountSid: 'AC123' })).toBe(
    '/test/resources/AC123/import_api/api_key',
  );
  expect(getResourcesImportApiAuthHeaderSsmPath({ accountSid: 'AC123' })).toBe(
    '/test/resources/AC123/import_api/auth_header',
  );
});
