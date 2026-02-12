"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ruleFileWithOnePermittedOrDeniedAction = ruleFileWithOnePermittedOrDeniedAction;
exports.ruleFileActionOverride = ruleFileActionOverride;
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
const rulesMap_1 = require("@tech-matters/hrm-core/permissions/rulesMap");
function ruleFileWithOnePermittedOrDeniedAction(permittedAction, isPermitted) {
    const ruleEntries = Object.keys(rulesMap_1.rulesMap.open).map(key => [
        key,
        (key === permittedAction && isPermitted) || (key !== permittedAction && !isPermitted)
            ? [['everyone']]
            : [],
    ]);
    return Object.fromEntries(ruleEntries);
}
function ruleFileActionOverride(targetAction, isPermitted) {
    return {
        [targetAction]: isPermitted ? [['everyone']] : [],
    };
}
