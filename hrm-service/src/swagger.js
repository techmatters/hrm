const swaggerUi = require('swagger-ui-express');

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
  apis: ['../routes/*.ts', '../routes/*.js', '../**/*.ts', '../swagger.yaml'], // files containing annotations as above
};

const swaggerDocument = swaggerJsdoc(options);

const runWhenNotProduction = app => {
  const isProduction = process.env.NODE_ENV && process.env.NODE_ENV === 'production';

  if (!isProduction) {
    app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  }
};

module.exports = { runWhenNotProduction };
