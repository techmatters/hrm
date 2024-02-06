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

/**
 * At search endpoints, permision rules cannot be applied as middlewares.
 * This is due to the fact the the user CAN always call POST /search.
 *
 * For example: if a user can only VIEW_CASES that he/she is the owner, this logic needs
 * to be part of the search query itself, that will filter out cases not owned by the user.
 * The user should never get 403 Forbidden. In the least privileged scenario, the user will get an HTTP 200
 * with response body [].
 *
 * This file creates the 'searchPermissions' that will be added the Request object. It will later be used
 * by the search contact/cases SQL queries.
 */

import type { Request as ExpressRequest } from 'express';
import { TwilioUser } from '@tech-matters/twilio-worker-auth';
import isEqual from 'lodash/isEqual';
import sortBy from 'lodash/sortBy';

import type { RulesFile, TKConditionsSet } from './rulesMap';
import type { TargetKind } from './actions';

type Request = {
  can?: any;
  user?: TwilioUser;
} & ExpressRequest;

export type SearchPermissions = {
  canOnlyViewOwnContacts?: boolean;
};

type TargetRule<T extends TargetKind> = Partial<
  Record<keyof RulesFile, TKConditionsSet<T>>
>;

const applySearchContactsPermissions = (
  req: Request,
  searchPermissions: SearchPermissions,
  checkRule: ReturnType<typeof buildCheckRule<'contact'>>,
) => {
  const { isSupervisor } = req.user;
  const canViewAsSupervisor =
    isSupervisor && checkRule({ viewContact: ['isSupervisor'] });
  const canViewAsOwner = checkRule({ viewContact: ['isOwner'] });
  const canOnlyViewOwnContacts = !canViewAsSupervisor && canViewAsOwner;

  return {
    ...searchPermissions,
    canOnlyViewOwnContacts,
  };
};

/**
 * This function returns a function that check if a given rule exists.
 *
 * Usage:
 * const checkRule = buildCheckRule(rulesFile);
 * checkRule({ viewContact: ['isOwner'] }); // returns true or false
 * checkRule({ viewCase: ['isCreator'] });  // returns true or false
 */
const buildCheckRule =
  <T extends TargetKind>(rulesFile: RulesFile) =>
  (targetRule: TargetRule<T>) => {
    const rule = Object.keys(targetRule)[0];
    const conditionSetIsEqual = conditionSet =>
      isEqual(sortBy(conditionSet), sortBy(targetRule[rule]));
    return rulesFile[rule].some(conditionSetIsEqual);
  };

export const getSearchPermissions = (req: Request, rulesFile: RulesFile) => {
  const checkRule = buildCheckRule(rulesFile);
  let searchPermissions: SearchPermissions = {};
  searchPermissions = applySearchContactsPermissions(req, searchPermissions, checkRule);

  return searchPermissions;
};
