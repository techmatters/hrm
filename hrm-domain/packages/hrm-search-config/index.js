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
exports.FILTER_ALL_CLAUSE = exports.generateESFilter = exports.hrmIndexConfiguration = exports.hrmSearchConfiguration = exports.casePathToSections = exports.casePathToContacts = exports.DocumentType = exports.HRM_CONTACTS_INDEX_TYPE = exports.HRM_CASES_INDEX_TYPE = void 0;
const convertToIndexDocument_1 = require("./convertToIndexDocument");
const convertToScriptUpdate_1 = require("./convertToScriptUpdate");
const getCreateIndexParams_1 = require("./getCreateIndexParams");
const generateElasticsearchQuery_1 = require("./generateElasticsearchQuery");
var hrmIndexDocumentMappings_1 = require("./hrmIndexDocumentMappings");
Object.defineProperty(exports, "HRM_CASES_INDEX_TYPE", { enumerable: true, get: function () { return hrmIndexDocumentMappings_1.HRM_CASES_INDEX_TYPE; } });
Object.defineProperty(exports, "HRM_CONTACTS_INDEX_TYPE", { enumerable: true, get: function () { return hrmIndexDocumentMappings_1.HRM_CONTACTS_INDEX_TYPE; } });
Object.defineProperty(exports, "DocumentType", { enumerable: true, get: function () { return hrmIndexDocumentMappings_1.DocumentType; } });
Object.defineProperty(exports, "casePathToContacts", { enumerable: true, get: function () { return hrmIndexDocumentMappings_1.casePathToContacts; } });
Object.defineProperty(exports, "casePathToSections", { enumerable: true, get: function () { return hrmIndexDocumentMappings_1.casePathToSections; } });
exports.hrmSearchConfiguration = {
    generateElasticsearchQuery: generateElasticsearchQuery_1.generateElasticsearchQuery,
    // generateSuggestQuery,
};
exports.hrmIndexConfiguration = {
    convertToIndexDocument: convertToIndexDocument_1.convertToIndexDocument,
    convertToScriptUpdate: convertToScriptUpdate_1.convertToScriptUpdate,
    getCreateIndexParams: getCreateIndexParams_1.getCreateIndexParams,
};
var generateElasticsearchQuery_2 = require("./generateElasticsearchQuery");
Object.defineProperty(exports, "generateESFilter", { enumerable: true, get: function () { return generateElasticsearchQuery_2.generateESQuery; } });
Object.defineProperty(exports, "FILTER_ALL_CLAUSE", { enumerable: true, get: function () { return generateElasticsearchQuery_2.FILTER_ALL_CLAUSE; } });
