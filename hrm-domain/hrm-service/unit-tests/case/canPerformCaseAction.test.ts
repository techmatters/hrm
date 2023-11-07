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

import createError from 'http-errors';
import { CaseService, getCase } from '../../src/case/caseService';
import { actionsMaps } from '../../src/permissions';
import { canViewCase } from '../../src/case/canPerformCaseAction';

jest.mock('http-errors', () => jest.fn());
jest.mock('../../src/case/caseService', () => ({
  getCase: jest.fn(),
}));

const mockGetCase = getCase as jest.MockedFunction<typeof getCase>;
const mockCreateError = createError as jest.MockedFunction<typeof createError>;

let req: any;
const next = jest.fn();

beforeEach(() => {
  req = {
    isAuthorized: jest.fn().mockReturnValue(false),
    params: { contactId: 'contact1' },
    authorize: jest.fn(),
    unauthorize: jest.fn(),
    can: jest.fn(),
    user: { workerSid: 'worker1' },
    accountSid: 'account1',
    body: {},
  };
  next.mockClear();
  mockCreateError.mockClear();
  mockGetCase.mockClear();
});

describe('canViewCase', () => {
  test('Case not found - throws 404', async () => {
    mockGetCase.mockResolvedValueOnce(undefined);
    await canViewCase(req, {}, next);
    expect(createError).toHaveBeenCalled();
    expect(req.authorize).not.toHaveBeenCalled();
    expect(req.unauthorize).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  test('Case found & can returns true - authorizes', async () => {
    const caseObj = {} as CaseService;
    mockGetCase.mockResolvedValueOnce(caseObj);
    req.can.mockReturnValueOnce(true);
    await canViewCase(req, {}, next);
    expect(req.can).toHaveBeenCalledWith(req.user, actionsMaps.case.VIEW_CASE, caseObj);
    expect(createError).not.toHaveBeenCalled();
    expect(req.authorize).toHaveBeenCalled();
    expect(req.unauthorize).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  test('Case found & can returns false - unauthorizes', async () => {
    const caseObj = {} as CaseService;
    mockGetCase.mockResolvedValueOnce(caseObj);
    req.can.mockReturnValueOnce(false);
    await canViewCase(req, {}, next);
    expect(req.can).toHaveBeenCalledWith(req.user, actionsMaps.case.VIEW_CASE, caseObj);
    expect(createError).not.toHaveBeenCalled();
    expect(req.authorize).not.toHaveBeenCalled();
    expect(req.unauthorize).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
