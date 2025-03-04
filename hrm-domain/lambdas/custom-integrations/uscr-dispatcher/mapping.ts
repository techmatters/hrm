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

import type { CreateIncidentParams } from './beacon-service';
import type { CaseService, Contact } from '@tech-matters/hrm-types';

export const toCreateIncident = ({
  caseObj,
  contact,
}: {
  caseObj: CaseService;
  contact: Contact;
}): CreateIncidentParams => {
  const params: CreateIncidentParams = {
    contact_id: contact.id.toString(),
    case_id: caseObj.id,
    description: contact.rawJson?.childInformation?.incidentSummary as string,
    address: contact.rawJson?.childInformation?.specificLocation as string,
    caller_name: contact.rawJson?.callerInformation?.friendlyName as string,
    caller_number: contact.rawJson?.callerInformation?.phone as string,
    requestor_call_back: Boolean(contact.rawJson?.callerInformation?.callbackRequested),
    person_demographics: {
      first_name: contact.rawJson?.childInformation?.firstName as string,
      last_name: contact.rawJson?.childInformation?.lastName as string,
      nick_name: contact.rawJson?.childInformation?.nickname as string,
      age: contact.rawJson?.childInformation?.age as string,
      gender: contact.rawJson?.childInformation?.gender as string,
      race: contact.rawJson?.childInformation?.race as string,
    },
    category_id: 123,
    incident_class_id: 123,
    is_officer_on_standby: contact.rawJson?.callerInformation?.officerStandby as boolean,
  };

  return params;
};
