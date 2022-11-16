import { IRouter, Router } from 'express';

import cases from '../../case/case-routes-v0';
import contacts from '../../contact/contact-routes-v0';
import csamReports from '../../csam-report/csam-report-routes-v0';
import permissions from '../../permissions/permissions-routes-v0';
import { Permissions } from '../../permissions';

const postSurveys = require('./post-surveys');

export default (rules: Permissions) => {
  const router: IRouter = Router();

  router.use('/contacts', contacts);
  router.use('/cases', cases);
  router.use('/postSurveys', postSurveys);
  router.use('/csamReports', csamReports);
  router.use('/permissions', permissions(rules));
  return router;
};
