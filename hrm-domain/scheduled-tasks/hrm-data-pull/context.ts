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
import { HrmAccountId } from '@tech-matters/types';
export { maxPermissions } from '@tech-matters/hrm-core/permissions/index';

// const sanitizeEnv = (env: string) => (env === 'local' ? 'development' : env);

let hrmEnv = process.env.NODE_ENV ?? 'development';
let shortCode = process.env.HL;

type ContextConfigOverrides = {
  shortCodeOverride?: string;
  hrmEnvOverride?: string;
};

type Context = {
  accountSid: HrmAccountId;
  bucket: string;
  hrmEnv: string;
  shortCode: string;
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
    const accountSid = (await getSsmParameter(
      `/${hrmEnv}/twilio/${shortCode}/account_sid`,
    )) as HrmAccountId;
    const bucket = await getSsmParameter(`/${hrmEnv}/s3/${accountSid}/docs_bucket_name`);

    return {
      accountSid,
      bucket,
      hrmEnv,
      shortCode,
    };
  }

  return context;
};
