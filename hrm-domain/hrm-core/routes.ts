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

import { IRouter, Router } from 'express';

import cases from './case/caseRoutesV0';
import contacts from './contact/contactRoutesV0';
import csamReports from './csam-report/csam-report-routes-v0';
import postSurveys from './post-survey/post-survey-routes-v0';
import referrals from './referral/referral-routes-v0';
import permissions from './permissions/permissions-routes-v0';
import profiles from './profile/profileRoutesV0';
import adminProfiles from './profile/adminProfileRoutesV0';
import adminContacts from './contact/adminContactRoutesV0';
import adminCases from './case/adminCaseRoutesV0';
import internalContacts from './contact/internalContactRoutesV0';
import { Permissions } from './permissions';
import internalProfiles from './profile/internalProfileRoutesV0';

export const HRM_ROUTES: {
  path: string;
  routerFactory: (rules: Permissions) => Router;
}[] = [
  { path: '/contacts', routerFactory: () => contacts },
  { path: '/cases', routerFactory: () => cases(true) },
  { path: '/postSurveys', routerFactory: () => postSurveys },
  { path: '/csamReports', routerFactory: () => csamReports },
  { path: '/profiles', routerFactory: () => profiles },
  { path: '/referrals', routerFactory: () => referrals() },
  { path: '/permissions', routerFactory: (rules: Permissions) => permissions(rules) },
];

export const apiV0 = (rules: Permissions) => {
  const router: IRouter = Router();
  HRM_ROUTES.forEach(({ path, routerFactory }) => router.use(path, routerFactory(rules)));

  return router;
};

export const ADMIN_ROUTES: {
  path: string;
  routerFactory: () => Router;
}[] = [
  { path: '/profiles', routerFactory: () => adminProfiles },
  { path: '/contacts', routerFactory: () => adminContacts },
  { path: '/cases', routerFactory: () => adminCases },
];

export const adminApiV0 = () => {
  const router: IRouter = Router();
  ADMIN_ROUTES.forEach(({ path, routerFactory }) => router.use(path, routerFactory()));

  return router;
};

export const INTERNAL_ROUTES: {
  path: string;
  routerFactory: () => Router;
}[] = [
  { path: '/contacts', routerFactory: () => internalContacts },
  { path: '/profiles', routerFactory: () => internalProfiles },
  { path: '/cases', routerFactory: () => cases(false) },
];

export const internalApiV0 = () => {
  const router: IRouter = Router();
  INTERNAL_ROUTES.forEach(({ path, routerFactory }) => router.use(path, routerFactory()));

  return router;
};
