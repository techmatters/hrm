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
exports.canViewCaseSection = exports.canAddCaseSection = exports.canEditCaseSection = void 0;
const permissions_1 = require("../../permissions");
const canPerformCaseAction_1 = require("../canPerformCaseAction");
exports.canEditCaseSection = (0, canPerformCaseAction_1.canPerformCaseAction)(() => [permissions_1.actionsMaps.case.EDIT_CASE_SECTION], req => req.params.caseId);
exports.canAddCaseSection = (0, canPerformCaseAction_1.canPerformCaseAction)(() => [permissions_1.actionsMaps.case.ADD_CASE_SECTION], ({ params }) => params.caseId);
exports.canViewCaseSection = (0, canPerformCaseAction_1.canPerformCaseAction)(() => [permissions_1.actionsMaps.case.VIEW_CASE], req => req.params.caseId);
