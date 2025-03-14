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
import * as caseApi from './caseService';
import { publicEndpoint as openEndpoint, SafeRouter } from '../permissions';
import {
  canEditCaseOverview,
  canUpdateCaseStatus,
  canViewCase,
} from './canPerformCaseAction';
import caseSectionRoutesV0 from './caseSection/caseSectionRoutesV0';
import { parseISO } from 'date-fns';
import { getCaseTimeline } from './caseSection/caseSectionService';
import type { NextFunction, Request, Response } from 'express';
import { isErr, mapHTTPError } from '@tech-matters/types';

const newCaseRouter = (isPublic: boolean) => {
  const casesRouter = SafeRouter();
  casesRouter.put(
    '/:id/status',
    isPublic ? canUpdateCaseStatus : openEndpoint,
    async (req, res) => {
      const {
        hrmAccountId,
        user,
        body: { status },
        can,
        permissions,
      } = req;
      const { id } = req.params;
      const updatedCase = await caseApi.updateCaseStatus(id, status, hrmAccountId, {
        can,
        user,
        permissions,
      });
      if (!updatedCase) {
        throw createError(404);
      }
      res.json(updatedCase);
    },
  );

  casesRouter.put(
    '/:id/overview',
    isPublic ? canEditCaseOverview : openEndpoint,
    async (req, res) => {
      const {
        hrmAccountId,
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
      const updatedCase = await caseApi.updateCaseOverview(
        hrmAccountId,
        id,
        body,
        workerSid,
      );
      if (!updatedCase) {
        throw createError(404);
      }
      res.json(updatedCase);
    },
  );

  casesRouter.expressRouter.use('/:caseId/sections', caseSectionRoutesV0(isPublic));

  // Public only endpoints
  if (isPublic) {
    casesRouter.get('/:id/timeline', canViewCase, async (req, res) => {
      const { hrmAccountId, params, query } = req;
      const { id: caseId } = params;
      const { sectionTypes, includeContacts, limit, offset } = query;
      const timeline = await getCaseTimeline(
        hrmAccountId,
        req,
        parseInt(caseId),
        (sectionTypes ?? 'note,referral').split(','),
        includeContacts?.toLowerCase() !== 'false',
        { limit: limit ?? 20, offset: offset ?? 0 },
      );
      res.json(timeline);
    });

    casesRouter.delete('/:id', openEndpoint, async (req, res) => {
      const { hrmAccountId } = req;
      const { id } = req.params;
      const deleted = await caseApi.deleteCaseById({
        accountSid: hrmAccountId,
        caseId: id,
      });
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
    casesRouter.get('/', openEndpoint, async (req, res) => {
      const { hrmAccountId } = req;
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
        hrmAccountId,
        { sortDirection, sortBy, limit, offset },
        searchCriteria,
        { filters: { includeOrphans: false }, closedCases, counselor, helpline },
        req,
        onlyEssentialData,
      );
      res.json(cases);
    });

    casesRouter.post('/', openEndpoint, async (req, res) => {
      const { hrmAccountId, user } = req;
      const createdCase = await caseApi.createCase(
        req.body,
        hrmAccountId,
        user.workerSid,
      );

      res.json(createdCase);
    });

    casesRouter.get('/:id', canViewCase, async (req, res) => {
      const { hrmAccountId, permissions, can, user } = req;
      const { id } = req.params;
      const onlyEssentialData = Boolean(req.query.onlyEssentialData);

      const caseFromDB = await caseApi.getCase(
        id,
        hrmAccountId,
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

    casesRouter.post('/search', openEndpoint, async (req, res) => {
      const { hrmAccountId } = req;
      const {
        closedCases,
        counselor,
        helpline,
        filters,
        onlyEssentialData,
        ...searchCriteria
      } = req.body || {};

      const searchResults = await caseApi.searchCases(
        hrmAccountId,
        req.query || {},
        searchCriteria,
        { closedCases, counselor, helpline, filters },
        req,
        onlyEssentialData,
      );
      res.json(searchResults);
    });

    // Endpoint used for generalized search powered by ElasticSearch
    casesRouter.post(
      '/generalizedSearch',
      openEndpoint,
      async (req: Request, res: Response, next: NextFunction) => {
        try {
          const { hrmAccountId, can, user, permissions, query, body } = req;

          // TODO: use better validation
          const { limit, offset } = query as { limit: string; offset: string };
          const { searchParameters } = body;

          const casesResponse = await caseApi.generalisedCasesSearch(
            hrmAccountId,
            searchParameters,
            { limit, offset },
            {
              can,
              user,
              permissions,
            },
          );

          if (isErr(casesResponse)) {
            return next(mapHTTPError(casesResponse, { InternalServerError: 500 }));
          }

          res.json(casesResponse.data);
        } catch (err) {
          return next(createError(500, err.message));
        }
      },
    );
  }
  return casesRouter.expressRouter;
};

export default newCaseRouter;
