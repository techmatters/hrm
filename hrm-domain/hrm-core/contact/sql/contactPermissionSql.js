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
exports.listContactsPermissionWhereClause = void 0;
const sqlGenerators_1 = require("../../permissions/queryGenerators/sqlGenerators");
const conditionWhereClauses = (contactsTableAlias) => ({
    isOwner: `"${contactsTableAlias}"."twilioWorkerId" = $<twilioWorkerSid>`,
    timeBasedCondition: ({ createdDaysAgo, createdHoursAgo }) => {
        const timeClauses = [];
        if (typeof createdHoursAgo === 'number') {
            timeClauses.push(`"${contactsTableAlias}"."timeOfContact" > CURRENT_TIMESTAMP - interval '${createdHoursAgo} hours'`);
        }
        if (typeof createdDaysAgo === 'number') {
            timeClauses.push(`"${contactsTableAlias}"."timeOfContact" > CURRENT_TIMESTAMP - interval '${createdDaysAgo} days'`);
        }
        return timeClauses.length ? `(${timeClauses.join(' AND ')})` : '1=1';
    },
});
const listContactsPermissionWhereClause = (contactListConditionSets, userIsSupervisor, contactsTableAlias = 'contacts') => {
    const [clause] = (0, sqlGenerators_1.listPermissionWhereClause)(contactListConditionSets, userIsSupervisor, conditionWhereClauses(contactsTableAlias));
    return clause ?? '1=1';
};
exports.listContactsPermissionWhereClause = listContactsPermissionWhereClause;
