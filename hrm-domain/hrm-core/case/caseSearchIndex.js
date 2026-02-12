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
exports.generateCasePermissionsFilters = exports.generateCaseSearchFilters = void 0;
const hrm_search_config_1 = require("@tech-matters/hrm-search-config");
const elasticsearchGenerators_1 = require("../permissions/queryGenerators/elasticsearchGenerators");
const date_fns_1 = require("date-fns");
const contactSearchIndex_1 = require("../contact/contactSearchIndex");
const buildSearchFilters = ({ counselor, dateFrom, dateTo, }) => {
    const searchFilters = [
        counselor &&
            {
                documentType: hrm_search_config_1.DocumentType.Case,
                field: 'twilioWorkerId',
                type: 'term',
                term: counselor,
            },
        (dateFrom || dateTo) &&
            {
                documentType: hrm_search_config_1.DocumentType.Case,
                field: 'createdAt',
                type: 'range',
                ranges: {
                    ...(dateFrom && { gte: new Date(dateFrom).toISOString() }),
                    ...(dateTo && { lte: new Date(dateTo).toISOString() }),
                },
            },
    ].filter(Boolean);
    return searchFilters;
};
const generateCaseSearchFilters = (p) => buildSearchFilters(p).map(hrm_search_config_1.generateESFilter);
exports.generateCaseSearchFilters = generateCaseSearchFilters;
const buildPermissionFilter = (p) => (0, hrm_search_config_1.generateESFilter)(p);
const conditionWhereClauses = ({ user, }) => ({
    isCaseOpen: buildPermissionFilter({
        documentType: hrm_search_config_1.DocumentType.Case,
        type: 'mustNot',
        innerQuery: {
            field: 'status',
            type: 'term',
            term: 'closed',
            documentType: hrm_search_config_1.DocumentType.Case,
        },
    }),
    isCaseContactOwner: buildPermissionFilter({
        documentType: hrm_search_config_1.DocumentType.Case,
        type: 'nested',
        path: hrm_search_config_1.casePathToContacts,
        innerQuery: {
            documentType: hrm_search_config_1.DocumentType.Contact,
            type: 'term',
            field: 'twilioWorkerId',
            term: user.workerSid,
            parentPath: hrm_search_config_1.casePathToContacts,
        },
    }),
    isCreator: buildPermissionFilter({
        documentType: hrm_search_config_1.DocumentType.Case,
        field: 'twilioWorkerId',
        type: 'term',
        term: user.workerSid,
    }),
    timeBasedCondition: ({ createdDaysAgo, createdHoursAgo }) => {
        const now = new Date();
        const timeClauses = [];
        if (typeof createdHoursAgo === 'number') {
            timeClauses.push((0, date_fns_1.subHours)(now, createdHoursAgo));
        }
        if (typeof createdDaysAgo === 'number') {
            timeClauses.push((0, date_fns_1.subDays)(now, createdDaysAgo));
        }
        // get the "max" date filter - i.e. the most aggressive one (if more than one)
        const greater = timeClauses.sort((a, b) => b.getTime() - a.getTime())[0];
        return buildPermissionFilter({
            documentType: hrm_search_config_1.DocumentType.Case,
            field: 'createdAt',
            type: 'range',
            ranges: {
                gte: greater.toISOString(),
            },
        });
    },
});
const listCasePermissionClause = ({ listConditionSets, user, }) => {
    const clauses = (0, elasticsearchGenerators_1.listPermissionWhereClause)({
        listConditionSets,
        user,
        conditionWhereClauses: conditionWhereClauses({ user }),
    });
    return clauses;
};
const generateCasePermissionsFilters = ({ viewContact, viewTranscript, viewCase, user, }) => {
    const { contactFilters, transcriptFilters } = (0, contactSearchIndex_1.generateContactPermissionsFilters)({
        buildParams: { parentPath: hrm_search_config_1.casePathToContacts },
        user,
        viewContact,
        viewTranscript,
        queryWrapper: p => ({
            documentType: hrm_search_config_1.DocumentType.Case,
            type: 'nested',
            path: hrm_search_config_1.casePathToContacts,
            innerQuery: p,
        }),
    });
    const caseFilters = listCasePermissionClause({ listConditionSets: viewCase, user });
    return { contactFilters, transcriptFilters, caseFilters };
};
exports.generateCasePermissionsFilters = generateCasePermissionsFilters;
