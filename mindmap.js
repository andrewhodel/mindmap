var config = require('./config');
var journey = require('journey');
var mongodb = require('mongodb');
var async = require('async');
var bcrypt = require('bcrypt');
var fs = require('fs');
var url = require('url');
var urlize = require('./lib/urlize.js').urlize;
var md = require("node-markdown").Markdown;
var multiparty = require('multiparty');
var util = require('util');
var db = new mongodb.Db(config.mongo.dbname, new mongodb.Server(config.mongo.host, config.mongo.port, {
            'auto_reconnect': true
        }), {
        journal: true
    });

// global conf
var conf = {};

// Array.hasValue
Array.prototype.hasValue = function(value) {
    var i;
    for (i = 0; i < this.length; i++) {
        if (this[i] === value) return true;
    }
    return false;
}

function isValidMongoId(id) {

    if (!id) {
        return false;
    }

    id = id.toLowerCase();
    var validChar = '0123456789abcdef';
    var v = true;
    if (id.length != 24) {
        v = false;
    }
    for (idx = 0; idx < id.length; idx++) {
        if (validChar.indexOf(id.charAt(idx)) < 0) {
            v = false;
        }
    }
    return v;
}


function checkParams(params, validator, cb) {

    var err = false;
    var errorString = '';

    for (i = 0; i < validator.length; i++) {
        if (params[validator[i]] == undefined || params[validator[i]] == null || params[validator[i]] == '') {
            // value doesn't exist
            err = true;
            errorString += validator[i] + ' ';
        }
    }

    if (err == true) {
        cb('the following parameters must have a value: ' + errorString);
    } else {
        cb(null);
    }

}



function editParams(params, validator, cb) {

    var e = {};

    for (i = 0; i < validator.length; i++) {
        if (params[validator[i]] != undefined && params[validator[i]] != '') {
            // add item to set
            e[validator[i]] = params[validator[i]];
        }
    }

    console.log('params to edit');
    console.log(e);

    // return params to edit
    cb(e);

}

var router = new(journey.Router);

// UPDATE TYPES
/*
GET returns info on an object
POST creates an object
PUT updates an object
DELETE deletes an object
*/

/*
AUTHORIZATION
for any method which requires authorization, simple provide the following 2 params with request
username
password

Responds with 401 if auth fail
*/

function auth(username, password, res) {

    if (username == conf.username && bcrypt.compareSync(password, conf.password)) {
        return true;
    } else {
        res.send(401);
    }
}

/*
GET /auth - test auth

AUTH REQUIRED

REQUEST PARAMS
username*
password*

RESPONSE CODES
200 - Valid Zone
	returns {success:1}
*/
router.get('/auth').bind(function(req, res, params) {
    if (auth(params.username, params.password, res)) {
        res.send({
                'success': 1
            });
    }
});

/*
GET /events - returns events

AUTH REQUIRED

REQUEST PARAMS
id - STR id of a single event to return
sort - STR name of field to sort by ['created','lastView','lastEdit','numEdits','numViews']
volumes - restrict to comma separated list of volumes
reverseOrder - BOOLEAN true for <

RESPONSE CODES
200 - Valid
	returns json document with all events
500 - Error
	returns error
*/
router.get('/events').bind(function(req, res, params) {
    if (auth(params.username, params.password, res)) {

        var so = {};
        var f = {};

        if (isValidMongoId(params.id)) {
            f._id = new mongodb.ObjectID(params.id);
        } else {

            // first figure out volumes
            if (params.volumes != undefined) {
                var l = params.volumes.split(',');
                for (var i = 0; i < l.length; i++) {
                    f['volumes'] = l[i];
                }
            }

            // build sort object
            var validSorts = ['id', 'created', 'lastView', 'lastEdit', 'numEdits', 'numViews'];
            for (var i = 0; i < validSorts.length; i++) {
                if (params.sort == validSorts[i]) {
                    if (params.reverseOrder == true) {
                        so[validSorts[i]] = 1;
                    } else {
                        so[validSorts[i]] = -1;
                    }
                }
            }

        }

        db.collection('e', function(err, collection) {
            collection.find(f).sort(so).toArray(function(err, docs) {
                if (err) {
                    res.send(500, {}, {
                            'error': err
                        });
                } else {
                    res.send({
                            'success': 1,
                            'events': docs
                        });
                }
            });
        });

    }
});

/*
GET /eventData - get an event's data

AUTH REQUIRED

REQUEST PARAMS
id* - STR id of event
html - BOOLEAN true for parsed output html

RESPONSE CODES
200 - Valid Object
	returns json document eventData
500 - Error
	returns error
*/
router.get('/eventData').bind(function(req, res, params) {

    if (auth(params.username, params.password, res)) {

        async.series([

                function(callback) {
                    checkParams(params, ['id'], function(err) {
                        callback(err, '');
                    });
                },
                function(callback) {
                    if (isValidMongoId(params.id)) {
                        callback(null, '');
                    } else {
                        callback('invalid id', '');
                    }
                },
                function(callback) {
			// updating lastView
                        db.collection('e', function(err, collection) {
                            collection.update({
                                    _id: new mongodb.ObjectID(params.id)
                                }, {
                                    '$inc': {
                                        numViews: 1
                                    },
					'$set': {lastView: Math.round((new Date()).getTime() / 1000)}
                                }, function(err) {

                            callback(null, '');

			});
                        });
                }

            ], function(err, results) {

                if (err) {
                    res.send(500, {}, {
                            'error': err
                        });
                } else {

			// get data
        		db.collection('ed', function(err, collection) {
            			collection.find({eId:new mongodb.ObjectID(params.id)}).toArray(function(err, docs) {

			ht = docs[0];

                    if (params.html == 'true') {
                            //ht.d = md(ht.d, true);
                            ht.d = urlize(ht.d);
                            ht.d = ht.d.replace(/\n/g, '<br />');

                        }


                    res.send({
                            'success': 1,
                            'eventData': ht
                        });
		});
		});

                }
            });

    }

});

/*
POST /eventVolume - add an event to a volume

AUTH REQUIRED

REQUEST PARAMS
id* - STR id of event
v* - STR volume name

RESPONSE CODES
200 - Valid
	returns success
500 - Error
	returns error
*/
router.post('/eventVolume').bind(function(req, res, params) {

    if (auth(params.username, params.password, res)) {

        async.series([

                function(callback) {
                    checkParams(params, ['id', 'v'], function(err) {
                        callback(err, '');
                    });
                },
                function(callback) {
                    if (isValidMongoId(params.id)) {
                        callback(null, '');
                    } else {
                        callback('invalid id', '');
                    }
                },
                function(callback) {
                    // make sure event exists
                    db.collection('e', function(err, collection) {
                        collection.find({
                                '_id': new mongodb.ObjectID(params.id)
                            }).toArray(function(err, docs) {
                                if (docs.length > 0) {
					if (docs[0].volumes) {
						var exists = false;
						// check that this volume is not there
						for (var i=0; i<docs[0].volumes.length; i++) {
							if (docs[0].volumes[i] == params.v) {
								// exists
								exists = true;
							}
						}
						if (exists) {
							callback('volume already exists for event', '');
						} else {
                                    			callback(null, '');
						}
					} else {
						// event has no volumes, succeed
                                    callback(null, '');
					}
                                } else {
                                    callback('event not found with _id ' + params.id, '');
                                }
                            });
                    });
                },
                function(callback) {
                    // add event to volume
                    db.collection('e', function(err, collection) {
                        collection.update({
                                '_id': new mongodb.ObjectID(params.id)
                            }, {
                                '$push': {
                                    'volumes': params.v
                                }
                            }, {
                                'safe': true
                            }, function(err, docs) {
                                callback(err, '');
                            });
                    });
                },
                function(callback) {
                    // add 1 to volume and lastModified
                    db.collection('v', function(err, collection) {
                        collection.update({
                                'name': params.v
                            }, {
                                '$inc': {
                                    'count': 1
                                },
                                '$set': {
                                    'ts': Math.round((new Date()).getTime() / 1000)
                                }
                            }, {
                                'safe': true,
                                'upsert': true
                            }, function(err, docs) {
                                callback(err, '');
                            });
                    });
                },

            ], function(err, results) {

                if (err) {
                    res.send(500, {}, {
                            'error': err
                        });
                } else {
                    res.send({
                            'success': 1
                        });
                }
            });

    }

});

/*
DELETE /eventVolume - delete event volume relation

AUTH REQUIRED

REQUEST PARAMS
id* - STR id of event
v* - STR name of volume

RESPONSE CODES
200 - Valid
	returns success
500 - Error
	returns error
*/
router.del('/eventVolume').bind(function(req, res, params) {

    if (auth(params.username, params.password, res)) {

        async.series([

                function(callback) {
                    checkParams(params, ['id', 'v'], function(err) {
                        callback(err, '');
                    });
                },
                function(callback) {
                    if (isValidMongoId(params.id)) {
                        callback(null, '');
                    } else {
                        callback('invalid id', '');
                    }
                },
                function(callback) {
                    // make sure event exists
                    db.collection('e', function(err, collection) {
                        collection.find({
                                '_id': new mongodb.ObjectID(params.id)
                            }).toArray(function(err, docs) {
                                if (docs.length > 0) {
                                    callback(null, '');
                                } else {
                                    callback('event not found with _id ' + params.id, '');
                                }
                            });
                    });
                },
                function(callback) {
                    // remove event from volume
                    db.collection('e', function(err, collection) {
                        collection.update({
                                '_id': new mongodb.ObjectID(params.id)
                            }, {
                                '$pull': {
                                    'volumes': params.v
                                }
                            }, {
                                'safe': true
                            }, function(err, docs) {
                                callback(err, '');
                            });
                    });
                },
                function(callback) {

                    // subtract 1 from volume and lastModified
                    db.collection('v', function(err, collection) {
                        collection.update({
                                'name': params.v
                            }, {
                                '$inc': {
                                    'count': -1
                                },
                                '$set': {
                                    'ts': Math.round((new Date()).getTime() / 1000)
                                }
                            }, {
                                'safe': true,
                                'upsert': true
                            }, function(err, docs) {
                                callback(err, '');
                            });
                    });

                },

            ], function(err, results) {

                if (err) {
                    res.send(500, {}, {
                            'error': err
                        });
                } else {
                    res.send({
                            'success': 1
                        });
                }
            });

    }

});

/*
GET /volumes - get all volumes

AUTH REQUIRED

REQUEST PARAMS

RESPONSE CODES
200 - Valid Object
	returns json document object
500 - Error
	returns error
*/
router.get('/volumes').bind(function(req, res, params) {

    if (auth(params.username, params.password, res)) {

        async.series([

                function(callback) {
                    // get related objects and importance
                    db.collection('v', function(err, collection) {
                        collection.find({
                            }).sort({
                                'count': -1
                            }).toArray(function(err, docs) {
                                // place the data in results[2]
                                callback(err, docs);
                            });
                    });
                }

            ], function(err, results) {

                if (err) {
                    res.send(500, {}, {
                            'error': err
                        });
                } else {
                    res.send({
                            'success': 1,
                            'volumes': results[0]
                        });
                }
            });

    }

});

/*
POST /event - create an event

AUTH REQUIRED

REQUEST PARAMS
title* - STR title of the event
d* - STR data of the event

RESPONSE CODES
200 - Object Created
	returns json document event
500 - Error
	returns nothing
*/
router.post('/event').bind(function(req, res, params) {

    if (auth(params.username, params.password, res)) {

        async.series([

                function(callback) {
                    checkParams(params, ['title', 'd'], function(err) {
                        callback(err, '');
                    });
                },

            ], function(err, results) {

                if (err) {
                    res.send(500, {}, {
                            'error': err
                        });
                } else {
                    db.collection('e', function(err, collection) {
                        var i = {
                            'title': params.title,
                            'created': Math.round((new Date()).getTime() / 1000)
                        };
                        collection.insert(i, function(err, docs) {
                            if (err) {
                                res.send(500, {}, {
                                        'error': err
                                    });
                            } else {
                                res.send({
                                        'success': 1,
                                        'event': docs[0]
                                    });
                                db.collection('ed', function(err, collection) {
                                    collection.insert({
                                            'eId': docs[0]._id,
                                            'd': params.d
                                        }, function(err, docs) {});
                                });
                            }
                        });
                    });
                }
            });

    }

});

/*
PUT /event - update an event

AUTH REQUIRED

REQUEST PARAMS
id* - STR id of the event
title - STR name of the event
d - STR data of the event

RESPONSE CODES
200 - Valid
	returns json document event
500 - Error
	returns error
*/
router.put('/event').bind(function(req, res, params) {

    if (auth(params.username, params.password, res)) {

        async.series([

                function(callback) {
                    checkParams(params, ['id'], function(err) {
                        callback(err, '');
                    });
                },
                function(callback) {
                    if (isValidMongoId(params.id)) {
                        callback(null, '');
                    } else {
                        callback('invalid id', '');
                    }
                },
                function(callback) {
                    // update d

                    editParams(params, ['d'], function(i) {

                        if (i.d) {

                            db.collection('ed', function(err, collection) {
                                collection.update({
                                        'eId': new mongodb.ObjectID(params.id)
                                    }, {
                                        '$set': {
                                            'd': i.d
                                        }
                                    }, {
                                        'safe': true
                                    }, function(err, docs) {
                                        callback(err, '');
                                    });
                            });

                        } else {
                            callback(null, '');
                        }

                    });

                },
                function(callback) {
                    // update o

                    editParams(params, ['name'], function(i) {

                        db.collection('e', function(err, collection) {
                            i.lastEdit = Math.round((new Date()).getTime() / 1000);
                            collection.update({
                                    '_id': new mongodb.ObjectID(params.id)
                                }, {
                                    '$set': i
                                }, {
                                    'safe': true
                                }, function(err, docs) {
                                    if (err) {
                                        callback(err, '');
                                    } else {
                                        // increment numEdits, don't really worry if it fails or not
                                        collection.update({
                                                _id: new mongodb.ObjectID(params.id)
                                            }, {
                                                '$inc': {
                                                    numEdits: 1
                                                }
                                            }, function(err) {});
                                        // put data in results[3]
                                        callback(null, docs[0]);
                                    }
                                });
                        });

                    });
                }

            ], function(err, results) {

                if (err) {
                    res.send(500, {}, {
                            'error': err
                        });
                } else {
                    res.send({
                            'success': 1,
                            'object': results[3]
                        });
                }
            });

    }

});

/*
DELETE /event - delete an event

AUTH REQUIRED

REQUEST PARAMS
id* - STR id of the event

RESPONSE CODES
200 - Valid
	returns json document admin
500 - Error
	returns error
*/
router.del('/event').bind(function(req, res, params) {

    if (auth(params.username, params.password, res)) {

        async.series([

                function(callback) {
                    checkParams(params, ['id'], function(err) {
                        callback(err, '');
                    });
                },
                function(callback) {
                    if (isValidMongoId(params.id)) {
                        callback(null, '');
                    } else {
                        callback('invalid id', '');
                    }
                }

            ], function(err, results) {

                if (err) {
                    res.send(500, {}, {
                            'error': err
                        });
                } else {

			// remove ed data
                    db.collection('ed', function(err, collection) {
			collection.remove({'eId':new mongodb.ObjectID(params.id)}, function(err, result) {
			});
			});

                    // loop through and decrement/timestamp volumes

                    db.collection('e', function(err, collection) {
                        collection.findAndModify({
                                _id: new mongodb.ObjectID(params.id)
                            }, [
                                ['_id', 'asc']
                            ], {}, {
                                remove: true
                            }, function(err, object) {
                                if (err) {
                                    res.send(500, {}, {
                                            'error': err
                                        });
                                } else {

                                    // subtract 1 from volume and lastModified for each volume
                                    db.collection('v', function(err, collection) {
                                        for (var i = 0; i < object.volumes.length; i++) {
                                            collection.update({
                                                    'name': object.volumes[i]
                                                }, {
                                                    '$inc': {
                                                        'count': -1
                                                    },
                                                    '$set': {
                                                        'ts': Math.round((new Date()).getTime() / 1000)
                                                    }
                                                }, {
                                                    'safe': true,
                                                    'upsert': true
                                                }, function(err, docs) {});
                                        }
                                    });


                                    res.send({
                                            'success': 1
                                        });
                                }
                            });
                    });
                }
            });

    }

});

// db open START
db.open(function(err, db) {
    if (db) {

        require('http').createServer(function(request, response) {

            if (request.method == 'OPTIONS') {

                response.writeHead(200, {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS, DELETE'
                    });
                response.end();

            } else {

                // break out params
                var up = url.parse(request.url, true);

                // check if this is a file upload
                if (up.pathname === '/upload' && request.method === 'POST') {

                    // parse a file upload
                    var form = new multiparty.Form({
                            autoFields: true,
                            autoFiles: true
                        });

                    form.on('error', function(err) {

                        console.log(err);
                        response.writeHead(400, {
                                'content-type': 'text/plain'
                            });
                        response.end("invalid request: " + err);

                    });

                    form.on('close', function() {

                    });

                    form.on('file', function(name, file) {
                        console.log(file);
                    });

                    form.parse(request, function(err, fields, files) {

                        console.log('---------------NEW UPLOAD REQUEST---------------');
                        console.log('username ' + fields.username);
                        console.log('password ' + fields.password);
                        console.log('FILES:');
                        console.log(files);

                        /**
            if (fields.username == conf.username && bcrypt.compareSync(fields.password, conf.password)) {

                response.setHeader("Access-Control-Allow-Origin", "*");
                response.setHeader("Access-Control-Allow-Headers", "X-Requested-With");
                response.writeHead(200, {'content-type': 'text/plain'});
                response.end(util.inspect({fields: fields, files: files}));

            } else {

                response.setHeader("Access-Control-Allow-Origin", "*");
                response.setHeader("Access-Control-Allow-Headers", "X-Requested-With");
                response.writeHead(401, {'content-type': 'text/plain'});
                response.end('invalid login');

            }
**/

                    });

                } else {

                    // this is an API request

                    var body = "";
                    request.addListener('data', function(chunk) {
                        body += chunk
                    });
                    request.addListener('end', function() {
                        // Dispatch the request to the router
                        router.handle(request, body, function(result) {
                            result.headers['Access-Control-Allow-Origin'] = '*';
                            result.headers['Access-Control-Allow-Methods'] = '*';
                            result.headers['Access-Control-Allow-Headers'] = 'X-Requested-With';
                            response.writeHead(result.status, result.headers);
                            response.end(result.body);
                            console.log('###### ' + request.method + ' ' + request.url + " ######\n" + result.body);
                        });
                    });

                }

            }

        }).listen(8000);
        console.log('listening on port 8000');

        // local memory update loop

        function ml() {

        }

        ml();

        // run it every minute
        setInterval(ml, 60000);

        // startup

        // indexes

        // events
        db.ensureIndex('e', 'created', {
                'unique': false
            }, function(err, name) {
                if (err) {
                    console.log(err)
                }
            });
        db.ensureIndex('e', 'lastView', {
                'unique': false
            }, function(err, name) {
                if (err) {
                    console.log(err)
                }
            });
        db.ensureIndex('e', 'lastEdit', {
                'unique': false
            }, function(err, name) {
                if (err) {
                    console.log(err)
                }
            });
        db.ensureIndex('e', 'numEdits', {
                'unique': false
            }, function(err, name) {
                if (err) {
                    console.log(err)
                }
            });
        db.ensureIndex('e', 'numViews', {
                'unique': false
            }, function(err, name) {
                if (err) {
                    console.log(err)
                }
            });
        db.ensureIndex('e', 'volumes', {
                'unique': false
            }, function(err, name) {
                if (err) {
                    console.log(err)
                }
            });

        // event data
        db.ensureIndex('ed', 'eId', {
                'unique': false
            }, function(err, name) {
                if (err) {
                    console.log(err)
                }
            });

        // volumes
        db.ensureIndex('v', 'name', {
                'unique': false
            }, function(err, name) {
                if (err) {
                    console.log(err)
                }
            });
        db.ensureIndex('v', 'count', {
                'unique': false
            }, function(err, name) {
                if (err) {
                    console.log(err)
                }
            });
        db.ensureIndex('v', 'lastModified', {
                'unique': false
            }, function(err, name) {
                if (err) {
                    console.log(err)
                }
            });


        // get config settings from db
        db.collection('c', function(err, collection) {
            collection.find({}).toArray(function(err, docs) {
                if (docs.length == 0) {
                    // this database has default settings
                    conf.username = 'username';
                    conf.password = bcrypt.hashSync('password', 8);
                } else {
                    // this database has settings
                    conf.username = docs[0].username;
                    conf.password = docs[0].password;
                }
            });
        });

    } else {
        console.log('db error');
        console.log(err);
    }
});
