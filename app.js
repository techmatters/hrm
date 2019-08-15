const express = require('express')
const app = express()
const port = 3000
const Sequelize = require('sequelize')
const ContactModel = require('./models/contact.js')
const AgeBracketModel = require('./models/agebracket.js')

const sequelize = new Sequelize('postgres://hrm@localhost:5432/hrmdb');
const Contact = ContactModel(sequelize, Sequelize);
const AgeBracket = AgeBracketModel(sequelize, Sequelize);

app.use(express.json())
sequelize.sync().then(() => console.log("Sequelize synced"));

// run with node app.js and hit curl localhost:3000/
app.get('/', function (req, res) {
  Contact.findAll().then(contacts => {
  	res.json(contacts);
  })
});

// example: curl -XPOST -H'Content-Type: application/json' localhost:3000/contacts -d'{"hi": 2}'
/*
{
  taskId: .....,
  reservationId: ....,
  ageBracket: "15-17",
  timestamp: 1565827981000
}
*/
app.post('/contacts', function(req, res) {
  console.log(req.body);
  AgeBracket.findOne({where: { bracket: req.body.ageBracket }}) // cache eventually
  .then( ageBracket => {
    return Contact.create({
      taskId: req.body.taskId,
      reservationId: req.body.reservationId,
      timestamp: req.body.timestamp,
      AgeBracketId: ageBracket.id
    });
  })
  .then(c => { 
    let str = JSON.stringify(c.toJSON());
    console.log("contact = " + str); 
    res.json(str);
  });
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`))

/*

What is the API for a contact object?

we would want to return:
{
  id: 3,
  taskId: .....,
  reservationId: ....,
  ageBracket: 15-17,
  primaryClassification: {  // do we separate this or do isPrimary: true?
    theme: 'Health',
    category: 'Addiction',
    subcategory: 'Alcohol addiction'    
  },
  otherClassifications: [
    {
      theme: 'Abuse and Violence',
      category: 'Bullying',
      subcategory: 'Physical Bullying'
    }
  ],
  createdAt: '2019-08-12 12:08:39Z' // hmm... this should probs be epoch
}

*/