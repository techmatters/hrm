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
exports.readApiInChunks = void 0;
const ssm_cache_1 = require("@tech-matters/ssm-cache");
const types_1 = require("@tech-matters/types");
const processChunk = async (items, lastSeen, itemProcessor, itemTypeName = 'item') => {
    let updatedLastSeen = lastSeen;
    for (const [index, item] of items.entries()) {
        console.debug(`Start processing index ${index} in ${items.length} ${itemTypeName}, (${lastSeen})`);
        const processorResult = await itemProcessor(item, lastSeen);
        if ((0, types_1.isErr)(processorResult)) {
            console[processorResult.error.level](`[TRACER][${itemTypeName}] Item processing error: ${processorResult.message}`, processorResult.error);
            updatedLastSeen = processorResult.error.lastUpdated ?? updatedLastSeen;
        }
        else {
            updatedLastSeen = processorResult.unwrap();
            console.info(`[TRACER][${itemTypeName}] Item processing success - updated last seen to:`, updatedLastSeen);
        }
    }
    return updatedLastSeen;
};
const readApiInChunks = async ({ url, headers, lastUpdateSeenSsmKey, maxItemsInChunk, maxChunksToRead, itemExtractor, itemProcessor, itemTypeName = 'item', }) => {
    let lastUpdateSeen = await (0, ssm_cache_1.getSsmParameter)(lastUpdateSeenSsmKey);
    let processedAllItems = false;
    let chunksRead = 0;
    for (; chunksRead < maxChunksToRead; chunksRead++) {
        console.info(`Last ${itemTypeName} update before:`, lastUpdateSeen);
        // Query Beacon API
        url.searchParams.set('updated_after', lastUpdateSeen);
        url.searchParams.set('limit', maxItemsInChunk.toString());
        console.info(`${itemTypeName} Querying:`, url);
        const apiCallStart = Date.now();
        const response = await fetch(url, { headers });
        const apiCallMillis = Date.now() - apiCallStart;
        console.info(`[TRACER][${itemTypeName}] Beacon API responded after ${apiCallMillis}ms with status:`, response.status);
        if (response.ok) {
            const parsedBody = await response.json();
            const beaconData = itemExtractor(parsedBody);
            if (!Array.isArray(beaconData)) {
                throw new Error(`Beacon ${itemTypeName} API did not return a valid response: ${JSON.stringify(parsedBody)}`);
            }
            console.info(`[TRACER][${itemTypeName}] Received ${beaconData.length} new items from Beacon`);
            if (beaconData.length === 0) {
                console.info(`No new ${itemTypeName} found querying after:`, lastUpdateSeen);
                processedAllItems = true;
                return;
            }
            lastUpdateSeen = await processChunk(beaconData, lastUpdateSeen, itemProcessor, itemTypeName);
            // Update the last update seen in SSM
            await (0, ssm_cache_1.putSsmParameter)(lastUpdateSeenSsmKey, lastUpdateSeen, {
                cacheValue: true,
                overwrite: true,
            });
            console.info('Last beacon update after:', await (0, ssm_cache_1.getSsmParameter)(lastUpdateSeenSsmKey));
            if (beaconData.length < maxItemsInChunk) {
                console.info(`Only ${beaconData.length} ${itemTypeName} in latest batch, less than the maximum of ${maxItemsInChunk}`, lastUpdateSeen);
                processedAllItems = true;
                return;
            }
        }
        else {
            if (response.status === 404) {
                console.info(`[TRACER][${itemTypeName}] Received 0 new items from Beacon`);
                processedAllItems = true;
                return;
            }
            console.error(`Beacon ${itemTypeName} API responded with an error status: ${response.status}`, await response.text());
        }
    }
    if (!processedAllItems) {
        console.warn(`Beacon poll queries the API the maximum of ${maxChunksToRead} times and still doesn't appear to have processed all ${itemTypeName}s. This could indicate an issue with the API or the client, or the settings may have to be adjusted to keep up with the volume of incidents.`);
    }
    else {
        console.info(`Beacon poller processed all ${itemTypeName}s in ${chunksRead} chunks`);
    }
};
exports.readApiInChunks = readApiInChunks;
