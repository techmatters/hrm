import { IRouter, Router } from 'express';

import cases from './case/case-routes-v0';
import contacts from './contact/contact-routes-v0';
import csamReports from './csam-report/csam-report-routes-v0';
import postSurveys from './post-survey/post-survey-routes-v0';
import permissions from './permissions/permissions-routes-v0';
import { Permissions } from './permissions';

export const HRM_ROUTES: { path: string; routerFactory: (rules: Permissions) => Router }[] = [
  { path: '/contacts', routerFactory: () => contacts },
  { path: '/cases', routerFactory: () => cases },
  { path: '/postSurveys', routerFactory: () => postSurveys },
  { path: '/csamReports', routerFactory: () => csamReports },
  { path: '/permissions', routerFactory: (rules: Permissions) => permissions(rules) },
];

export const apiV0 = (rules: Permissions) => {
  const router: IRouter = Router();
  HRM_ROUTES.forEach(({ path, routerFactory }) => router.use(path, routerFactory(rules)));

  return router;
};
