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
import '../../permissions';
import createError from 'http-errors';
import { SafeRouter } from '../../permissions';
import {
  createCaseSection,
  deleteCaseSection,
  getCaseSection,
  getCaseSectionTypeList,
  replaceCaseSection,
} from './caseSectionService';
import '@tech-matters/twilio-worker-auth';
import { Request } from 'express';
import {
  canAddCaseSection,
  canEditCaseSection,
  canViewCaseSection,
} from './canPerformCaseSectionAction';

const caseSectionsRouter = SafeRouter({ mergeParams: true });

/**
 * Returns a specific section of a case, i.e. a specific perpetrator or note, via it's unique ID
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
caseSectionsRouter.get('/:sectionType', canViewCaseSection, async (req, res) => {
  const {
    accountSid,
    params: { caseId, sectionType },
  } = req;

  const section = await getCaseSectionTypeList(accountSid, req, caseId, sectionType);
  res.json(section);
});

/**
 * Returns a specific section of a case, i.e. a specific perpetrator or note, via it's unique ID
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
caseSectionsRouter.get(
  '/:sectionType/:sectionId',
  canViewCaseSection,
  async (req: Request, res) => {
    const {
      accountSid,
      params: { caseId, sectionType, sectionId },
    } = req;

    const section = await getCaseSection(accountSid, caseId, sectionType, sectionId);
    if (!section) {
      throw createError(404);
    }
    res.json(section);
  },
);

caseSectionsRouter.post('/:sectionType', canAddCaseSection, async (req, res) => {
  const {
    accountSid,
    user,
    params: { caseId, sectionType },
  } = req;
  const createdCase = await createCaseSection(
    accountSid,
    caseId,
    sectionType,
    req.body,
    user.workerSid,
  );

  res.json(createdCase);
});

caseSectionsRouter.put(
  '/:sectionType/:sectionId',
  canEditCaseSection,
  async (req, res) => {
    const {
      accountSid,
      user,
      params: { caseId, sectionType, sectionId },
    } = req;
    const updatedSection = await replaceCaseSection(
      accountSid,
      caseId,
      sectionType,
      sectionId,
      req.body,
      user.workerSid,
    );
    if (!updatedSection) {
      throw createError(404);
    }
    res.json(updatedSection);
  },
);

caseSectionsRouter.delete(
  '/:sectionType/:sectionId',
  canEditCaseSection,
  async (req, res) => {
    const {
      accountSid,
      params: { caseId, sectionType, sectionId },
    } = req;
    const deleted = await deleteCaseSection(accountSid, caseId, sectionType, sectionId);
    if (!deleted) {
      throw createError(404);
    }
    res.sendStatus(200);
  },
);

export default caseSectionsRouter.expressRouter;
