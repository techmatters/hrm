const { Router } = require('express');
const contacts = require('./contacts');
const cases = require('./cases');

const router = Router();

router.use('/contacts', contacts);
router.use('/cases', cases);

module.exports = router;
