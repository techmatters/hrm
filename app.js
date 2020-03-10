const createError = require('http-errors');
const express = require('express');
const logger = require('morgan');
const cors = require('cors');
const app = express();
const parseISO = require('date-fns/parseISO');
const startOfDay = require('date-fns/startOfDay');
const endOfDay = require('date-fns/endOfDay');
const isValid = require('date-fns/isValid');

// Sequelize init
const Sequelize = require('sequelize');
const host = process.env.RDS_HOSTNAME || 'localhost';
const user = process.env.RDS_USERNAME || 'hrm';
const pass = process.env.RDS_PASSWORD || '';
const port = process.env.RDS_PORT || '5432';
const apiKey = process.env.API_KEY;

const Op = Sequelize.Op;
const version = "0.3.0";

if (!apiKey) {
  throw("Must specify API key");
}

console.log(`Starting HRM version ${version}`);
console.log('Trying with: ' + [host, user].join(', '));
const sequelize = new Sequelize('hrmdb', 'hrm', pass, {
  host: host,
  dialect: 'postgres'
});
console.log('After connect attempt');
const Contact = require('./models/contact.js')(sequelize, Sequelize);
const AgeBracket = require('./models/agebracket.js')(sequelize, Sequelize);
const Subcategory = require('./models/subcategory.js')(sequelize, Sequelize);
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors())

app.get('/', function(req, res) {
  res.json({
    "Message": "Welcome to the HRM!"
  });
});

app.options('/contacts', cors());

// run with node app.js and hit curl localhost:8080/contacts/
app.get('/contacts', function (req, res) {
  checkAuthentication(req);
  const queryObject = {
    order: [ [ 'createdAt', 'DESC' ] ],
    limit: 10
  };
  if (req.query.queueName) {
    queryObject.where = {
      queueName: {
        [Op.like]: `${req.query.queueName}%`
      }
    };
  }
  Contact.findAll(queryObject).then(contacts => {
    res.json(contacts.map(e =>
      new Object({
        id: e.id,
        Date: e.createdAt,
        FormData: redact(e.rawJson),
        twilioWorkerId: e.twilioWorkerId,
        helpline: e.helpline,
        queueName: e.queueName,
        number: formatNumber(e.number),
        channel: e.channel
      })
    ));
  })
});

app.post('/contacts/search', (req, res) => {
  checkAuthentication(req);
  checkSearchParams(req.body);

  const queryObject = buildSearchQueryObject(req.body);

  Contact.findAll(queryObject)
    .then(contacts => res.json(contacts.map(convertContactToSearchResult)))
    .catch( error => { console.log("request rejected: " + error); });
});

// example: curl -XPOST -H'Content-Type: application/json' localhost:3000/contacts -d'{"hi": 2}'
app.post('/contacts', function(req, res) {
  checkAuthentication(req);
  console.log(req.body);
  // TODO(nick): Sanitize this so little bobby tables doesn't get us
  const contactRecord = {
    rawJson: req.body.form,
    twilioWorkerId: req.body.twilioWorkerId || '',
    helpline: req.body.helpline || '',
    queueName: req.body.queueName || req.body.form.queueName,
    number: req.body.number || '',
    channel: req.body.channel || ''
  }
  
  Contact.create(contactRecord)
  .then(contact => {
    let str = JSON.stringify(contact.toJSON());
    console.log("contact = " + str);
    res.json(str);
  })
  .catch( error => { console.log("request rejected: " + error); });
});

app.use(function(req, res, next) {
  next(createError(404));
});

app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

function checkAuthentication(req) {
  const base64Key = new Buffer(req.headers.authorization.replace("Basic ", ""), 'base64');
  if (base64Key.toString('ascii') !== apiKey) {
    return res.status(401).json({error: 'Authentication failed'});
  }
}

function checkSearchParams(body) {
  const { helpline, firstName, lastName, counselor, phoneNumber, dateFrom, dateTo, singleInput } = body;
  const anyValue = helpline || firstName || lastName || counselor || phoneNumber || dateFrom || dateTo || singleInput;
 
  if (!anyValue) {
    res.json([]);
  }
}

function buildSearchQueryObject(body) {
  const { helpline, firstName, lastName, counselor, phoneNumber, dateFrom, dateTo, singleInput } = body;

  const operator = singleInput ? Op.or : Op.and;
  const isSingleInputValidDate = singleInput && isValid(parseISO(singleInput));
  
  return ({
    where: {
      [Op.and]: [
        helpline && {
          helpline: helpline,
        },
        {
          [operator]: [
            (firstName || singleInput) && {
              'rawJson.childInformation.name.firstName': {
                [Op.iLike]: singleInput || firstName,
              }
            },
            (lastName || singleInput) && {
              'rawJson.childInformation.name.lastName': {
                [Op.iLike]: singleInput || lastName,
              }
            },
            counselor && {
              twilioWorkerId: counselor,
            },
            (phoneNumber || singleInput) && {
              number: {
                [Op.iLike]: `%${singleInput || phoneNumber}%`,
              },
            },
            (dateFrom && !singleInput) && {
              createdAt: {
                [Op.gte]: startOfDay(parseISO(dateFrom)),
              },
            },
            (dateTo && !singleInput) && {
              createdAt: {
                [Op.lte]: endOfDay(parseISO(dateTo)),
              },
            },
            isSingleInputValidDate && {
              [Op.and]: [
                {
                  createdAt: {
                    [Op.gte]: startOfDay(parseISO(singleInput)),
                  },
                },
                {
                  createdAt: {
                    [Op.lte]: endOfDay(parseISO(singleInput)),
                  },
                },
              ],
            },
          ],
        },
      ],
    }
  });
}

function convertContactToSearchResult(contact) {
  const contactId = contact.id;
  const dateTime = contact.createdAt;
  const name = `${contact.rawJson.childInformation.name.firstName} ${contact.rawJson.childInformation.name.lastName}`;
  const customerNumber = contact.number;
  const callType = contact.rawJson.callType;
  const categories = "TBD";
  const counselor = contact.twilioWorkerId;
  const notes = contact.rawJson.caseInformation.callSumary;
  
  return ({
    contactId,
    overview: {
      dateTime,
      name,
      customerNumber,
      callType,
      categories,
      counselor,
      notes,
    },
    details: redact(contact.rawJson),
  });
};

function formatNumber(number) {
  if (number == null || number === 'Anonymous' || number === 'Customer') {
    return number;
  }

  const len = number.length;
  return number.slice(0,4) + "X".repeat(len-7) + number.slice(len-3);
}

function redact(form) {
  if (!form) {
    return form;
  }

  return {
    ...form,
    number: formatNumber(form.number)
  }
}

console.log(new Date(Date.now()).toLocaleString() + ": app.js has been created");

module.exports = app;
