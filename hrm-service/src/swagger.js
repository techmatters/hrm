const swaggerUi = require('swagger-ui-express');
const yaml = require('js-yaml');
const fs = require('fs');

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    servers: [
      {
        description: 'localhost',
        url: 'http://localhost:8080',
      },
      {
        description: 'staging',
        url: 'https://hrm-staging.tl.techmatters.org',
      },
    ],
    info: {
      title: 'HRM',
      version: '0.3.6',
    },
  },
  apis: ['../**/*.ts'], // files containing annotations as above
};

const swaggerDocument = swaggerJsdoc(options);

// const swaggerDocument = yaml.safeLoad(fs.readFileSync(`${__dirname}/../swagger.yaml`, 'utf8'));

const runWhenNotProduction = app => {
  const isProduction = process.env.NODE_ENV && process.env.NODE_ENV === 'production';

  if (!isProduction) {
    app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  }
};

module.exports = { runWhenNotProduction };
