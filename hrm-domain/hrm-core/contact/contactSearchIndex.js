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
exports.generateContactPermissionsFilters = exports.generateContactSearchFilters = void 0;
const hrm_search_config_1 = require("@tech-matters/hrm-search-config");
const elasticsearchGenerators_1 = require("../permissions/queryGenerators/elasticsearchGenerators");
const date_fns_1 = require("date-fns");
const buildSearchFilters = ({ counselor, dateFrom, dateTo, onlyDataContacts, }) => {
    const searchFilters = [
        counselor &&
            {
                documentType: hrm_search_config_1.DocumentType.Contact,
                field: 'twilioWorkerId',
                type: 'term',
                term: counselor,
            },
        (dateFrom || dateTo) &&
            {
                documentType: hrm_search_config_1.DocumentType.Contact,
                field: 'timeOfContact',
                type: 'range',
                ranges: {
                    ...(dateFrom && { gte: new Date(dateFrom).toISOString() }),
                    ...(dateTo && { lte: new Date(dateTo).toISOString() }),
                },
            },
        onlyDataContacts &&
            {
                documentType: hrm_search_config_1.DocumentType.Contact,
                field: 'isDataContact',
                type: 'term',
                term: true,
            },
    ].filter(Boolean);
    return searchFilters;
};
const generateContactSearchFilters = (p) => buildSearchFilters(p).map(hrm_search_config_1.generateESFilter);
exports.generateContactSearchFilters = generateContactSearchFilters;
const conditionWhereClauses = ({ buildParams: { parentPath }, user, queryWrapper, }) => ({
    isOwner: (0, hrm_search_config_1.generateESFilter)(queryWrapper({
        documentType: hrm_search_config_1.DocumentType.Contact,
        field: 'twilioWorkerId',
        parentPath,
        type: 'term',
        term: user.workerSid,
    })),
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
        return (0, hrm_search_config_1.generateESFilter)(queryWrapper({
            documentType: hrm_search_config_1.DocumentType.Contact,
            field: 'timeOfContact',
            parentPath,
            type: 'range',
            ranges: {
                gte: greater.toISOString(),
            },
        }));
    },
});
const listContactsPermissionClause = ({ listConditionSets, user, buildParams, queryWrapper, }) => {
    const clauses = (0, elasticsearchGenerators_1.listPermissionWhereClause)({
        listConditionSets,
        user,
        conditionWhereClauses: conditionWhereClauses({
            user,
            buildParams,
            queryWrapper,
        }),
    });
    return clauses;
};
const generateContactPermissionsFilters = ({ viewContact, viewTranscript, user, buildParams, queryWrapper = p => p, }) => ({
    contactFilters: listContactsPermissionClause({
        listConditionSets: viewContact,
        user,
        buildParams,
        queryWrapper,
    }),
    transcriptFilters: listContactsPermissionClause({
        listConditionSets: viewTranscript,
        user,
        buildParams,
        queryWrapper,
    }),
});
exports.generateContactPermissionsFilters = generateContactPermissionsFilters;
