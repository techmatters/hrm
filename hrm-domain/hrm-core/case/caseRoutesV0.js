"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_errors_1 = __importDefault(require("http-errors"));
const caseApi = __importStar(require("./caseService"));
const permissions_1 = require("../permissions");
const canPerformCaseAction_1 = require("./canPerformCaseAction");
const caseSectionRoutesV0_1 = __importDefault(require("./caseSection/caseSectionRoutesV0"));
const date_fns_1 = require("date-fns");
const caseSectionService_1 = require("./caseSection/caseSectionService");
const types_1 = require("@tech-matters/types");
const newCaseRouter = (isPublic) => {
    const casesRouter = (0, permissions_1.SafeRouter)();
    casesRouter.expressRouter.use('/:caseId/sections', (0, caseSectionRoutesV0_1.default)(isPublic));
    casesRouter.put('/:id/status', isPublic ? canPerformCaseAction_1.canUpdateCaseStatus : permissions_1.publicEndpoint, async (req, res) => {
        const { hrmAccountId, user, body: { status }, } = req;
        const { id } = req.params;
        const updatedCase = await caseApi.updateCaseStatus(id, status, hrmAccountId, {
            user,
        });
        if (!updatedCase) {
            throw (0, http_errors_1.default)(404);
        }
        res.json(updatedCase);
    });
    const patchCaseOverviewHandler = async (req, res) => {
        const { hrmAccountId, user: { workerSid }, body, } = req;
        const { id } = req.params;
        const { followUpDate } = body ?? {};
        if (followUpDate !== undefined &&
            followUpDate !== null &&
            isNaN((0, date_fns_1.parseISO)(followUpDate).valueOf())) {
            throw (0, http_errors_1.default)(400, `Invalid followUpDate provided: ${followUpDate} - must be a valid ISO 8601 date string`);
        }
        const updatedCase = await caseApi.updateCaseOverview(hrmAccountId, id, body, workerSid);
        if (!updatedCase) {
            throw (0, http_errors_1.default)(404);
        }
        res.json(updatedCase);
    };
    casesRouter.put('/:id/overview', isPublic ? canPerformCaseAction_1.canEditCaseOverview : permissions_1.publicEndpoint, patchCaseOverviewHandler);
    casesRouter.patch('/:id/overview', isPublic ? canPerformCaseAction_1.canEditCaseOverview : permissions_1.publicEndpoint, patchCaseOverviewHandler);
    casesRouter.post('/', permissions_1.publicEndpoint, async (req, res) => {
        const { hrmAccountId, user } = req;
        const createdCase = await caseApi.createCase(req.body, hrmAccountId, user.workerSid);
        res.json(createdCase);
    });
    casesRouter.get('/:id', isPublic ? canPerformCaseAction_1.canViewCase : permissions_1.publicEndpoint, async (req, res) => {
        const { hrmAccountId, user } = req;
        const { id } = req.params;
        const caseFromDB = await caseApi.getCase(id, hrmAccountId, {
            user,
        });
        console.info(`[Data Access Audit] Account:${hrmAccountId}, User: ${user.workerSid}, Action: Case read, case id: ${id}, parameters: `);
        if (!caseFromDB) {
            throw (0, http_errors_1.default)(404);
        }
        res.json(caseFromDB);
    });
    casesRouter.delete('/:id', permissions_1.publicEndpoint, async (req, res) => {
        const { hrmAccountId } = req;
        const { id } = req.params;
        const deleted = await caseApi.deleteCaseById({
            accountSid: hrmAccountId,
            caseId: id,
        });
        if (!deleted) {
            throw (0, http_errors_1.default)(404);
        }
        res.sendStatus(200);
    });
    casesRouter.get('/:id/timeline', isPublic ? canPerformCaseAction_1.canViewCase : permissions_1.publicEndpoint, async (req, res) => {
        const { hrmAccountId, params, query } = req;
        const { id: caseId } = params;
        const { sectionTypes, includeContacts, limit, offset } = query;
        const timeline = await (0, caseSectionService_1.getCaseTimeline)(hrmAccountId, req, caseId, (sectionTypes ?? '').split(','), includeContacts?.toLowerCase() !== 'false', { limit: limit ?? 20, offset: offset ?? 0 });
        console.info(`[Data Access Audit] Account:${hrmAccountId}, User: ${req.user.workerSid}, Action: Case timeline read, case id: ${caseId}, parameters: `, query);
        res.json(timeline);
    });
    // Public only endpoints
    if (isPublic) {
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
        const listHandler = async (req, res) => {
            const { hrmAccountId, query } = req;
            const { closedCases, counselor, helpline, filters } = req.body || {};
            const { sortDirection, sortBy, limit, offset } = query;
            const searchResults = await caseApi.listCases(hrmAccountId, { sortDirection, sortBy, limit, offset }, null, { closedCases, counselor, helpline, filters }, req);
            res.json(searchResults);
        };
        // TODO: Migrate flex to call /list, then we can migrate /search to /generalizedSearch
        casesRouter.post('/list', permissions_1.publicEndpoint, listHandler);
        casesRouter.post('/search', permissions_1.publicEndpoint, listHandler);
        // Endpoint used for generalized search powered by ElasticSearch
        casesRouter.post('/generalizedSearch', permissions_1.publicEndpoint, async (req, res, next) => {
            try {
                const { hrmAccountId, can, user, permissionRules, query, body } = req;
                // TODO: use better validation
                const { limit, offset } = query;
                const { searchParameters } = body;
                const casesResponse = await caseApi.generalisedCasesSearch(hrmAccountId, searchParameters, { limit, offset }, {
                    can,
                    user,
                    permissionRules,
                });
                if ((0, types_1.isErr)(casesResponse)) {
                    return next((0, types_1.mapHTTPError)(casesResponse, { InternalServerError: 500 }));
                }
                res.json(casesResponse.data);
            }
            catch (err) {
                return next((0, http_errors_1.default)(500, err.message));
            }
        });
    }
    return casesRouter.expressRouter;
};
exports.default = newCaseRouter;
