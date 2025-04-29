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
  console.log(
    '>>>> categories will be',
    Object.values(contact.rawJson?.categories || {})[0][0],
  );
  const { callerInformation, childInformation, caseInformation, categories } =
    contact.rawJson || {};
  return {
    contact_id: contact.id.toString(),
    case_id: caseObj.id,
    description: [
      ...(callerInformation?.reportingDistrict
        ? [`Reporting District: ${callerInformation.reportingDistrict}`]
        : []),
      ...(callerInformation?.identifier911
        ? [`911 Incident #${callerInformation.identifier911}`]
        : []),
      childInformation?.incidentSummary,
    ].join('; ') as string,
    address: childInformation?.specificLocation as string,
    caller_name: callerInformation?.friendlyName as string,
    caller_number: callerInformation?.phone as string,
    requestor_call_back: Boolean(callerInformation?.callbackRequested),
    person_demographics: {
      first_name: childInformation?.firstName as string,
      last_name: childInformation?.lastName as string,
      nick_name: childInformation?.nickname as string,
      age: childInformation?.age as string,
      gender: childInformation?.gender as string,
      race: childInformation?.race as string,
    },
    category: Object.values(categories || {})[0][0],
    priority: caseInformation?.priority as string,
    is_officer_on_standby: callerInformation?.officerStandby as boolean,
  };
};
