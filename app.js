const createError = require('http-errors');
const express = require('express');
require('express-async-errors');
const logger = require('morgan');
const cors = require('cors');

const models = require('./models');
const swagger = require('./swagger');

const app = express();
const apiKey = process.env.API_KEY;
const version = '0.3.6';

if (!apiKey) {
  throw new Error('Must specify API key');
}

console.log(`Starting HRM version ${version}`);

swagger.runWhenNotProduction(app);

const { Contact, Case } = models;
const ContactController = require('./controllers/contact-controller')(Contact);
const CaseController = require('./controllers/case-controller')(Case);

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

function authorizationMiddleware(req, res, next) {
  if (!req || !req.headers || !req.headers.authorization) {
    return unauthorized(res);
  }

  const base64Key = Buffer.from(req.headers.authorization.replace('Basic ', ''), 'base64');
  if (base64Key.toString('ascii') !== apiKey) {
    return unauthorized(res);
  }

  return next();
}

app.use(authorizationMiddleware);

// run with node app.js and hit curl localhost:8080/contacts/
app.get('/contacts', async (req, res) => {
  const contacts = await ContactController.getContacts(req.query);
  res.json(contacts);
});

app.post('/contacts/search', async (req, res) => {
  const searchResults = await ContactController.searchContacts(req.body);
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

app.put('/contacts/:contactId/connectToCase', async (req, res) => {
  const { contactId } = req.params;
  const { caseId } = req.body;
  await CaseController.getCase(caseId);
  const updatedContact = await ContactController.connectToCase(contactId, caseId);
  res.json(updatedContact);
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
