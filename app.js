const createError = require('http-errors');
const express = require('express');
const logger = require('morgan');
const cors = require('cors');
const Sequelize = require('sequelize');

const app = express();

// Sequelize init
const host = process.env.RDS_HOSTNAME || 'localhost';
const user = process.env.RDS_USERNAME || 'hrm';
const pass = process.env.RDS_PASSWORD || '';
const apiKey = process.env.API_KEY;

const version = '0.3.6';

if (!apiKey) {
  throw new Error('Must specify API key');
}

console.log(`Starting HRM version ${version}`);
console.log(`Trying with: ${[host, user].join(', ')}`);
const sequelize = new Sequelize('hrmdb', 'hrm', pass, {
  host,
  dialect: 'postgres',
});
const ContactController = require('./controllers/contact-controller')(sequelize);

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
  try {
    const contacts = await ContactController.getContacts(req.query);
    res.json(contacts);
  } catch (error) {
    console.log(`[ContactController.getContacts]: ${error}`);
  }
});

app.post('/contacts/search', async (req, res) => {
  try {
    const searchResults = await ContactController.searchContacts(req.body);
    res.json(searchResults);
  } catch (error) {
    console.log(`[ContactController.searchContacts]: ${error}`);
  }
});

// example: curl -XPOST -H'Content-Type: application/json' localhost:3000/contacts -d'{"hi": 2}'
app.post('/contacts', async (req, res) => {
  try {
    const contact = await ContactController.createContact(req.body);
    res.json(contact);
  } catch (error) {
    console.log(`[ContactController.createContact]: ${error}`);
  }
});

app.use((req, res, next) => {
  next(createError(404));
});

app.use((err, req, res) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

console.log(`${new Date(Date.now()).toLocaleString()}: app.js has been created`);

module.exports = app;
