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
import { getTwilioShortHelpline } from '../../src/index';

jest.mock('@tech-matters/ssm-cache', () => {
  const actual = jest.requireActual('@tech-matters/ssm-cache');
  return { ...actual, getSsmParameter: jest.fn() };
});

const mockGetSsmParameter = getSsmParameter as jest.MockedFunction<
  typeof getSsmParameter
>;

beforeEach(() => {
  process.env.NODE_ENV = 'test';
  process.env.AWS_REGION = 'us-east-1';
  mockGetSsmParameter.mockReset();
  mockGetSsmParameter.mockResolvedValue('the-value');
});

describe('resources SSM parameter getters', () => {
  const cases: [
    string,
    (args: any) => Promise<string>,
    Record<string, unknown>,
    string,
  ][] = [
    [
      'getTwilioShortHelpline',
      getTwilioShortHelpline,
      { accountSid: 'AC123' },
      '/test/twilio/AC123/short_helpline',
    ],
  ];

  test.each(cases)('%s looks up the expected path', async (_name, getter, args, path) => {
    await expect(getter(args)).resolves.toBe('the-value');
    expect(mockGetSsmParameter).toHaveBeenCalledWith(path, undefined, undefined);
  });
});
