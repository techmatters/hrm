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

import parseISO from 'date-fns/parseISO';
import { handler } from '../../src';
import each from 'jest-each';
import { S3Event } from 'aws-lambda';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const baselineDate = parseISO('2020-01-01T00:00:00.000Z');
const testNow = parseISO('2025-01-01T00:00:00.000Z');

type HandlerTestCase = {
  description: string;
};

beforeAll(() => {
  jest.useFakeTimers('modern');
  jest.setSystemTime(testNow);
});

afterAll(() => {
  jest.useRealTimers();
});

const testCases: HandlerTestCase[] = [
  {
    description: 'stub does not throw',
  },
];

describe('resources-scheduled-importer handler', () => {
  each(testCases).test('$description', async ({}: HandlerTestCase) => {
    await handler({} as S3Event);
  });
});
