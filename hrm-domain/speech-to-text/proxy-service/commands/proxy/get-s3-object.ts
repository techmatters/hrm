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

export const command = 'get-s3-object';
export const describe = 'Download a file from an S3 bucket to the local audio folder';

export const builder = {
  b: {
    alias: 'bucket',
    describe: 'S3 bucket name',
    demandOption: true,
    type: 'string',
  },
  f: {
    alias: 'fileName',
    describe: 'File name (S3 key and local file name)',
    demandOption: true,
    type: 'string',
  },
};

export const handler = async ({ bucket, fileName }: { bucket: string; fileName: string }) => {
  console.info('Downloading S3 object', { bucket, fileName });
  try {
    const result = await fetch(
      new URL(
        `/proxy/get-s3-object?bucket=${encodeURIComponent(bucket)}&fileName=${encodeURIComponent(fileName)}`,
        process.env.PROXY_SERVICE_URI ?? 'http://localhost:3000',
      ),
    );
    console.log(await result.json());
  } catch (err) {
    console.error(err);
  }
};
