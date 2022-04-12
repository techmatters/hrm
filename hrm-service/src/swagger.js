const swaggerUi = require('swagger-ui-express');
const yaml = require('js-yaml');
const fs = require('fs');

const runWhenNotProductionOrTest = app => {
  const isProduction = process.env.NODE_ENV && process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV && process.env.NODE_ENV === 'test';

  if (!isProduction && !isTest) {
    const swaggerDocument = yaml.safeLoad(
      fs.readFileSync(`${__dirname}/../../swagger.yaml`, 'utf8'),
    );
    app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  }
};

module.exports = { runWhenNotProductionOrTest };
