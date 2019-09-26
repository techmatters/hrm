const express = require('express')
const cors = require('cors')
const app = express()

// Sequelize init
// const Sequelize = require('sequelize')
// const sequelize = new Sequelize('postgres://hrm@localhost:5432/hrmdb');
// const Contact = require('./models/contact.js')(sequelize, Sequelize);
// const AgeBracket = require('./models/agebracket.js')(sequelize, Sequelize);
// const Subcategory = require('./models/subcategory.js')(sequelize, Sequelize);

app.use(express.json())
app.use(cors())
// sequelize.sync().then(() => console.log("Sequelize synced"));

app.options('/contacts', cors())

// run with node app.js and hit curl localhost:8080/contacts/
// array of
/*
{
  AgeBracket: "15-17",
  Subcategory: "Gang violence",
  Date: "....",
  TaskId: "TA123",
  ReservationId: "TR123"
}
*/
app.get('/contacts', function (req, res) {
  res.json({
    "Message": "This is the GET request"
  });
  // Contact.findAll({
  //   attributes: ['createdAt', 'taskId', 'reservationId'],
  //   include: [
  //   {
  //     model: AgeBracket,
  //     attributes: [ 'bracket' ]
  //   },
  //   {
  //     model: Subcategory,
  //     attributes: [ 'subcategory' ]
  //   }],
  //   order: [ [ 'createdAt', 'DESC' ] ],
  //   limit: 10
  // }).then(contacts => {
  //   res.json(contacts.map(e =>
  //     new Object({
  //       "Date": e.createdAt,
  //       "AgeBracket": e.AgeBracket.bracket,
  //       "Subcategory": e.Subcategory.subcategory,
  //       "TaskId": e.taskId,
  //       "ReservationId": e.reservationId
  //     })
  //   ));
  // })
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
app.post('/contacts', function(req, res) {
  res.json({
    "Message": "This is the POST request"
  });
  // console.log(req.body);
  // // TODO(nick): Sanitize this so little bobby tables doesn't get us
  // var ageBracketPromise =
  //   AgeBracket.findOne({where: { bracket: req.body.ageBracket }}); // cache eventually
  // var subcategoryPromise =
  //   Subcategory.findOne({where: { subcategory: req.body.subcategory }});
  // Promise.all([ageBracketPromise, subcategoryPromise])
  //   .then( ([ageBracket, subcategory]) => {
  //     let errorArray = [];
  //     if (ageBracket == null) {
  //       errorArray.push("Invalid ageBracket: " + req.body.ageBracket);
  //     }
  //     if (subcategory == null) {
  //       errorArray.push("Invalid subcategory: " + req.body.subcategory);
  //     }
  //     if (errorArray.length > 0) {
  //       errorArray.push("error: BadDataException");
  //       console.log(JSON.stringify(errorArray));
  //       res.status(400).send(JSON.stringify(errorArray));
  //       reject();
  //     }
  //     return Contact.create({
  //       taskId: req.body.taskId,
  //       reservationId: req.body.reservationId,
  //       timestamp: req.body.timestamp,
  //       AgeBracketId: ageBracket.id,
  //       SubcategoryId: subcategory.id
  //     });
  //   })
  //   .then(contact => {
  //     let str = JSON.stringify(contact.toJSON());
  //     console.log("contact = " + str);
  //     res.json(str);
  //   })
  //   .catch( error => { console.log("request rejected: " + error); });
});

module.exports = app;

// app.listen(port, () => console.log(`Example app listening on port ${port}!`))

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