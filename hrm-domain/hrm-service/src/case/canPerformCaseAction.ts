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

import asyncHandler from '../async-handler';
import { CaseService, getCase } from './caseService';
import createError from 'http-errors';
import { actionsMaps, getActions } from '../permissions';

export const canPerformCaseAction = (
  generateActions: (caseObj: CaseService, req: any) => any[],
  getCaseIdFromRequest: (req: any) => number = req => req.params.id,
) =>
  asyncHandler(async (req, res, next) => {
    if (!req.isAuthorized()) {
      const { accountSid, body, user, can } = req;
      const id = getCaseIdFromRequest(req);
      const caseObj = await getCase(id, accountSid, { can, user });

      if (!caseObj) throw createError(404);

      const actions = generateActions(caseObj, body);
      console.debug(`Actions attempted in case edit (case #${id})`, actions);
      const canEdit = actions.every(action => can(user, action, caseObj));

      if (canEdit) {
        req.authorize();
      } else {
        req.unauthorize();
      }
    }

    next();
  });

/**
 * It checks if the user can edit the case based on the fields it's trying to edit
 * according to the defined permission rules.
 */
export const canEditCase = canPerformCaseAction(getActions);

/**
 * It checks if the user can view the case according to the defined permission rules.
 */
export const canViewCase = canPerformCaseAction(() => [actionsMaps.case.VIEW_CASE]);
