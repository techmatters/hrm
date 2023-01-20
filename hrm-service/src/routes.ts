import { IRouter, Router } from 'express';
import { stub } from '@tech-matters/resources-service';

import cases from './case/case-routes-v0';
import contacts from './contact/contact-routes-v0';
import csamReports from './csam-report/csam-report-routes-v0';
import postSurveys from './post-survey/post-survey-routes-v0';
import permissions from './permissions/permissions-routes-v0';
import { Permissions } from './permissions';

export const HRM_ROUTES: [string, (rules: Permissions) => Router][] = [
  ['/contacts', () => contacts],
  ['/cases', () => cases],
  ['/postSurveys', () => postSurveys],
  ['/csamReports', () => csamReports],
  ['/permissions', (rules: Permissions) => permissions(rules)],
];

export const apiV0 = (rules: Permissions) => {
  const router: IRouter = Router();
  HRM_ROUTES.forEach(([route, routerFactory]) => router.use(route, routerFactory(rules)));

  router.get('/resources', async (req, res) => {
    const stubResult = await stub();
    res.json(stubResult);
  });

  return router;
};
