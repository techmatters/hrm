const createError = require('http-errors');
const express = require('express');
require('express-async-errors');
const logger = require('morgan');
const cors = require('cors');
const TokenValidator = require('twilio-flex-token-validator').validator;

const models = require('./models');
const swagger = require('./swagger');
const { apiV0 } = require('./routes');

const app = express();
const apiKey = process.env.API_KEY;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const version = '0.3.6';

if (!apiKey) {
  throw new Error('Must specify API key');
}

console.log(`Starting HRM version ${version}`);

swagger.runWhenNotProduction(app);

const { Contact, Case, CaseAudit, sequelize } = models;
const ContactController = require('./controllers/contact-controller')(Contact);
const CaseController = require('./controllers/case-controller')(Case, sequelize);
const CaseAuditController = require('./controllers/case-audit-controller')(CaseAudit);

console.log('After connect attempt');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

app.get('/', (req, res) => {
  res.json({
    Message: 'Welcome to the HRM!',
  });
});

app.options('/contacts', cors());

function unauthorized(res) {
  const authorizationFailed = { error: 'Authorization failed' };
  console.log(`[authorizationMiddleware]: ${JSON.stringify(authorizationFailed)}`);
  res.status(401).json(authorizationFailed);
}

const authorizationMiddleware = async (req, res, next) => {
  if (!req || !req.headers || !req.headers.authorization) {
    return unauthorized(res);
  }

  const authHeader = req.headers.authorization;
  if (authHeader.startsWith('Bearer')) {
    const token = authHeader.replace('Bearer ', '');
    try {
      const tokenResult = await TokenValidator(token, accountSid, authToken);
      console.log('Token authentication successful');
      console.log(tokenResult);
      return next();
    } catch {
      console.log("Token authentication failed");
    }
  } else if (authHeader.startsWith('Basic')) {
    const base64Key = Buffer.from(authHeader.replace('Basic ', ''), 'base64');
    if (base64Key.toString('ascii') === apiKey) {
      console.log("API Key authentication successful");
      return next();
    } else {
      console.log("API Key authentication failed");
    }
  }

  return unauthorized(res);
}

app.use(authorizationMiddleware);

/**
 * Middleware that adds the account sid (taken from path) to the request object, so we can use it in the routes.
 * NOTE: If we ever move this project to Typescript: https://dev.to/kwabenberko/extend-express-s-request-object-with-typescript-declaration-merging-1nn5
 */
const addAccountSid = (req, res, next) => {
  req.accountSid = req.params.accountSid;
  return next();
};

app.use('/v0/accounts/:accountSid', addAccountSid, apiV0);

// run with node app.js and hit curl localhost:8080/contacts/
app.get('/contacts', async (req, res) => {
  const contacts = await ContactController.getContacts(req.query);
  res.json(contacts);
});

app.post('/contacts/search', async (req, res) => {
  const searchResults = await ContactController.searchContacts(req.body, req.query);
  res.json(searchResults);
});

// example: curl -XPOST -H'Content-Type: application/json' localhost:3000/contacts -d'{"hi": 2}'
app.post('/contacts', async (req, res) => {
  const contact = await ContactController.createContact(req.body);
  res.json(contact);
});

app.get('/cases', async (req, res) => {
  const cases = await CaseController.listCases(req.query);
  res.json(cases);
});

app.post('/cases', async (req, res) => {
  const createdCase = await CaseController.createCase(req.body);
  res.json(createdCase);
});

app.put('/cases/:id', async (req, res) => {
  const { id } = req.params;
  const updatedCase = await CaseController.updateCase(id, req.body);
  res.json(updatedCase);
});

app.delete('/cases/:id', async (req, res) => {
  const { id } = req.params;
  await CaseController.deleteCase(id);
  res.sendStatus(200);
});

app.put('/contacts/:contactId/connectToCase', async (req, res) => {
  const { contactId } = req.params;
  const { caseId } = req.body;
  await CaseController.getCase(caseId);
  const updatedContact = await ContactController.connectToCase(contactId, caseId);
  res.json(updatedContact);
});

app.get('/cases/:caseId/activities/', async (req, res) => {
  const { caseId } = req.params;
  await CaseController.getCase(caseId);
  const caseAudits = await CaseAuditController.getAuditsForCase(caseId);
  const contactIds = CaseAuditController.getContactIdsFromCaseAudits(caseAudits);
  const relatedContacts = await ContactController.getContactsById(contactIds);
  const activities = await CaseAuditController.getActivities(caseAudits, relatedContacts);

  res.json(activities);
});

app.post('/cases/search', async (req, res) => {
  const searchResults = await CaseController.searchCases(req.body, req.query);
  res.json(searchResults);
});

app.use((req, res, next) => {
  next(createError(404));
});

app.use((err, req, res, next) => {
  console.log(err);

  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  const error =
    req.app.get('env') === 'development' ? { message: err.message, error: err.stack } : {};

  res.status(err.status || 500);
  res.json(error);
  next();
});

console.log(`${new Date(Date.now()).toLocaleString()}: app.js has been created`);

module.exports = app;
