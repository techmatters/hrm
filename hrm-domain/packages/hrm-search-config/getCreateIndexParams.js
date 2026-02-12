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
exports.getCreateIndexParams = void 0;
const hrmIndexDocumentMappings_1 = require("./hrmIndexDocumentMappings");
const getCreateHrmContactsIndexParams = (index) => {
    return {
        index,
        // settings: {
        // },
        mappings: {
            properties: {
                high_boost_global: {
                    type: 'text',
                },
                low_boost_global: {
                    type: 'text',
                },
                ...hrmIndexDocumentMappings_1.contactMapping,
            },
        },
    };
};
const getCreateHrmCaseIndexParams = (index) => {
    return {
        index,
        // settings: {
        // },
        mappings: {
            properties: {
                high_boost_global: {
                    type: 'text',
                },
                low_boost_global: {
                    type: 'text',
                },
                ...hrmIndexDocumentMappings_1.caseMapping,
            },
        },
    };
};
/**
 * This function is used to make a request to create the resources search index in ES.
 * @param index
 */
const getCreateIndexParams = (index) => {
    if ((0, hrmIndexDocumentMappings_1.isHrmContactsIndex)(index)) {
        return getCreateHrmContactsIndexParams(index);
    }
    if ((0, hrmIndexDocumentMappings_1.isHrmCasesIndex)(index)) {
        return getCreateHrmCaseIndexParams(index);
    }
    throw new Error(`getCreateIndexParams not implemented for index ${index}`);
};
exports.getCreateIndexParams = getCreateIndexParams;
