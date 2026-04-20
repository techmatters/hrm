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

export const command = 'limina-jobs';
export const describe = 'Run concurrent transcription jobs against the limina service';

export const builder = {
  f: {
    alias: 'fileName',
    describe: 'Audio file name (must exist in the shared audio folder)',
    demandOption: true,
    type: 'string',
  },
  j: {
    alias: 'concurrentJobs',
    describe: 'Number of concurrent transcription jobs to run',
    demandOption: true,
    type: 'number',
  },
};

export const handler = async ({
  fileName,
  concurrentJobs,
}: {
  fileName: string;
  concurrentJobs: number;
}) => {
  console.info('Running limina transcription jobs', { fileName, concurrentJobs });
  try {
    const result = await fetch(
      new URL('/proxy/limina-jobs', process.env.PROXY_SERVICE_URI ?? 'http://localhost:3000'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName, concurrentJobs }),
      },
    );
    console.log(JSON.stringify(await result.json(), null, 2));
  } catch (err) {
    console.error(err);
  }
};
