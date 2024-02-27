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

import { getSsmParameter } from '@tech-matters/ssm-cache';
import { rulesMap } from '@tech-matters/hrm-core/permissions/rulesMap';

const sanitizeEnv = (env: string) => (env === 'local' ? 'development' : env);

let hrmEnv = sanitizeEnv(process.env.NODE_ENV ?? 'development');
let shortCode = process.env.HL ?? (hrmEnv === 'development' ? 'AS' : 'CA');

type ContextConfigOverrides = {
  shortCodeOverride?: string;
  hrmEnvOverride?: string;
};

type Context = {
  accountSid: string;
  bucket: string;
};

let context: Context;

export const applyContextConfigOverrides = ({
  shortCodeOverride,
  hrmEnvOverride,
}: ContextConfigOverrides) => {
  hrmEnv = hrmEnvOverride ?? hrmEnv;
  shortCode = shortCodeOverride ?? shortCode;
};

export const getContext = async (): Promise<Context> => {
  if (!context) {
    const accountSid = await getSsmParameter(
      `/${hrmEnv}/twilio/${shortCode}/account_sid`,
    );
    const bucket = await getSsmParameter(`/${hrmEnv}/s3/${accountSid}/docs_bucket_name`);

    return {
      accountSid,
      bucket,
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
  permissions: rulesMap.open,
};
