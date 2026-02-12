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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.internalApiV0 = exports.INTERNAL_ROUTES = exports.adminApiV0 = exports.ADMIN_ROUTES = exports.apiV0 = exports.HRM_ROUTES = void 0;
const express_1 = require("express");
const caseRoutesV0_1 = __importDefault(require("./case/caseRoutesV0"));
const contactRoutesV0_1 = __importDefault(require("./contact/contactRoutesV0"));
const csamReportRoutesV0_1 = __importDefault(require("./csam-report/csamReportRoutesV0"));
const postSurveyRoutesV0_1 = __importDefault(require("./post-survey/postSurveyRoutesV0"));
const referral_routes_v0_1 = __importDefault(require("./referral/referral-routes-v0"));
const permissions_routes_v0_1 = __importDefault(require("./permissions/permissions-routes-v0"));
const profileRoutesV0_1 = __importDefault(require("./profile/profileRoutesV0"));
const adminProfileRoutesV0_1 = __importDefault(require("./profile/adminProfileRoutesV0"));
const adminContactRoutesV0_1 = __importDefault(require("./contact/adminContactRoutesV0"));
const adminCaseRoutesV0_1 = __importDefault(require("./case/adminCaseRoutesV0"));
const internalProfileRoutesV0_1 = __importDefault(require("./profile/internalProfileRoutesV0"));
// Need to create these first - the route handlers don't activate if they are instantiated just in time
const publicCases = (0, caseRoutesV0_1.default)(true);
const internalCases = (0, caseRoutesV0_1.default)(false);
const publicContacts = (0, contactRoutesV0_1.default)(true);
const internalContacts = (0, contactRoutesV0_1.default)(false);
const publicPostSurveys = (0, postSurveyRoutesV0_1.default)(true);
const internalPostSurveys = (0, postSurveyRoutesV0_1.default)(false);
exports.HRM_ROUTES = [
    { path: '/contacts', routerFactory: () => publicContacts },
    { path: '/cases', routerFactory: () => publicCases },
    { path: '/postSurveys', routerFactory: () => publicPostSurveys },
    { path: '/csamReports', routerFactory: () => csamReportRoutesV0_1.default },
    { path: '/profiles', routerFactory: () => profileRoutesV0_1.default },
    { path: '/referrals', routerFactory: () => (0, referral_routes_v0_1.default)() },
    { path: '/permissions', routerFactory: (rules) => (0, permissions_routes_v0_1.default)(rules) },
];
const apiV0 = (rules) => {
    const router = (0, express_1.Router)();
    exports.HRM_ROUTES.forEach(({ path, routerFactory }) => router.use(path, routerFactory(rules)));
    return router;
};
exports.apiV0 = apiV0;
exports.ADMIN_ROUTES = [
    { path: '/profiles', routerFactory: () => adminProfileRoutesV0_1.default },
    { path: '/contacts', routerFactory: () => adminContactRoutesV0_1.default },
    { path: '/cases', routerFactory: () => adminCaseRoutesV0_1.default },
];
const adminApiV0 = () => {
    const router = (0, express_1.Router)();
    exports.ADMIN_ROUTES.forEach(({ path, routerFactory }) => router.use(path, routerFactory()));
    return router;
};
exports.adminApiV0 = adminApiV0;
exports.INTERNAL_ROUTES = [
    { path: '/contacts', routerFactory: () => internalContacts },
    { path: '/profiles', routerFactory: () => internalProfileRoutesV0_1.default },
    { path: '/cases', routerFactory: () => internalCases },
    { path: '/postSurveys', routerFactory: () => internalPostSurveys },
];
const internalApiV0 = () => {
    const router = (0, express_1.Router)();
    exports.INTERNAL_ROUTES.forEach(({ path, routerFactory }) => router.use(path, routerFactory()));
    return router;
};
exports.internalApiV0 = internalApiV0;
