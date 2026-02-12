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
exports.transitionCaseStatuses = void 0;
const ssmByPath_1 = require("./ssmByPath");
const dataAccess_1 = require("./dataAccess");
const accountSidPattern = /\/[A-Za-z]+\/[A-Za-z0-9\-]+\/hrm\/scheduled-task\/case-status-transition-rules\/(?<accountSid>AC\w+)/;
/**
 * Cleanup all pending cleanup jobs
 * @returns void
 * @throws ContactJobCleanupError
 */
const transitionCaseStatuses = async () => {
    console.info(`[scheduled-task:case-status-transition]: Starting automatic case status transition...`);
    const ssmParametersPath = `/${process.env.NODE_ENV}/${process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION}/hrm/scheduled-task/case-status-transition-rules`;
    console.debug(`[scheduled-task:case-status-transition]: Path searched: ${ssmParametersPath}`);
    const parameters = await (0, ssmByPath_1.findSsmParametersByPath)(ssmParametersPath);
    const configs = parameters.map(({ Name, Value }) => {
        const accountSid = Name.match(accountSidPattern).groups.accountSid;
        return {
            accountSid,
            rules: JSON.parse(Value),
        };
    });
    console.debug(`[scheduled-task:case-status-transition]: Found automatic case status transition rules:`, configs.map(({ accountSid }) => accountSid));
    for (const { accountSid, rules } of configs) {
        console.debug(`[scheduled-task:case-status-transition]: Applying automatic case status transition rules for account:`, accountSid);
        for (const rule of rules) {
            console.debug(`[scheduled-task:case-status-transition]: Applying rule '${rule.description}' to ${accountSid}:`, rule);
            const ids = await (0, dataAccess_1.applyTransitionRuleToCases)(accountSid, rule);
            if (ids.length > 0) {
                console.info(`[scheduled-task:case-status-transition]: Updated the following cases in ${accountSid} to '${rule.targetStatus}' status because they had been in '${rule.startingStatus}' for ${rule.timeInStatusInterval}, as dictated by rule '${rule.description}':`, ids);
            }
            else {
                console.info(`[scheduled-task:case-status-transition]: No cases in ${accountSid} updated by rule ${rule.description}. They had to be in '${rule.startingStatus}' for ${rule.timeInStatusInterval} to be updated to '${rule.targetStatus}'.`);
            }
        }
    }
};
exports.transitionCaseStatuses = transitionCaseStatuses;
