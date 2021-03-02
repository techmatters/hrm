const { Router } = require('express');
// eslint-disable-next-line import/no-unresolved
const health = require('./health');
// eslint-disable-next-line import/no-unresolved
const contacts = require('./contacts');
// eslint-disable-next-line import/no-unresolved
const cases = require('./cases');

const router = Router();

router.use('/health', health);
router.use('/contacts', contacts);
router.use('/cases', cases);

module.exports = router;
