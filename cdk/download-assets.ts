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

import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

type DownloadAssetsParams = {
  accountSids: string[];
};

export type Assets = Awaited<ReturnType<typeof downloadAssets>>;

const downloadAssets = async ({ accountSids }: DownloadAssetsParams) => {
  const assets = [
    {
      name: 'callRecording',
      url: 'https://assets-development.tl.techmatters.org/tests/callRecording.wav',
      path: 'callRecording.wav',
      additionalPaths: accountSids.map(
        accountSid =>
          `voice-recordings/${accountSid}/mockConversationId/callRecording.wav`,
      ),
    },
  ];

  for (const asset of assets) {
    const assetsDir = './cdk/assets';
    const mainPath = `${assetsDir}/${asset.path}`;
    const res = await fetch(asset.url);

    if (res.ok) {
      const buffer = await res.buffer();
      await fs.writeFile(mainPath, buffer);

      for (const additionalPath of asset.additionalPaths) {
        const fullPath = `${assetsDir}/${additionalPath}`;
        const directoryPath = path.dirname(fullPath);
        await fs.mkdir(directoryPath, { recursive: true });
        await fs.writeFile(fullPath, buffer);
      }
    } else {
      console.error(`Failed to fetch ${asset.url} with status ${res.status}`);
    }
  }

  return assets;
};

export default downloadAssets;
