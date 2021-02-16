const { Router } = require('express');
const models = require('../../models');

const healthRouter = Router();

import { SerializedResponse } from '../../types';

healthRouter.get('/', async (req, res) => {
  const response: SerializedResponse = {
    Message: 'Welcome to the HRM!!!!!',
    Datetime: new Date(),
  };

  res.json(response);
});

module.exports = healthRouter;
