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
import { actionsMaps } from '../permissions';
import { Request } from 'express';
import { OPEN_VIEW_CONTACT_PERMISSIONS } from '../permissions/canPerformActionOnObject';

/**
 * Generic function to check if the user can perform an action on a case.
 * @param generateActions - Function to generate the actions to be checked based on the case as it currently exists in the DB and the request.
 * @param getCaseIdFromRequest - Function to get the case ID from the request if it is not tokenised as :id in the route.
 * @param notFoundIfNotPermitted - If true, it will throw a 404 error if the user is not permitted to perform the action, use for read requests to prevent information leakage.
 */
export const canPerformCaseAction = (
  generateActions: (caseObj: CaseService, req: Request) => any[],
  getCaseIdFromRequest: (req: any) => string = req => req.params.id,
  notFoundIfNotPermitted = false,
) =>
  asyncHandler(async (req, res, next) => {
    if (!req.isPermitted()) {
      const { hrmAccountId, user, can } = req;
      const id = getCaseIdFromRequest(req);
      const caseObj = await getCase(id, hrmAccountId, {
        can,
        user,
        permissions: OPEN_VIEW_CONTACT_PERMISSIONS,
      });

      if (!caseObj) throw createError(404);

      const actions = generateActions(caseObj, req);
      console.debug(`Actions attempted in case edit (case #${id})`, actions);
      const canEdit = actions.every(action => can(user, action, caseObj));

      if (canEdit) {
        console.debug(
          `[Permission - PERMITTED] User ${user.workerSid} is permitted to perform ${actions} on case ${hrmAccountId}/${id}`,
        );
        req.permit();
      } else {
        console.debug(
          `[Permission - BLOCKED] User ${user.workerSid} is not permitted to perform ${actions} on case ${hrmAccountId}/${id} - rules failure`,
        );
        if (notFoundIfNotPermitted) throw createError(404);
        req.block();
      }
    }

    next();
  });

/**
 * It checks if the user can view the case according to the defined permission rules.
 */
export const canViewCase = canPerformCaseAction(
  () => [actionsMaps.case.VIEW_CASE],
  req => req.params.id,
  true,
);

export const canUpdateCaseStatus = canPerformCaseAction(
  ({ status: savedStatus }, { body: { status: updatedStatus } }) => {
    if (updatedStatus === savedStatus) return [];
    if (updatedStatus === 'closed') return [actionsMaps.case.CLOSE_CASE];
    return savedStatus === 'closed'
      ? [actionsMaps.case.REOPEN_CASE]
      : [actionsMaps.case.CASE_STATUS_TRANSITION];
  },
);

export const canEditCaseOverview = canPerformCaseAction(() => [
  actionsMaps.case.EDIT_CASE_OVERVIEW,
]);
