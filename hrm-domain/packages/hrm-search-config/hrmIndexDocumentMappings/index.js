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
exports.isHrmCasesIndex = exports.HRM_CASES_INDEX_TYPE = exports.isHrmContactsIndex = exports.HRM_CONTACTS_INDEX_TYPE = exports.DocumentType = exports.casePathToSections = exports.casePathToContacts = exports.contactMapping = exports.caseMapping = void 0;
const mappings_1 = require("./mappings");
var mappings_2 = require("./mappings");
Object.defineProperty(exports, "caseMapping", { enumerable: true, get: function () { return mappings_2.caseMapping; } });
Object.defineProperty(exports, "contactMapping", { enumerable: true, get: function () { return mappings_2.contactMapping; } });
Object.defineProperty(exports, "casePathToContacts", { enumerable: true, get: function () { return mappings_2.casePathToContacts; } });
Object.defineProperty(exports, "casePathToSections", { enumerable: true, get: function () { return mappings_2.casePathToSections; } });
var DocumentType;
(function (DocumentType) {
    DocumentType["Contact"] = "contact";
    DocumentType["CaseSection"] = "caseSection";
    DocumentType["Case"] = "case";
})(DocumentType || (exports.DocumentType = DocumentType = {}));
exports.HRM_CONTACTS_INDEX_TYPE = 'hrm-contacts';
const isHrmContactsIndex = (s) => typeof s === 'string' && s.endsWith(exports.HRM_CONTACTS_INDEX_TYPE);
exports.isHrmContactsIndex = isHrmContactsIndex;
exports.HRM_CASES_INDEX_TYPE = 'hrm-cases';
const isHrmCasesIndex = (s) => typeof s === 'string' && s.endsWith(exports.HRM_CASES_INDEX_TYPE);
exports.isHrmCasesIndex = isHrmCasesIndex;
