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

const { Op } = Sequelize;
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
const Contact = require('./models/contact.js')(sequelize, Sequelize);

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

function checkAuthentication(req, res) {
  const base64Key = Buffer.from(req.headers.authorization.replace('Basic ', ''), 'base64');
  if (base64Key.toString('ascii') !== apiKey) {
    res.status(401).json({ error: 'Authentication failed' });
  }
}

function formatNumber(number) {
  if (number == null || number === 'Anonymous' || number === 'Customer') {
    return number;
  }

  const len = number.length;
  return number.slice(0, 4) + 'X'.repeat(len - 7) + number.slice(len - 3);
}

function redact(form) {
  if (!form) {
    return form;
  }

  return {
    ...form,
    number: formatNumber(form.number),
  };
}

// run with node app.js and hit curl localhost:8080/contacts/
app.get('/contacts', (req, res) => {
  checkAuthentication(req, res);
  const queryObject = {
    order: [['createdAt', 'DESC']],
    limit: 10,
  };
  if (req.query.queueName) {
    queryObject.where = {
      queueName: {
        [Op.like]: `${req.query.queueName}%`,
      },
    };
  }
  Contact.findAll(queryObject).then(contacts => {
    res.json(
      contacts.map(e => ({
        id: e.id,
        Date: e.createdAt,
        FormData: redact(e.rawJson),
        twilioWorkerId: e.twilioWorkerId,
        helpline: e.helpline,
        queueName: e.queueName,
        number: formatNumber(e.number),
        channel: e.channel,
        conversationDuration: e.conversationDuration,
      })),
    );
  });
});

app.post('/contacts/search', async (req, res) => {
  checkAuthentication(req, res);

  try {
    const searchResults = await ContactController.searchContacts(req.body);
    res.json(searchResults);
  } catch (error) {
    console.log(`[ContactController.searchContacts]: ${error}`);
  }
});

// example: curl -XPOST -H'Content-Type: application/json' localhost:3000/contacts -d'{"hi": 2}'
app.post('/contacts', (req, res) => {
  checkAuthentication(req, res);
  console.log(req.body);
  // TODO(nick): Sanitize this so little bobby tables doesn't get us
  const contactRecord = {
    rawJson: req.body.form,
    twilioWorkerId: req.body.twilioWorkerId || '',
    helpline: req.body.helpline || '',
    queueName: req.body.queueName || req.body.form.queueName,
    number: req.body.number || '',
    channel: req.body.channel || '',
    conversationDuration: req.body.conversationDuration,
  };

  Contact.create(contactRecord)
    .then(contact => {
      const str = JSON.stringify(contact.toJSON());
      console.log(`contact = ${str}`);
      res.json(str);
    })
    .catch(error => console.log(`request rejected: ${error}`));
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
