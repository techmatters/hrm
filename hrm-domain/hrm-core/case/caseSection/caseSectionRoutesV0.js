"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
require("../../permissions");
const http_errors_1 = __importDefault(require("http-errors"));
// We will be applying 'publicEndpoint' to the non public endpoint and specifically NOT to the public endpoints - a less confusing name seems appropriate
const permissions_1 = require("../../permissions");
const caseSectionService_1 = require("./caseSectionService");
require("@tech-matters/twilio-worker-auth");
const canPerformCaseSectionAction_1 = require("./canPerformCaseSectionAction");
const types_1 = require("@tech-matters/types");
const newCaseSectionsRouter = (isPublic) => {
    const caseSectionsRouter = (0, permissions_1.SafeRouter)({ mergeParams: true });
    if (isPublic) {
        // Not exposed on the internal API
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
        caseSectionsRouter.get('/:sectionType', canPerformCaseSectionAction_1.canViewCaseSection, async (req, res) => {
            const { accountSid, params: { caseId, sectionType }, } = req;
            const section = await (0, caseSectionService_1.getCaseSectionTypeList)(accountSid, req, caseId, sectionType);
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
        caseSectionsRouter.get('/:sectionType/:sectionId', canPerformCaseSectionAction_1.canViewCaseSection, async (req, res) => {
            const { hrmAccountId, params: { caseId, sectionType, sectionId }, } = req;
            const section = await (0, caseSectionService_1.getCaseSection)(hrmAccountId, caseId, sectionType, sectionId);
            if (!section) {
                throw (0, http_errors_1.default)(404);
            }
            res.json(section);
        });
    }
    caseSectionsRouter.post('/:sectionType', isPublic ? canPerformCaseSectionAction_1.canAddCaseSection : permissions_1.publicEndpoint, async (req, res) => {
        const { hrmAccountId, user, params: { caseId, sectionType }, } = req;
        const createdCaseResult = await (0, caseSectionService_1.createCaseSection)(hrmAccountId, caseId, sectionType, req.body, user.workerSid);
        if ((0, types_1.isErr)(createdCaseResult)) {
            if (createdCaseResult.error === 'ResourceAlreadyExists') {
                throw (0, http_errors_1.default)(409, createdCaseResult);
            }
            if (createdCaseResult.error === 'ForeignKeyViolation') {
                throw (0, http_errors_1.default)(404, createdCaseResult);
            }
        }
        res.json(createdCaseResult.unwrap());
    });
    caseSectionsRouter.put('/:sectionType/:sectionId', isPublic ? canPerformCaseSectionAction_1.canEditCaseSection : permissions_1.publicEndpoint, async (req, res) => {
        const { hrmAccountId, user, params: { caseId, sectionType, sectionId }, } = req;
        const updatedSection = await (0, caseSectionService_1.replaceCaseSection)(hrmAccountId, caseId, sectionType, sectionId, req.body, user.workerSid);
        if (!updatedSection) {
            throw (0, http_errors_1.default)(404);
        }
        res.json(updatedSection);
    });
    caseSectionsRouter.delete('/:sectionType/:sectionId', isPublic ? canPerformCaseSectionAction_1.canEditCaseSection : permissions_1.publicEndpoint, async (req, res) => {
        const { hrmAccountId, user, params: { caseId, sectionType, sectionId }, } = req;
        const deleted = await (0, caseSectionService_1.deleteCaseSection)(hrmAccountId, caseId, sectionType, sectionId, {
            user,
        });
        if (!deleted) {
            throw (0, http_errors_1.default)(404);
        }
        res.sendStatus(200);
    });
    return caseSectionsRouter.expressRouter;
};
exports.default = newCaseSectionsRouter;
