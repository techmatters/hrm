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
  incident_id: number;
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
  incident_class_id: number;
  contact_id: string;
  case_id: string;
  caller_name: string;
  caller_number: string;
  description: string;
  address: string;
  category_id: number;
  requestor_call_back: boolean;
  person_demographics: {
    name: string;
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
      getSsmParameter(`/${environment}/custom-integrations/us-east-1/beacon_api_key`),
      getSsmParameter(`/${environment}/custom-integrations/us-east-1/beacon_base_url`),
    ]);

    const fullUrl = `${baseUrl}/api/aselo/incidents`;

    // @ts-ignore global fetch available because node 18
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': apiKey,
      },
      body: JSON.stringify(incidentParams),
    });

    if (!response.ok) {
      const error = await response.json();
      return newErr({
        message: String(error),
        error: 'createIncident: request failed',
      });
    }

    const data = (await response.json()) as CreateIncidentResponse;
    return newOk({ data });
  } catch (err) {
    return newErr({
      message: err instanceof Error ? err.message : String(err),
      error: 'createIncident: unexpected error',
    });
  }
};
