const swaggerUi = require('swagger-ui-express');
const yaml = require('js-yaml');
const fs = require('fs');

const swaggerDocument = yaml.safeLoad(fs.readFileSync('../swagger.yaml', 'utf8'));

const runWhenNotProduction = app => {
  const isProduction = process.env.NODE_ENV && process.env.NODE_ENV === 'production';

  if (!isProduction) {
    app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  }
};

module.exports = { runWhenNotProduction };
