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
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCaseById = exports.generalisedCasesSearch = exports.searchCasesByIds = exports.getCasesByProfileId = exports.listCases = exports.getCase = exports.updateCaseOverview = exports.updateCaseStatus = exports.createCase = exports.updateCaseNotify = exports.createCaseNotify = exports.getTimelineForCase = exports.getTimelinesForCases = exports.caseRecordToCase = void 0;
/**
 * This is the 'business logic' module for Case CRUD operations.
 * For the moment it just does some light mapping between the types used for the REST layer, and the types used for the database layer.
 * This includes compatibility code required to provide cases in a shape expected by older clients
 */
const caseDataAccess_1 = require("./caseDataAccess");
const types_1 = require("@tech-matters/types");
const hrm_search_config_1 = require("@tech-matters/hrm-search-config");
const entityChangeNotify_1 = require("../notifications/entityChangeNotify");
const elasticsearch_client_1 = require("@tech-matters/elasticsearch-client");
const caseSearchIndex_1 = require("./caseSearchIndex");
const permissions_1 = require("../permissions");
const caseSectionService_1 = require("./caseSection/caseSectionService");
const REQUIRED_CASE_OVERVIEW_PROPERTIES = ['summary'];
const caseRecordToCase = (record) => {
    const { contactsOwnedByUserCount, ...output } = record;
    return {
        ...output,
        id: record.id.toString(),
        precalculatedPermissions: { userOwnsContact: contactsOwnedByUserCount > 0 },
    };
};
exports.caseRecordToCase = caseRecordToCase;
const getTimelinesForCases = async (accountSid, userData, cases) => {
    const { timelines } = await (0, caseSectionService_1.getMultipleCaseTimelines)(accountSid, userData, cases.map(c => c.id), ['*'], true, { offset: '0', limit: '5000' });
    return cases.map(c => ({
        case: c,
        timeline: timelines[c.id] ?? [],
    }));
};
exports.getTimelinesForCases = getTimelinesForCases;
const getTimelineForCase = async (accountSid, userData, cas) => {
    return (await (0, exports.getTimelinesForCases)(accountSid, userData, [cas]))[0].timeline;
};
exports.getTimelineForCase = getTimelineForCase;
const doCaseChangeNotification = (operation) => async ({ accountSid, caseId, caseRecord, }) => {
    try {
        const caseObj = caseRecord ?? (await (0, caseDataAccess_1.getById)(parseInt(caseId), accountSid, permissions_1.maxPermissions.user));
        if (caseObj) {
            const caseService = (0, exports.caseRecordToCase)(caseObj);
            const timeline = await (0, exports.getTimelineForCase)(accountSid, permissions_1.maxPermissions, caseService);
            await (0, entityChangeNotify_1.publishCaseChangeNotification)({
                accountSid,
                caseObj: caseService,
                timeline,
                operation,
            });
        }
    }
    catch (err) {
        console.error(`Error trying to index case: accountSid ${accountSid} caseId ${caseId}`, err);
    }
};
exports.createCaseNotify = doCaseChangeNotification('create');
exports.updateCaseNotify = doCaseChangeNotification('update');
const deleteCaseNotify = doCaseChangeNotification('delete');
const createCase = async (body, accountSid, workerSid, testNowISO, skipSearchIndex = false) => {
    const nowISO = (testNowISO ?? new Date()).toISOString();
    // TODO: this is compatibility code, remove info.definitionVersion default once all clients use top level definition version
    const definitionVersion = body.definitionVersion || body.info.definitionVersion;
    if (!definitionVersion) {
        throw new Error('createCase error: missing definition version parameter');
    }
    delete body.id;
    const record = {
        twilioWorkerId: workerSid,
        ...body,
        createdBy: workerSid,
        createdAt: nowISO,
        updatedAt: nowISO,
        updatedBy: null,
        accountSid,
        definitionVersion,
    };
    const created = await (0, caseDataAccess_1.create)(record);
    if (!skipSearchIndex) {
        await (0, exports.createCaseNotify)({ accountSid, caseId: created.id.toString() });
    }
    // A new case is always initialized with empty connected contacts. No need to apply mapContactTransformations here
    return (0, exports.caseRecordToCase)(created);
};
exports.createCase = createCase;
const updateCaseStatus = async (id, status, accountSid, { user }, skipSearchIndex = false) => {
    const { workerSid } = user;
    const updated = await (0, caseDataAccess_1.updateStatus)(id, status, workerSid, accountSid);
    // Case not found
    if (!updated)
        return null;
    if (!skipSearchIndex) {
        await (0, exports.updateCaseNotify)({ accountSid, caseId: updated.id.toString() });
    }
    return (0, exports.caseRecordToCase)(updated);
};
exports.updateCaseStatus = updateCaseStatus;
const updateCaseOverview = async (accountSid, id, overview, workerSid, skipSearchIndex = false) => {
    const updated = await (0, caseDataAccess_1.updateCaseInfo)(accountSid, parseInt(id), overview, workerSid);
    if (!updated)
        return null;
    if (!skipSearchIndex) {
        await (0, exports.updateCaseNotify)({ accountSid, caseId: updated.id });
    }
    return (0, exports.caseRecordToCase)(updated);
};
exports.updateCaseOverview = updateCaseOverview;
const getCase = async (id, accountSid, { user, }) => {
    const caseFromDb = await (0, caseDataAccess_1.getById)(parseInt(id), accountSid, user);
    if (caseFromDb) {
        return (0, exports.caseRecordToCase)(caseFromDb);
    }
    return;
};
exports.getCase = getCase;
const generalizedSearchCases = (searchQuery) => async (accountSid, listConfiguration, searchParameters, filterParameters, { user, permissionRules, }) => {
    const { filters, helpline, counselor, closedCases } = filterParameters;
    const caseFilters = filters ?? {};
    caseFilters.helplines =
        caseFilters.helplines ?? (helpline ? helpline.split(';') : undefined);
    caseFilters.counsellors =
        caseFilters.counsellors ?? (counselor ? counselor.split(';') : undefined);
    caseFilters.excludedStatuses = caseFilters.excludedStatuses ?? [];
    if (closedCases === false) {
        caseFilters.excludedStatuses.push('closed');
    }
    caseFilters.includeOrphans = caseFilters.includeOrphans ?? closedCases ?? true;
    const viewCasePermissions = permissionRules.viewCase;
    const dbResult = await searchQuery(user, viewCasePermissions, listConfiguration, accountSid, searchParameters, caseFilters);
    return {
        ...dbResult,
        cases: dbResult.cases.map(r => (0, exports.caseRecordToCase)(r)),
    };
};
exports.listCases = generalizedSearchCases(caseDataAccess_1.list);
const searchCasesByProfileId = generalizedSearchCases(caseDataAccess_1.searchByProfileId);
const getCasesByProfileId = async (accountSid, profileId, query, ctx) => {
    try {
        const cases = await searchCasesByProfileId(accountSid, query, { profileId }, {}, ctx);
        return (0, types_1.newOk)({ data: cases });
    }
    catch (err) {
        return (0, types_1.newErr)({
            message: err instanceof Error ? err.message : String(err),
            error: 'InternalServerError',
        });
    }
};
exports.getCasesByProfileId = getCasesByProfileId;
exports.searchCasesByIds = generalizedSearchCases(caseDataAccess_1.searchByCaseIds);
const generalisedCasesSearch = async (accountSid, searchParameters, query, ctx) => {
    try {
        const { searchTerm, counselor, dateFrom, dateTo } = searchParameters;
        const { limit, offset } = query;
        const pagination = {
            limit: parseInt(limit || '20', 10),
            start: parseInt(offset || '0', 10),
        };
        const searchFilters = (0, caseSearchIndex_1.generateCaseSearchFilters)({ counselor, dateFrom, dateTo });
        const permissionFilters = (0, caseSearchIndex_1.generateCasePermissionsFilters)({
            user: ctx.user,
            viewContact: ctx.permissionRules.viewContact,
            viewTranscript: ctx.permissionRules
                .viewExternalTranscript,
            viewCase: ctx.permissionRules.viewCase,
        });
        const client = (await (0, elasticsearch_client_1.getClient)({
            accountSid,
            indexType: hrm_search_config_1.HRM_CASES_INDEX_TYPE,
            ssmConfigParameter: process.env.SSM_PARAM_ELASTICSEARCH_CONFIG,
        })).searchClient(hrm_search_config_1.hrmSearchConfiguration);
        const { total, items } = await client.search({
            searchParameters: {
                type: hrm_search_config_1.DocumentType.Case,
                searchTerm,
                searchFilters,
                permissionFilters,
                pagination,
            },
        });
        const caseIds = items.map(item => parseInt(item.id, 10));
        const { cases } = await (0, exports.searchCasesByIds)(accountSid, {}, // limit and offset are computed in ES query
        { caseIds }, {}, ctx);
        console.info(`[Data Access Audit] Account: ${accountSid}, User: ${ctx.user.workerSid}, Action: Cases searched, ids: ${caseIds}`);
        // Monitors & dashboards use this log statement, review them before updating to ensure they remain aligned.
        console.info(`[generalised-search-cases] AccountSid: ${accountSid} - Search Complete. Total count from ES: ${total}, Paginated count from ES: ${caseIds.length}, Paginated count from DB: ${cases.length}.`);
        const order = caseIds.reduce((accum, idVal, idIndex) => ({ ...accum, [idVal]: idIndex }), {});
        const sorted = cases.sort((a, b) => order[a.id] - order[b.id]);
        return (0, types_1.newOk)({ data: { count: total, cases: sorted } });
    }
    catch (err) {
        return (0, types_1.newErr)({
            message: err instanceof Error ? err.message : String(err),
            error: 'InternalServerError',
        });
    }
};
exports.generalisedCasesSearch = generalisedCasesSearch;
const deleteCaseById = async ({ accountSid, caseId, }) => {
    const deleted = await (0, caseDataAccess_1.deleteById)(parseInt(caseId), accountSid);
    await deleteCaseNotify({
        accountSid,
        caseId: deleted?.id?.toString(),
        caseRecord: deleted,
    });
    return deleted;
};
exports.deleteCaseById = deleteCaseById;
