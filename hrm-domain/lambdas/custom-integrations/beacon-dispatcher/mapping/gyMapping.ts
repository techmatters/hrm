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

import type { CreateIncidentParams } from '../beacon-service';
import type { CaseService, Contact } from '@tech-matters/hrm-types';

type GyCreateIncidentParams = CreateIncidentParams & {
  class: string;
  incident_description: string;
  caller_number: string;
  call_received: string;
  created_at: string;
};

export const toCreateIncident = ({
  caseObj,
  contact,
}: {
  caseObj: CaseService;
  contact: Contact;
}): GyCreateIncidentParams => {
  const { categories } = contact.rawJson || {};

  const category = Object.values(categories || {}).find(c => c.length)?.[0];
  return {
    contact_id: contact.id.toString(),
    case_id: parseInt(caseObj.id),
    call_received: contact.timeOfContact ?? '',
    caller_number: contact.number ?? '',
    class: category ?? '',
    incident_description:
      contact.rawJson?.childInformation.incidentDescription?.toString() ?? '',
    created_at: contact.createdAt,
  };
};
