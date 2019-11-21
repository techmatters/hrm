const createError = require('http-errors');
const express = require('express');
const logger = require('morgan');
const cors = require('cors');
const app = express();

// Sequelize init
const Sequelize = require('sequelize');
const host = process.env.RDS_HOSTNAME || 'localhost';
const user = process.env.RDS_USERNAME || 'hrm';
const pass = process.env.RDS_PASSWORD || '';
const port = process.env.RDS_PORT || '5432';
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

sequelize.sync().then(() => console.log("Sequelize synced"));

app.options('/contacts', cors());

// run with node app.js and hit curl localhost:8080/contacts/
app.get('/contacts', function (req, res) {
  const queryObject = {
    order: [ [ 'createdAt', 'DESC' ] ],
    limit: 10
  };
  if (req.query.queueName) {
    queryObject.where = {
      queueName: req.query.queueName
    };
  }
  Contact.findAll(queryObject).then(contacts => {
    res.json(contacts.map(e =>
      new Object({
        "id": e.id,
        "Date": e.createdAt,
        "FormData": redact(e.rawJson)
      })
    ));
  })
});


// example: curl -XPOST -H'Content-Type: application/json' localhost:3000/contacts -d'{"hi": 2}'
app.post('/contacts', function(req, res) {
  console.log(req.body);
  // TODO(nick): Sanitize this so little bobby tables doesn't get us
  const contactRecord = {
    rawJson: req.body.form
  }
  if (req.body.form && req.body.form.queueName) {
    contactRecord.queueName = req.body.form.queueName;
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

function redact(form) {
  if (!form ||
      !form.number ||
      form.number === 'Anonymous' ||
      form.number === 'Customer') {
        return form;
  }
  const num = form.number;
	const len = num.length;
  return {
    ...form,
    number: num.slice(0,4) + "X".repeat(len-7) + num.slice(len-3)
  }
}

console.log(new Date(Date.now()).toLocaleString() + ": app.js has been created");

module.exports = app;
