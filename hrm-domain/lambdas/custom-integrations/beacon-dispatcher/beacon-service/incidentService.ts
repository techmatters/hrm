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
import { newErr, newOk } from '@tech-matters/types';

export type PendingIncident = {
  id: number;
};

type CreateIncidentResponse = {
  pending_incident: PendingIncident;
  incident: { id: number };
} & ({ status: 'success' } | { status: 'exists'; message: string });

export type CreateIncidentParams = {
  contact_id: string;
  case_id: number;
};

export const createIncident = async ({
  environment,
  helplineShortCode,
  incidentParams,
}: {
  environment: string;
  helplineShortCode: string;
  incidentParams: CreateIncidentParams;
}) => {
  try {
    const [baseUrl, apiKey] = await Promise.all([
      getSsmParameter(
        `/${environment}/hrm/custom-integration/${helplineShortCode}/beacon_base_url`,
      ),
      getSsmParameter(
        `/${environment}/hrm/custom-integration/${helplineShortCode}/beacon_api_key`,
      ),
    ]);

    const fullUrl = `${baseUrl}/api/aselo/incidents`;
    const apiCallStart = Date.now();
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': apiKey,
      },
      body: JSON.stringify(incidentParams),
    });
    const apiCallMillis = Date.now() - apiCallStart;

    console.info(
      `[TRACER][incident dispatch] Beacon API responded after ${apiCallMillis}ms with status:`,
      response.status,
    );

    if (!response.ok) {
      const error = await response.json();
      return newErr({
        error,
        message: 'Failed calling Beacon API',
      });
    }

    const data = (await response.json()) as CreateIncidentResponse;
    return newOk({ data });
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : JSON.stringify(err),
      error: 'createIncident: unexpected error',
    });
  }
};
