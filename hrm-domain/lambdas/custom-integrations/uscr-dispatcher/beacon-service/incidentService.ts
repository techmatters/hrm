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
  case_id: number;
  contact_id: string;
  description: string;
  address: string;
  category_id: number;
  incident_class_id: number;
  status: string;
  caller_name: string;
  caller_number: string;
  created_at: string;
  updated_at: string;
};
type CreateIncidentResponse = {
  pending_incident: PendingIncident;
  incident: any;
} & ({ status: 'success' } | { status: 'exists'; message: string });

export type CreateIncidentParams = {
  contact_id: string;
  case_id: number;
  caller_name: string;
  caller_number: string;
  description: string;
  address: string;
  category: string;
  priority: string;
  requestor_call_back: boolean;
  person_demographics: {
    first_name: string;
    last_name: string;
    nick_name: string;
    age: string;
    gender: string;
    race: string;
  };
  is_officer_on_standby: boolean;
};

export const createIncident = async ({
  environment,
  incidentParams,
}: {
  environment: string;
  incidentParams: CreateIncidentParams;
}) => {
  try {
    const [baseUrl, apiKey] = await Promise.all([
      getSsmParameter(`/${environment}/hrm/custom-integration/uscr/beacon_base_url`),
      getSsmParameter(`/${environment}/hrm/custom-integration/uscr/beacon_api_key`),
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
