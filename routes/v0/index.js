const { Router } = require('express');
const contacts = require('./contacts');
const cases = require('./cases');
const postSurveys = require('./post-surveys');
const csamReports = require('./csam-reports');

const router = Router();

router.use('/contacts', contacts);
router.use('/cases', cases);
router.use('/postSurveys', postSurveys);
router.use('/csamReports', csamReports);

module.exports = router;
