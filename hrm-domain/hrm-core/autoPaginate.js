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
exports.autoPaginate = exports.processInBatch = exports.defaultLimitAndOffset = void 0;
exports.defaultLimitAndOffset = {
    limit: '1000', // The underlying query limits this value to 1000.
    offset: '0',
};
const processInBatch = async (searchFunction, asyncProcessor) => {
    let hasMoreItems = true;
    let offset = exports.defaultLimitAndOffset.offset;
    const limit = exports.defaultLimitAndOffset.limit;
    let processed = 0;
    while (hasMoreItems) {
        /**
         * Updates 'limitAndOffset' param
         * Keep the other params intact
         */
        const searchResult = await searchFunction({ limit, offset });
        const { count, records } = searchResult;
        await asyncProcessor(searchResult);
        processed += records.length;
        hasMoreItems = processed < count;
        if (hasMoreItems) {
            offset += limit;
        }
    }
};
exports.processInBatch = processInBatch;
/**
 * This function takes care of keep calling the search function
 * until there's no more data to be fetched. It works by dynamically
 * adjusting the 'offset' on each subsequent call.
 *
 * @param searchFunction function to perform search of cases or contacts with the provided limit & offset
 * @returns cases[] or contacts[]
 */
const autoPaginate = async (searchFunction) => {
    let items = [];
    const asyncProcessor = async (result) => {
        items.push(...result.records);
    };
    await (0, exports.processInBatch)(searchFunction, asyncProcessor);
    return items;
};
exports.autoPaginate = autoPaginate;
