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
import { getCaseTimeline } from './caseSection/caseSectionService';

const casesRouter = SafeRouter();
casesRouter.put('/:id/status', canUpdateCaseStatus, async (req, res) => {
  const {
    accountSid,
    user,
    body: { status },
    can,
    permissions,
  } = req;
  const { id } = req.params;
  const updatedCase = await caseApi.updateCaseStatus(id, status, accountSid, {
    can,
    user,
    permissions,
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
  if (
    followUpDate !== undefined &&
    followUpDate !== null &&
    isNaN(parseISO(followUpDate).valueOf())
  ) {
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

casesRouter.get('/:id/timeline', canViewCase, async (req, res) => {
  const { accountSid, params, query } = req;
  const { id: caseId } = params;
  const { sectionTypes, includeContacts, limit, offset } = query;
  const timeline = await getCaseTimeline(
    accountSid,
    req,
    parseInt(caseId),
    (sectionTypes ?? 'note,referral').split(','),
    includeContacts?.toLowerCase() !== 'false',
    { limit: limit ?? 20, offset: offset ?? 0 },
  );
  res.json(timeline);
});

casesRouter.expressRouter.use('/:caseId/sections', caseSectionRoutesV0);

casesRouter.delete('/:id', publicEndpoint, async (req, res) => {
  const { accountSid } = req;
  const { id } = req.params;
  const deleted = await casesDb.deleteById(id, accountSid);
  if (!deleted) {
    throw createError(404);
  }
  res.sendStatus(200);
});
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
  const {
    sortDirection,
    sortBy,
    limit,
    offset,
    onlyEssentialData: onlyEssentialDataParam,
    ...search
  } = req.query;

  const { closedCases, counselor, helpline, ...searchCriteria } = search;
  const onlyEssentialData = Boolean(onlyEssentialDataParam);

  const cases = await caseApi.searchCases(
    accountSid,
    { sortDirection, sortBy, limit, offset },
    searchCriteria,
    { filters: { includeOrphans: false }, closedCases, counselor, helpline },
    req,
    onlyEssentialData,
  );
  res.json(cases);
});

casesRouter.post('/', publicEndpoint, async (req, res) => {
  const { accountSid, user } = req;
  const createdCase = await caseApi.createCase(req.body, accountSid, user.workerSid);

  res.json(createdCase);
});

casesRouter.get('/:id', canViewCase, async (req, res) => {
  const { accountSid, permissions, can, user } = req;
  const { id } = req.params;
  const onlyEssentialData = Boolean(req.query.onlyEssentialData);

  const caseFromDB = await caseApi.getCase(
    id,
    accountSid,
    {
      can,
      user,
      permissions,
    },
    onlyEssentialData,
  );

  if (!caseFromDB) {
    throw createError(404);
  }

  res.json(caseFromDB);
});

casesRouter.put('/:id', canEditCase, async (req, res) => {
  console.info(
    '[DEPRECATION WARNING] - PUT /cases/:id is deprecated and slated for removal from the API in v1.16. Use the case section CRUD endpoints and the case overview / status PUT endpoints to make updates to cases.',
  );
  const { accountSid, user, permissions } = req;
  const { id } = req.params;
  const updatedCase = await caseApi.updateCase(id, req.body, accountSid, {
    can: req.can,
    user,
    permissions,
  });
  if (!updatedCase) {
    throw createError(404);
  }
  res.json(updatedCase);
});

casesRouter.post('/search', publicEndpoint, async (req, res) => {
  const { accountSid } = req;
  const {
    closedCases,
    counselor,
    helpline,
    filters,
    onlyEssentialData,
    ...searchCriteria
  } = req.body || {};

  const searchResults = await caseApi.searchCases(
    accountSid,
    req.query || {},
    searchCriteria,
    { closedCases, counselor, helpline, filters },
    req,
    onlyEssentialData,
  );
  res.json(searchResults);
});

export default casesRouter.expressRouter;
