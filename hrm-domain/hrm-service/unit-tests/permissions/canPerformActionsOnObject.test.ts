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

import each from 'jest-each';
import { isErrorResult, isSuccessResult } from '@tech-matters/types';

import { canPerformActionsOnObject } from '../../src/permissions/canPerformActionOnObject';
import { actionsMaps } from '../../src/permissions/actions';
import * as contactApi from '../../src/contact/contact';
import * as caseApi from '../../src/case/case';

const accountSid = 'ACxxxxxx';

const getContactByIdSpy = jest
  .spyOn(contactApi, 'getContactById')
  .mockImplementation(() => Promise.resolve({ accountSid }) as any);
const getCaseSpy = jest
  .spyOn(caseApi, 'getCase')
  .mockImplementation(() => Promise.resolve({ accountSid }) as any);

afterEach(() => {
  jest.clearAllMocks();
});

describe('canPerformActionsOnObject', () => {
  each([
    ...Object.keys(actionsMaps)
      .flatMap(targetKind =>
        Object.values(actionsMaps[targetKind]).map(action => ({
          targetKind,
          action,
        })),
      )
      .flatMap(testCase => [
        {
          ...testCase,
          shouldCan: true,
          shouldAccessDB: true,
          success: true,
        },
        {
          ...testCase,
          shouldCan: false,
          shouldAccessDB: true,
          success: true,
        },
      ]),
    ...Object.keys(actionsMaps).map(targetKind => ({
      targetKind,
      action: 'invalid',
      shouldCan: false,
      success: false,
    })),
    ...Object.keys(actionsMaps).map(targetKind => ({
      targetKind,
      action: 'view' + targetKind[0].toUpperCase() + targetKind.slice(1),
      mockedCan: () => {
        throw new Error('Boom');
      },
      shouldCan: false,
      success: false,
    })),
  ]).test(
    'when targetKind is $targetKind, action $action and should be allowed evaluates to $shouldCan, should result in $expected',
    async ({ targetKind, action, shouldCan, success, mockedCan, shouldAccessDB }) => {
      const result = await canPerformActionsOnObject({
        accountSid,
        targetKind,
        actions: [action],
        objectId: 123,
        can: mockedCan ? mockedCan : () => shouldCan,
        user: { workerSid: 'workerSid', isSupervisor: false, roles: ['supervisor'] },
      });

      if (shouldAccessDB) {
        if (targetKind === 'contact') {
          expect(getContactByIdSpy).toHaveBeenCalled();
        }

        if (targetKind === 'case') {
          expect(getCaseSpy).toHaveBeenCalled();
        }
      }

      if (success) {
        expect(isSuccessResult(result)).toBeTruthy();
        expect(isSuccessResult(result) && result.data).toBe(shouldCan);
      } else {
        expect(isErrorResult(result)).toBeTruthy();
      }
    },
  );
});
