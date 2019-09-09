const express = require('express')
const cors = require('cors')
const app = express()
const port = 8080
const Sequelize = require('sequelize')

const sequelize = new Sequelize('postgres://hrm@localhost:5432/hrmdb');
const Contact = require('./models/contact.js')(sequelize, Sequelize);
const AgeBracket = require('./models/agebracket.js')(sequelize, Sequelize);
const Subcategory = require('./models/subcategory.js')(sequelize, Sequelize);

app.use(express.json())
app.use(cors())
sequelize.sync().then(() => console.log("Sequelize synced"));

// run with node app.js and hit curl localhost:8080/
app.options('/', cors())
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
  subcategory: "Gang violence",
  timestamp: 1565827981000
}

on error return 400 with
{
  "error: BadDataException",
  "Invalid ageBracket: 2022",
  "Invalid subcategory: adsfasdf"
}
TODO(nick): currently doing this with square brackets instead
*/
app.options('/contacts', cors())
app.post('/contacts', function(req, res) {
  console.log(req.body);
  // TODO(nick): Sanitize this so little bobby tables doesn't get us
  var ageBracketPromise =
    AgeBracket.findOne({where: { bracket: req.body.ageBracket }}); // cache eventually
  var subcategoryPromise =
    Subcategory.findOne({where: { subcategory: req.body.subcategory }});
  Promise.all([ageBracketPromise, subcategoryPromise])
    .then( ([ageBracket, subcategory]) => {
      let errorArray = [];
      if (ageBracket == null) {
        errorArray.push("Invalid ageBracket: " + req.body.ageBracket);
      }
      if (subcategory == null) {
        errorArray.push("Invalid subcategory: " + req.body.subcategory);
      }
      if (errorArray.length > 0) {
        errorArray.push("error: BadDataException");
        console.log(JSON.stringify(errorArray));
        res.status(400).send(JSON.stringify(errorArray));
        reject();
      }
      Contact.create({
        taskId: req.body.taskId,
        reservationId: req.body.reservationId,
        timestamp: req.body.timestamp,
        AgeBracketId: ageBracket.id,
        SubcategoryId: subcategory.id
      })
    })
    .then(contact => {
      let str = JSON.stringify(contact.toJSON());
      console.log("contact = " + str);
      res.json(str);
    })
    .catch( error => { console.log("request rejected"); });
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