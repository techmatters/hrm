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

import { getSsmParameter, putSsmParameter } from '@tech-matters/ssm-cache';

type PollConfig<TItem> = {
  url: URL;
  headers: Record<string, string>;
  lastUpdateSeenSsmKey: string;
  itemProcessor: (item: TItem) => Promise<string>;
  maxItemsInChunk: number;
  maxChunksToRead: number;
  itemTypeName?: string; // Just for logging
};

const processChunk = async <TItem>(
  items: TItem[],
  lastSeen: string,
  itemProcessor: (item: TItem) => Promise<string>,
  itemTypeName: string = 'item',
): Promise<string> => {
  let updatedLastSeen = lastSeen;
  try {
    for (const item of items) {
      console.debug(`Start processing ${itemTypeName}:`, lastSeen);
      updatedLastSeen = await itemProcessor(item);
    }
  } catch (error) {
    console.error(`Error processing ${itemTypeName}, abandoning batch:`, error);
  }
  return updatedLastSeen;
};

export const readApiInChunks = async <TItem>({
  url,
  headers,
  lastUpdateSeenSsmKey,
  maxItemsInChunk,
  maxChunksToRead,
  itemProcessor,
  itemTypeName = 'item',
}: PollConfig<TItem>) => {
  let lastUpdateSeen = await getSsmParameter(lastUpdateSeenSsmKey);
  let processedAllItems = false;
  for (let i = 0; i < maxChunksToRead; i++) {
    console.info(`Last ${itemTypeName} update before:`, lastUpdateSeen);
    // Query Beacon API
    url.searchParams.set('updatedAfter', lastUpdateSeen);
    url.searchParams.set('max', maxItemsInChunk.toString());
    console.info('Querying:', url);
    const response = await fetch(url, { headers });
    console.debug(`Beacon ${itemTypeName} API responded with status:`, response.status);
    if (response.ok) {
      const beaconData = (await response.json()) as TItem[];
      if (!Array.isArray(beaconData)) {
        throw new Error(
          `Beacon ${itemTypeName} API did not return a valid response: ${JSON.stringify(
            beaconData,
          )}`,
        );
      }
      console.info(`Received ${beaconData.length} new ${itemTypeName}s from Beacon`);
      if (beaconData.length === 0) {
        console.info(`No new ${itemTypeName} found querying after:`, lastUpdateSeen);
        processedAllItems = true;
        return;
      }
      lastUpdateSeen = await processChunk<TItem>(
        beaconData,
        lastUpdateSeen,
        itemProcessor,
      );
      // Update the last update seen in SSM
      await putSsmParameter(lastUpdateSeenSsmKey, lastUpdateSeen);
      console.info(
        'Last beacon update after:',
        await getSsmParameter(lastUpdateSeenSsmKey),
      );
      if (beaconData.length < maxItemsInChunk) {
        console.info(
          `Only ${beaconData.length} ${itemTypeName} in latest batch, less than the maximum of ${maxItemsInChunk}`,
          lastUpdateSeen,
        );
        processedAllItems = true;
        return;
      }
    }
  }
  if (!processedAllItems) {
    console.warn(
      `Beacon poll queries the API the maximum of ${maxChunksToRead} times and still doesn't appear to have processed all ${itemTypeName}s. This could indicate an issue with the API or the client, or the settings may have to be adjusted to keep up with the volume of incidents.`,
    );
  }
};
