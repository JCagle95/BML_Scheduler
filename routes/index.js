var express = require('express');
var router = express.Router();

var http = require('http');
var options = {
    host: "https://slack.com",
    path: "/api/chat.postMessage",
    method: "POST",
    headers: {
        "Content-Type": "application/x-www-form-urlencoded"
    }
}

var sendRequest = http.request(options, function (res) {
    var responseString = "";

    res.on("data", function (data) {
        responseString += data;
        // save all the data from response
    });
    res.on("end", function () {
        console.log(responseString);
        // print to console when response ends
    });
});

var mongodb = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;

/* GET home page. */
router.post('/', function(req, res, next) {
    let payload = req.body;
    res.sendStatus(200);

    var botToken = req.app.get('bot-token');

    if (payload.event.type === "app_mention") {
        if (payload.event.text.includes("add schedule")) {
            var resBody = {
                "token": botToken,
                "channel": payload.event.item.channel,
                "text": "Hello World!"
            }
            sendRequest.write(resBody);
        }
    }
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
        var fullYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
        var weekNumber = Math.floor(((now - fullYear) / 1000 / 60 / 60 / 24 + fullYear.getDay()) / 7) + 1;

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
        var fullYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
        var weekNumber = Math.floor(((now - fullYear) / 1000 / 60 / 60 / 24 + fullYear.getDay()) / 7) + 1;

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

/* GET home page. */
router.post('/interact', function(req, res, next) {
    let payload = req.body;
    res.sendStatus(200);

    var botToken = req.app.get('bot-token');

    if (payload.event.type === "app_mention") {
        if (payload.event.text.includes("add schedule")) {
            var resBody = {
                "token": botToken,
                "channel": payload.event.item.channel,
                "text": "Hello World!"
            }
            sendRequest.write(resBody);
        }
    }
});

module.exports = router;
