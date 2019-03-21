var express = require('express');
var router = express.Router();

var mongodb = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;

/* GET home page. */
router.get('/', function(req, res, next) {
  res.send("Hello World")
});

router.get('/subscribe', function(req, res, next) {
  res.render("subscription", {actionPath: "/subscribe", title: "Join Meeting Email Listserv", text: "This registration form is made to simplify the process of joining the Brain Mapping Laboratory / UF Norman Fixel Institute for Neurological Diseases Movement Disorders & Neurorestoration Program. Please provide your name and email, a confirmation email will be sent to your email address to ensure email address is correct."});
});

router.post('/subscribe', function(req, res, next) {
  var url = req.app.get('mongodb');
  var database = req.app.get('database');
  removeOldRequest(url, database);

  mongodb.connect(url, { useNewUrlParser: true }, async function(err, client) {
    if (err) {
        console.log(err);
        res.render("confirmation", {title: "Confirmation Email Cannot Send.", text: "An error was encountered when connecting to database. Please contact 'jcagle@ufl.edu' for reporting error (and so that I can manually add you to listserv)."});
        return;
    }

    var db = client.db(database);
    var collection = db.collection("listserv");

    var result = await collection.findOne({"Email": req.body.email});
    if (result != null) {
      if (result.valid) {
        res.render("confirmation", {title: "Email Found", text: "This email is in the listserv already and is activated."})
        return;
      } else {
        res.render("confirmation", {title: "Email Found", text: "This email is in the listserv already but not yet confirmed using the confirmation link. Please check your inbox for confirmation procedure (it might be in the spam email)."})
        return;
      }
    }

    var tokenID = new ObjectID();

    var date = new Date();
    result = await collection.insertOne({
      "User": req.body.username,
      "Email": req.body.email,
      "RegistrationDate": date,
      "_id": tokenID,
      "valid": false
    });

    var mailer = require('nodemailer');
    var transporter = mailer.createTransport({
        service: "gmail",
        auth: {
            user: "brainmappingmac@gmail.com",
            pass: "baNan4n3gr3eN"
        }
    });

    var confirmationEmailLink = "https://bml-scheduler.herokuapp.com/confirmation/" + tokenID;

    var mailOptions = {
        from: "Brain Mapping Lab Email Service",
        to: req.body.email,
        subject: "Confirmation of Brain Mapping Lab",
        text: "Greeting,\n\nThis email is a confirmation for your recent addition to Brain Mapping Lab Email Listserv. Please use the following link to confirm your acceptance into Brain Mapping Lab Meeting Agenda email listserv.\n\n" + confirmationEmailLink + "\n\nSincerely,"
    };

    transporter.sendMail(mailOptions, function (err, info) {
        if (err) {
            console.log(err);
            res.render("confirmation", {title: "Confirmation Email Cannot Send.", text: "An error was encountered when sending email. Please contact 'jcagle@ufl.edu' for reporting error (and so that I can manually add you to listserv)."});
            return;
        }
        res.render("confirmation", {title: "Confirmation Email Sent!", text: "An email with confirmation link is sent to the email address you provided. The link will be valid for 24 hours. Please confirm before expiration."});
    });

  });
});

router.get('/unsubscribe', function(req, res, next) {
  res.render("subscription", {actionPath: "/unsubscribe", title: "Unsubscribe", text: "Please enter the email address you used to join listserv. A final confirmation email will be sent to the email address provided, use the link to unsubscribe."});
});

router.post('/unsubscribe', function(req, res, next) {
  var url = req.app.get('mongodb');
  var database = req.app.get('database');
  removeOldRequest(url, database);

  mongodb.connect(url, { useNewUrlParser: true }, async function(err, client) {
    if (err) {
        console.log(err);
        res.render("confirmation", {title: "Confirmation Email Cannot Send.", text: "An error was encountered when connecting to database. Please contact 'jcagle@ufl.edu' for reporting error (and so that I can manually add you to listserv)."});
        return;
    }

    var db = client.db(database);
    var collection = db.collection("listserv");

    var result = await collection.findOne({"Email": req.body.email});

    if (result == null) {
      res.render("confirmation", {title: "Email Address Not Found", text: "This email address is not currently on the listserv."});
      return;
    } else {
      var ret = await collection.updateOne({"_id": result._id}, {$set: {delete: true}});
    }

    var mailer = require('nodemailer');
    var transporter = mailer.createTransport({
        service: "gmail",
        auth: {
            user: "brainmappingmac@gmail.com",
            pass: process.env.MAILPASS
        }
    });

    var confirmationEmailLink = "https://bml-scheduler.herokuapp.com/unsubscribe/" + result._id;
    var mailOptions = {
        from: "Brain Mapping Lab Email Service",
        to: req.body.email,
        subject: "Unsubscribe Brain Mapping Lab Meeting Agenda Emails",
        text: "Greeting,\n\nThis email is a confirmation for your decision to unsubscribe the Brain Mapping Lab Email Listserv. Please use the following link to confirm.\n\n" + confirmationEmailLink + "\n\nSincerely,"
    };

    transporter.sendMail(mailOptions, function (err, info) {
        if (err) {
            console.log(err);
            res.render("confirmation", {title: "Unsubscription Email Cannot Send.", text: "An error was encountered when sending email. Please contact 'jcagle@ufl.edu' for reporting error (and so that I can manually add you to listserv)."});
            return;
        }
        res.render("confirmation", {title: "Unsubscription Email Sent!", text: "An email with confirmation link is sent to the email address you provided. The link has no expiration date. You will be unsubscribed from listserv once you click the link."});
    });
  });
});

router.get('/confirmation/:tokenID', function(req, res, next) {
  var url = req.app.get('mongodb');
  var database = req.app.get('database');
  removeOldRequest(url, database);

  mongodb.connect(url, { useNewUrlParser: true }, async function(err, client) {
    if (err) {
        console.log(err);
        res.render("confirmation", {title: "Database cannot reach.", text: "An error was encountered when connecting to database. Please contact 'jcagle@ufl.edu' for reporting error (and so that I can manually add you to listserv)."});
        return;
    }

    var db = client.db(database);
    var collection = db.collection("listserv");

    var tokenID = new ObjectID(req.params.tokenID);
    var result = await collection.findOne({"_id": tokenID});

    if (result == null) {
      res.render("confirmation", {title: "Error", text: "This URL does not exist or the link has expired after 24 hours. Please verify your link in email."});
      return;
    }
    if (result.valid) {
      res.render("confirmation", {title: "Error", text: "This email account is already activated in Listserv."});
      return;
    }

    var ret = await collection.updateOne({"_id": tokenID}, {$set: {valid: true}});
    res.render("confirmation", {title: "Confirmed!", text: "This email is now confirmed and added to Meeting Agenda listserv."});
  });
});

router.get('/unsubscribe/:tokenID', function(req, res, next) {
  var url = req.app.get('mongodb');
  var database = req.app.get('database');
  removeOldRequest(url, database);

  mongodb.connect(url, { useNewUrlParser: true }, async function(err, client) {
    if (err) {
        console.log(err);
        res.render("confirmation", {title: "Database cannot reach.", text: "An error was encountered when connecting to database. Please contact 'jcagle@ufl.edu' for reporting error (and so that I can manually add you to listserv)."});
        return;
    }

    var db = client.db(database);
    var collection = db.collection("listserv");

    var tokenID = new ObjectID(req.params.tokenID);
    var result = await collection.findOne({"_id": tokenID});

    if (result == null) {
      res.render("confirmation", {title: "Error", text: "This URL does not exist. Please verify your link in email."});
      return;
    }
    if (!result.delete) {
      res.render("confirmation", {title: "Error", text: "This email account has not requested to be unsubscribe."});
      return;
    }

    var ret = await collection.deleteOne({"_id": tokenID});
    res.render("confirmation", {title: "Confirmed!", text: "This email is now unsubscribed from Brain Mapping Lab Meeting Agenda Listserv."});
  });
});

function removeOldRequest(url, database){
  mongodb.connect(url, { useNewUrlParser: true }, async function(err, client) {
    if (err) {
        return;
    }
    var db = client.db(database);
    var collection = db.collection("listserv");

    var date = new Date();
    var result = await collection.find({}).toArray();

    for (i = 0; i < result.length; i++) {
      if (!result[i].valid && (date-result[i].RegistrationDate) > 24*60*60000) {
        var ret = await collection.deleteOne({_id: result[i]._id})
      }
    }
  });
};

module.exports = router;
