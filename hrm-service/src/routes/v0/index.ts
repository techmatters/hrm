import cases from '../../case/case-routes-v0';
import contacts from '../../contact/contact-routes-v0';
import permissions from '../../permissions/permissions-routes-v0';
import { IRouter } from 'express';

const { Router } = require('express');
const postSurveys = require('./post-surveys');
const csamReports = require('./csam-reports');

const router: IRouter = Router();

router.use('/contacts', contacts);
router.use('/cases', cases);
router.use('/postSurveys', postSurveys);
router.use('/csamReports', csamReports);
router.use('/permissions', permissions);

export default router;
