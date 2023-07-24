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

import { S3 } from 'aws-sdk';
import { getSsmParameter } from '@tech-matters/ssm-cache';

const sanitizeEnv = (env: string) => (env === 'local' ? 'development' : env);

const hrmEnv = sanitizeEnv(process.env.NODE_ENV ?? 'development');
const shortCode = hrmEnv === 'development' ? 'AS' : 'CA';

type Context = {
  accountSid: string;
  bucketName: string;
  s3Client: S3;
};

let context;

export const getContext = async (): Promise<Context> => {
  if (!context) {
    const accountSid = await getSsmParameter(
      `/${hrmEnv}/twilio/${shortCode}/account_sid`,
    );
    const bucketName = await getSsmParameter(
      `/${hrmEnv}/s3/${accountSid}/docs_bucket_name`,
    );
    const s3Client = new S3();

    return {
      accountSid,
      bucketName,
      s3Client,
    };
  }

  return context;
};

export const maxPermissions = {
  can: () => true,
  user: {
    workerSid: 'WKxxx',
    roles: ['supervisor'],
    isSupervisor: true,
  },
  searchPermissions: {
    canOnlyViewOwnCases: false,
    canOnlyViewOwnContacts: false,
  },
};
