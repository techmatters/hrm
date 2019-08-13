const express = require('express')
const app = express()
const port = 3000
const Sequelize = require('sequelize')
const ContactModel = require('./models/contact.js')

const sequelize = new Sequelize('postgres://hrm@localhost:5432/hrmdb');
const Contact = ContactModel(sequelize, Sequelize);

app.use(express.json())

// run with node app.js and hit curl localhost:3000/
app.get('/', function (req, res) {
  Contact.findAll().then(contacts => {
  	res.json(contacts);
  })
});

// example: curl -XPOST -H'Content-Type: application/json' localhost:3000/contacts -d'{"hi": 2}'
app.post('/contacts', function(req, res) {
  console.log(req.body);
  res.json(req.body);
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
