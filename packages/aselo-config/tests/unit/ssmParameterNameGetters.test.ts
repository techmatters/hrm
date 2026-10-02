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
  getHrmStaticKeySsmPath,
  getS3DocsBucketNameSsmPath,
  getTwilioAccountSidSsmPath,
  getTwilioStaticKeySsmPath,
} from '../../ssmParameterNameGetters';

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.AWS_REGION = 'us-east-1';
});

describe('ssm parameter path getters', () => {
  test('builds account sid paths from uppercase short codes', () => {
    expect(getTwilioAccountSidSsmPath({ shortCode: 'as' })).toBe(
      '/test/twilio/AS/account_sid',
    );
  });

  test('builds HRM service static key paths using environment and region', () => {
    expect(getHrmStaticKeySsmPath({ keyName: 'ADMIN_HRM' })).toBe(
      '/test/hrm/service/us-east-1/static_key/ADMIN_HRM',
    );
  });

  test('builds twilio static key paths using account sid', () => {
    expect(getTwilioStaticKeySsmPath({ accountSid: 'AC123' })).toBe(
      '/test/twilio/AC123/static_key',
    );
  });

  test('builds docs bucket paths using account sid', () => {
    expect(getS3DocsBucketNameSsmPath({ accountSid: 'AC123' })).toBe(
      '/test/s3/AC123/docs_bucket_name',
    );
  });
});
