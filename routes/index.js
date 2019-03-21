var express = require('express');
var router = express.Router();

var mongodb = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;

/* GET home page. */
router.get('/', function(req, res, next) {
  res.send("Hello World")
});

router.get('/subscribe', function(req, res, next) {
  res.render("subscription", {actionPath: "/subscribe"});
});

router.post('/subscribe', function(req, res, next) {
  var url = process.env.MONGODB_URI;
  var database = 'bml-meeting';

  mongodb.connect(url, { useNewUrlParser: true }, async function(err, client) {
    if (err) {
        console.log(err);
        res.render("confirmation", {title: "Confirmation Email Cannot Send.", text: "An error was encountered when connecting to database. Please contact 'jcagle@ufl.edu' for reporting error (and so that I can manually add you to listserv)."});
        return;
    }

    var db = client.db(database);
    var collection = db.collection("listserv");

    var date = new Date();
    var result = await collection.insertOne({
      "User": req.body.username,
      "Email": req.body.email,
      "RegistrationDate": date,
    });

    var mailer = require('nodemailer');
    var transporter = mailer.createTransport({
        service: "gmail",
        auth: {
            user: "brainmappingmac@gmail.com",
            pass: process.env.MAILPASS
        }
    });

    var confirmationEmailLink = "https://bml-scheduler.herokuapp.com/confirmation/" + result._id;

    var mailOptions = {
        from: "Brain Mapping Lab Email Service",
        to: req.body.emailAddress,
        subject: "Confirmation of Brain Mapping Lab",
        text: "Greeting,\n\nThis email is a confirmation for your recent addition to Brain Mapping Lab Email Listserv. Please use the following link to confirm your acceptance into Brain Mapping Lab Meeting Agenda email listserv.\n\n" + confirmationEmailLink + "\n\nSincerely,"
    };
    transporter.sendMail(mailOptions, function (err, info) {
        if (err) {
            console.log(err);
            res.render("confirmation", {title: "Confirmation Email Cannot Send.", text: "An error was encountered when sending email. Please contact 'jcagle@ufl.edu' for reporting error (and so that I can manually add you to listserv)."});
            return;
        }
    });

    console.log(confirmationEmailLink);
  });
  res.render("confirmation", {title: "Confirmation Email Sent!", text: "An email with confirmation link is sent to the email address you provided. The link will be valid for 24 hours. Please confirm before expiration."});
});

module.exports = router;
