const express = require('express')
const app = express()
const port = 3000
const Sequelize = require('sequelize')
const ContactModel = require('./models/contact.js')

const sequelize = new Sequelize('postgres://hrm@localhost:5432/hrmdb');
const Contact = ContactModel(sequelize, Sequelize);

// run with node app.js and hit curl localhost:3000/
app.get('/', function (req, res) {
  Contact.findAll().then(contacts => {
  	res.json(contacts);
  })
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
