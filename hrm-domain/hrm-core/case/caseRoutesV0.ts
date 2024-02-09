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
import * as casesDb from './caseDataAccess';
import * as caseApi from './caseService';
import { publicEndpoint, SafeRouter } from '../permissions';
import {
  canEditCase,
  canEditCaseOverview,
  canUpdateCaseStatus,
  canViewCase,
} from './canPerformCaseAction';
import caseSectionRoutesV0 from './caseSection/caseSectionRoutesV0';
import { parseISO } from 'date-fns';

const casesRouter = SafeRouter();
/**
 * Returns a filterable list of cases for a helpline
 *
 * @param {string} req.accountSid - SID of the helpline
 * @param {CaseListConfiguration.sortDirection} req.query.sortDirection - Sort direction
 * @param {CaseListConfiguration.sortBy} req.query.sortBy - Sort by
 * @param {CaseListConfiguration.limit} req.query.limit - Limit
 * @param {CaseListConfiguration.offset} req.query.offset - Offset
 * @param {SearchParameters} req.query.search
 *
 * @returns {CaseSearchReturn} - List of cases
 */
casesRouter.get('/', publicEndpoint, async (req, res) => {
  const { accountSid } = req;
  const { sortDirection, sortBy, limit, offset, ...search } = req.query;

  const { closedCases, counselor, helpline, ...searchCriteria } = search;

  const cases = await caseApi.searchCases(
    accountSid,
    { sortDirection, sortBy, limit, offset },
    searchCriteria,
    { filters: { includeOrphans: false }, closedCases, counselor, helpline },
    req,
  );
  res.json(cases);
});

casesRouter.post('/', publicEndpoint, async (req, res) => {
  const { accountSid, user } = req;
  const createdCase = await caseApi.createCase(req.body, accountSid, user.workerSid);

  res.json(createdCase);
});

casesRouter.get('/:id', canViewCase, async (req, res) => {
  const { accountSid } = req;
  const { id } = req.params;

  const caseFromDB = await caseApi.getCase(id, accountSid, {
    can: req.can,
    user: req.user,
  });

  if (!caseFromDB) {
    throw createError(404);
  }

  res.json(caseFromDB);
});

casesRouter.put('/:id', canEditCase, async (req, res) => {
  console.info(
    '[DEPRECATION WARNING] - PUT /cases/:id is deprecated and slated for removal from the API in v1.16. Use the case section CRUD endpoints and the case overview / status PUT endpoints to make updates to cases.',
  );
  const { accountSid, user } = req;
  const { id } = req.params;
  const updatedCase = await caseApi.updateCase(id, req.body, accountSid, user.workerSid, {
    can: req.can,
    user,
  });
  if (!updatedCase) {
    throw createError(404);
  }
  res.json(updatedCase);
});

casesRouter.put('/:id/status', canUpdateCaseStatus, async (req, res) => {
  const {
    accountSid,
    user,
    body: { status },
  } = req;
  const { id } = req.params;
  const updatedCase = await caseApi.updateCaseStatus(id, status, accountSid, {
    can: req.can,
    user,
  });
  if (!updatedCase) {
    throw createError(404);
  }
  res.json(updatedCase);
});

casesRouter.put('/:id/overview', canEditCaseOverview, async (req, res) => {
  const {
    accountSid,
    user: { workerSid },
    body,
  } = req;
  const { id } = req.params;
  const { followUpDate } = body ?? {};
  if (followUpDate !== undefined && isNaN(parseISO(followUpDate).valueOf())) {
    throw createError(
      400,
      `Invalid followUpDate provided: ${followUpDate} - must be a valid ISO 8601 date string`,
    );
  }
  const updatedCase = await caseApi.updateCaseOverview(accountSid, id, body, workerSid);
  if (!updatedCase) {
    throw createError(404);
  }
  res.json(updatedCase);
});

casesRouter.delete('/:id', publicEndpoint, async (req, res) => {
  const { accountSid } = req;
  const { id } = req.params;
  const deleted = await casesDb.deleteById(id, accountSid);
  if (!deleted) {
    throw createError(404);
  }
  res.sendStatus(200);
});

casesRouter.post('/search', publicEndpoint, async (req, res) => {
  const { accountSid } = req;
  const { closedCases, counselor, helpline, filters, ...searchCriteria } = req.body || {};

  const searchResults = await caseApi.searchCases(
    accountSid,
    req.query || {},
    searchCriteria,
    { closedCases, counselor, helpline, filters },
    req,
  );
  res.json(searchResults);
});

casesRouter.expressRouter.use('/:caseId/sections', caseSectionRoutesV0);

export default casesRouter.expressRouter;
