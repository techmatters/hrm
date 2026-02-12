"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.toCreateIncident = void 0;
const toCreateIncident = ({ caseObj, contact, }) => {
    const { callerInformation, childInformation, caseInformation, categories } = contact.rawJson || {};
    const category = Object.values(categories || {})
        .find(c => c.length)
        ?.shift();
    return {
        contact_id: contact.id.toString(),
        case_id: parseInt(caseObj.id),
        description: [
            ...(callerInformation?.reportingDistrict
                ? [`Reporting District: ${callerInformation.reportingDistrict}`]
                : []),
            ...(callerInformation?.identifier911
                ? [`911 Incident #${callerInformation.identifier911}`]
                : []),
            childInformation?.incidentSummary,
        ].join('; '),
        address: childInformation?.specificLocation,
        caller_name: callerInformation?.friendlyName,
        caller_number: callerInformation?.phone,
        requestor_call_back: Boolean(callerInformation?.callbackRequested),
        person_demographics: {
            first_name: childInformation?.firstName,
            last_name: childInformation?.lastName,
            nick_name: childInformation?.nickname,
            age: childInformation?.age,
            gender: childInformation?.gender,
            race: childInformation?.race,
        },
        category: category,
        priority: caseInformation?.priority,
        is_officer_on_standby: callerInformation?.officerStandby,
    };
};
exports.toCreateIncident = toCreateIncident;
