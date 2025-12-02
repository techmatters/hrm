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

import type { HrmAccountId } from '@tech-matters/types';
import type { ManuallyTriggeredNotificationOperation } from '@tech-matters/hrm-types';
import { getSsmParameter } from '@tech-matters/ssm-cache';
import { getHRMInternalEndpointAccess } from '@tech-matters/service-discovery';
import { getAdminV0URL } from '../hrmInternalConfig';
// import envRegionMap from '../../../../.github/workflows/config/environment-region-map.json';

const getAccountSid = ({
  environment,
  shortCode,
}: {
  environment: string;
  shortCode: string;
}) => {
  return getSsmParameter(`/${environment}/twilio/${shortCode.toUpperCase()}/account_sid`);
};

const requestRenotify = async ({
  accountSid,
  authKey,
  dateFrom,
  dateTo,
  entityType,
  internalResourcesUrl,
  operation,
}: {
  operation: ManuallyTriggeredNotificationOperation;
  entityType: 'contacts' | 'cases' | 'profiles';
  internalResourcesUrl: URL;
  accountSid: HrmAccountId;
  authKey: string;
  dateFrom: string;
  dateTo: string;
}) => {
  const url = getAdminV0URL(
    internalResourcesUrl,
    accountSid,
    `/${entityType}/${operation}`,
  );

  console.info(`Submitting request to ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${authKey}`,
    },
    body: JSON.stringify({ dateFrom, dateTo }),
  });

  if (!response.ok) {
    console.error(
      `Failed to submit request for ${operation} ${entityType}: ${response.statusText}`,
    );
    console.info(await response.text());
  } else {
    console.info(
      `Performing ${operation} ${entityType} from ${dateFrom} to ${dateTo}...`,
    );
    console.info(await response.text());
  }
};

export const renotify = async ({
  region,
  environment,
  accounts,
  dateFrom,
  dateTo,
  contacts,
  cases,
  profiles,
  operation,
}: {
  region: string;
  environment: string;
  accounts: string[];
  dateFrom: string;
  dateTo: string;
  contacts: boolean;
  cases: boolean;
  profiles: boolean;
  operation: ManuallyTriggeredNotificationOperation;
}) => {
  try {
    // TODO: access all regions (once eu-west-1 is accessible via management vpn)
    // console.log('envRegionMap', envRegionMap);
    const timestamp = new Date().getTime();
    const assumeRoleParams = {
      RoleArn: 'arn:aws:iam::712893914485:role/tf-admin',
      RoleSessionName: `hrm-admin-cli-${timestamp}`,
    };

    const { authKey, internalResourcesUrl } = await getHRMInternalEndpointAccess({
      region,
      environment,
      assumeRoleParams,
    });

    for (const account of accounts) {
      const accountSid = (await getAccountSid({
        environment,
        shortCode: account,
      })) as HrmAccountId;

      console.log(`Processing ${operation} request for account ${accountSid}`);
      if (contacts) {
        await requestRenotify({
          operation,
          entityType: 'contacts',
          internalResourcesUrl,
          accountSid,
          authKey,
          dateFrom,
          dateTo,
        });
      }

      if (cases) {
        await requestRenotify({
          operation,
          entityType: 'cases',
          internalResourcesUrl,
          accountSid,
          authKey,
          dateFrom,
          dateTo,
        });
      }

      if (profiles) {
        await requestRenotify({
          operation,
          entityType: 'profiles',
          internalResourcesUrl,
          accountSid,
          authKey,
          dateFrom,
          dateTo,
        });
      }
    }
  } catch (err) {
    console.error(err);
  }
};
