var express = require('express');
var router = express.Router();

var mongodb = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    return [d.getUTCFullYear(), weekNo];
}

/* GET home page. */
router.get('/', function(req, res, next) {
    res.send("Hello World")
});

router.post('/add', function(req, res, next) {
    var url = req.app.get('mongodb');
    var database = req.app.get('database');

    mongodb.connect(url, { useNewUrlParser: true }, async function(err, client) {
        if (err) {
            console.log("Error Connecting to Database");
            res.send({text: "Error Connecting to Database"});
            return;
        }

        var db = client.db(database);
        var collection = db.collection("schedule");

        var now = new Date();
        var weekNumber = getWeekNumber(now);

        try {
            var result = await collection.findOne({year: weekNumber[0], week: weekNumber[1]});
            if (result == null) {
                var currentList = [req.body.text];
                collection.insertOne({year: weekNumber[0], week: weekNumber[1], scheduleList: currentList});
            } else {
                var currentList = result.scheduleList;
                currentList.push(req.body.text);
                collection.updateOne({year: weekNumber[0], week: weekNumber[1]}, { $set: {scheduleList: currentList}});
            }
            res.send({ response_type: "in_channel", text: "The schedule for week " + weekNumber + " of year " + now.getUTCFullYear() + " is updated." });
        } catch(err) {
            console.log(err);
            res.send({text: "Error fetching schedules"});
            return;
        }
    });
});

router.post('/list', function(req, res, next) {

    var url = req.app.get('mongodb');
    var database = req.app.get('database');

    mongodb.connect(url, { useNewUrlParser: true }, async function(err, client) {
        if (err) {
            console.log("Error Connecting to Database");
            res.send({text: "Error Connecting to Database"});
            return;
        }

        var db = client.db(database);
        var collection = db.collection("schedule");

        var now = new Date();
        var weekNumber = getWeekNumber(now);

        try {
            var result = await collection.findOne({year: weekNumber[0], week: weekNumber[1]});
            if (result == null) {
                res.send({ response_type: "in_channel", text: "The schedule for week Number " + weekNumber[1] + " of year " + weekNumber[0] + " is not created yet." });
            } else {
                var replyString = "The following are the meeting schedules (not to order):\n"
                for (i = 0; i < result.scheduleList.length; i++) {
                    replyString = replyString + "\t" + (i+1) + ": " + result.scheduleList[i] + "\n";
                }
                res.send({ response_type: "in_channel", text: replyString });
            }
            return;
        } catch(err) {
            console.log(err);
            res.send({text: "Error fetching schedules"});
            return;
        }
    });
});

router.post('/remove', function(req, res, next) {

    var url = req.app.get('mongodb');
    var database = req.app.get('database');
    var id = parseInt(req.body.text);

    mongodb.connect(url, { useNewUrlParser: true }, async function(err, client) {
        if (err) {
            console.log("Error Connecting to Database");
            res.send({text: "Error Connecting to Database"});
            return;
        }

        var db = client.db(database);
        var collection = db.collection("schedule");

        var now = new Date();
        var weekNumber = getWeekNumber(now);

        try {
            var result = await collection.findOne({year: weekNumber[0], week: weekNumber[1]});
            if (result == null) {
                res.send({ response_type: "in_channel", text: "The schedule for week Number " + weekNumber[1] + " of year " + weekNumber[0] + " is not created yet." });
            } else {
                var currentList = result.scheduleList.filter(function(value, index, arr) {
                    return index != (id-1);
                })
                collection.updateOne({year: weekNumber[0], week: weekNumber[1]}, { $set: {scheduleList: currentList}});
                res.send({ response_type: "in_channel", text: "Schedule ID " + id + " is removed." });
            }
            return;
        } catch(err) {
            console.log(err);
            res.send({text: "Error fetching schedules"});
            return;
        }
    });
});

function sendEmail() {
    var url = process.env.MONGODB_URI;
    var database = 'bml-meeting';
    var mailer = require('nodemailer')

    var transporter = mailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.MAIL,
            pass: process.env.MAILPASS
        }
    });

    mongodb.connect(url, { useNewUrlParser: true }, async function(err, client) {
        if (err) {
            console.log("Error Connecting to Database");
            return;
        }

        var db = client.db(database);
        var collection = db.collection("schedule");

        var now = new Date();
        var weekNumber = getWeekNumber(now);
        var weekDay = now.getDay()
        var textString = "Hello everyone,\n\nAgenda for " + (now.getMonth()+1) + "/" + (now.getDate()+1) + "/" + now.getUTCFullYear() + ":\n"

        try {
            var result = await collection.findOne({year: weekNumber[0], week: weekNumber[1]});
            var targetList = await collection.findOne({mailList: "target"});
            if (result == null) {
                textString += "1. No update for this week\n\n"
                var mailOptions = {
                    from: "Brain Mapping Lab",
                    to: targetList.emailAddress,
                    subject: "Brain Mapping Lab Weekly Meeting Agenda",
                    text: textString + "Let me know if you would like to be added to the agenda.\n\nMay everyone have a good weekend!\n\nSincerely,\nJackson Cagle"
                }

                transporter.sendMail(mailOptions, function (err, info) {
                    if (err) {
                        console.log(err)
                        return -1;
                    }
                })
            } else {
                if (result.scheduleList.length == 0) {
                    textString += "1. No update for this week\n\n"
                } else {
                    for (i = 0; i < result.scheduleList.length; i++) {
                        textString += "\t" + (i+1) + ": " + result.scheduleList[i] + "\n";
                    }
                }
                var mailOptions = {
                    from: process.env.MAIL,
                    to: targetList.emailAddress,
                    subject: "Brain Mapping Lab Weekly Meeting Agenda",
                    text: textString + "Let me know if you would like to be added to the agenda.\n\nMay everyone have a good weekend!\n\nSincerely,\nJackson Cagle"
                }

                transporter.sendMail(mailOptions, function (err, info) {
                    if (err) {
                        console.log(err)
                        return -1;
                    }
                })
                console.log("Email Sent")
                return 0;
            }
            return 0;
        } catch(err) {
            console.log(err);
            return -1;
        }
    });
}

router.get('/sendEmail', function(req, res, next) {
    var ret = sendEmail();
    if (ret != 0) res.send("Failed");
    res.send("Success");
});

router.post('/sendEmail', function(req, res, next) {
    var ret = sendEmail();
    if (ret != 0) res.send({ response_type: "in_channel", text: "Fail Sending Email"});
    res.send({ response_type: "in_channel", text: "Email Sent"});
});

module.exports = router;
