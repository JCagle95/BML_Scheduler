var express = require('express');
var router = express.Router();

var mongodb = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID;

/* GET home page. */
router.get('/', function(req, res, next) {
    res.send({ text: 'This is a testing reply' });
});

router.post('/add', function(req, res, next) {

    var url = req.app.get('mongodb');
    var database = req.app.get('database');

    mongodb.connect(url, { useNewUrlParser: true }, async function(err, client) {
        if (err) {
            console.log("Error Connecting to Database");
            res.send({text: "Error connecting to the database."}));
            return;
        }

        var db = client.db(database);
        var collection = db.collection('schedule');

        res.send({ text: 'This is a testing reply' });
    }
});

module.exports = router;
