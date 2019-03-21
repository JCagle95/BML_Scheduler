var express = require('express');
var router = express.Router();

var mongodb = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;

function getWeekNumber(d) {
    // Copy date so don't modify original
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    // Get first day of year
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    // Calculate full weeks to nearest Thursday
    var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    // Return array of year and week number
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
            var result = await collection.findOne({year: now.getUTCFullYear(), week: weekNumber});
            if (result == null) {
                var currentList = [req.body.text];
                collection.insertOne({year: now.getUTCFullYear(), week: weekNumber, scheduleList: currentList});
            } else {
                var currentList = result.scheduleList;
                currentList.push(req.body.text);
                collection.updateOne({year: now.getUTCFullYear(), week: weekNumber}, { $set: {scheduleList: currentList}});
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
            var result = await collection.findOne({year: now.getUTCFullYear(), week: weekNumber});
            if (result == null) {
                res.send({ response_type: "in_channel", text: "The schedule for week Number " + weekNumber + " of year " + now.getUTCFullYear() + " is not created yet." });
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
            var result = await collection.findOne({year: now.getUTCFullYear(), week: weekNumber});
            if (result == null) {
                res.send({ response_type: "in_channel", text: "The schedule for week Number " + weekNumber + " of year " + now.getUTCFullYear() + " is not created yet." });
            } else {
                var currentList = result.scheduleList.filter(function(value, index, arr) {
                    return index != (id-1);
                })
                collection.updateOne({year: now.getUTCFullYear(), week: weekNumber}, { $set: {scheduleList: currentList}});
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

/* GET home page. */
router.post('/interact', function(req, res, next) {
    let payload = req.body;
    res.sendStatus(200);

    var botToken = req.app.get('bot-token');

    if (payload.event.type === "app_mention") {
        var resBody = {
            "token": botToken,
            "channel": payload.event.item.channel,
            "text": "Hello World!"
        }
        sendRequest.write(resBody);
        sendRequest.end();
    }
});

router.get('/sendEmail', function(req, res, next) {
    var url = process.env.MONGODB_URI;
    var database = 'bml-meeting';
    var mailer = require('nodemailer')

    var transporter = mailer.createTransport({
        service: "gmail",
        auth: {
            user: "brainmappingmac@gmail.com",
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
        var textString = "Hello everyone,\n\nAgenda for " + (now.getMonth()+1) + "/" + (now.getDate()+1) + "/" + now.getUTCFullYear() + " Weekday " + weekDay + ":\n"

        try {
            var result = await collection.findOne({year: now.getUTCFullYear(), week: weekNumber});
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
                        res.send("Fail")
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
                    from: "jcalge@ufl.edu",
                    to: targetList.emailAddress,
                    subject: "Brain Mapping Lab Weekly Meeting Agenda",
                    text: textString + "Let me know if you would like to be added to the agenda.\n\nMay everyone have a good weekend!\n\nSincerely,\nJackson Cagle"
                }

                transporter.sendMail(mailOptions, function (err, info) {
                    if (err) {
                        console.log(err)
                        res.send("Fail")
                    }
                })
                console.log("Email Sent")
                res.send("Success")

            }
            return;
        } catch(err) {
            console.log(err);
            res.send("Fail")
            return;
        }
    });
})

module.exports = router;
