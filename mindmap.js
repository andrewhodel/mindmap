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
var db = new mongodb.Db(config.mongo.dbname, new mongodb.Server(config.mongo.host, config.mongo.port, {'auto_reconnect':true}), {journal:true});

// Array.hasValue
Array.prototype.hasValue = function(value) {
    var i;
    for (i=0; i<this.length; i++) { if (this[i] === value) return true; }
    return false;
}

function isValidMongoId(id) {

    if (!id) {
        return false;
    }

    id = id.toLowerCase();
    var validChar='0123456789abcdef';
    var v = true;
    if (id.length != 24) {
        v = false;
    }
    for(idx=0;idx<id.length;idx++){
        if(validChar.indexOf(id.charAt(idx))<0){
            v = false;
        }
    }
    return v;
}


function checkParams(params, validator, cb) {

        var err = false;
        var errorString = '';

        for (i=0; i<validator.length; i++) {
            if (params[validator[i]] == undefined || params[validator[i]] == null || params[validator[i]] == '') {
                // value doesn't exist
                err = true;
                errorString += validator[i]+' ';
            }
        }

        if (err == true) {
            cb('the following parameters must have a value: '+errorString);
        } else {
            cb(null);
        }

}



function editParams(params, validator, cb) {

        var e = {};

        for (i=0; i<validator.length; i++) {
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
router.get('/auth').bind(function (req, res, params) {
	if (auth(params.username, params.password, res)) {
        res.send({'success':1});
	}
});

/*
GET /objectsList - return a sorted list of objects

AUTH REQUIRED

REQUEST PARAMS
id - STR id of a single object to return
sort - STR name of field to sort by ['importance','created','lastView','lastEdit','numEdits','numViews']
reverseOrder - BOOLEAN true for <

RESPONSE CODES
200 - Valid
	returns json document with all objects
500 - Error
	returns error
*/
router.get('/objectsList').bind(function (req, res, params) {
	if (auth(params.username, params.password, res)) {

        var so = {};
        var f = {};

        if (isValidMongoId(params.id)) {
            f._id = new mongodb.ObjectID(params.id);
        } else {

            // build sort object
            var validSorts = ['id','importance','created','lastView','lastEdit','numEdits','numViews'];
            for (var i=0; i<validSorts.length; i++) {
                if (params.sort == validSorts[i]) {
                    if (params.reverseOrder == true) {
                        so[validSorts[i]] = 1;
                    } else {
                        so[validSorts[i]] = -1;
                    }
                }
            }

        }

        db.collection('o', function (err, collection) {
            collection.find(f).sort(so).toArray(function(err, docs) {
                if (err) {
                    res.send(500, {}, {'error':err});
                } else {
                    res.send({'success':1, 'objects':docs});
                }
            });
        });

    }
});

/*
GET /objectsMap - return object map

AUTH REQUIRED

REQUEST PARAMS

RESPONSE CODES
200 - Valid
	returns json document with all objects
500 - Error
	returns error
*/
router.get('/objectsMap').bind(function (req, res, params) {
	if (auth(params.username, params.password, res)) {

        db.collection('o', function (err, collection) {
            collection.find({}).toArray(function(err, docs) {
                if (err) {
                    res.send(500, {}, {'error':err});
                } else {
                    res.send({'success':1, 'objects':docs});

                }
            });
        });

    }
});

/*
GET /objectData - get an object's data

AUTH REQUIRED

REQUEST PARAMS
id* - STR id of object
processed - BOOLEAN true will return post-processed data for types that support it
blurb - BOOLEAN true will only return 200 characters and will not update the view counter

RESPONSE CODES
200 - Valid Object
	returns json document objectData
500 - Error
	returns error
*/
router.get('/objectData').bind(function (req, res, params) {

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
                db.collection('o', function (err, collection) {
                    if (params.blurb == 'true') {
                        // just find, no modify
                        collection.find({'_id':new mongodb.ObjectID(params.id)}).toArray(function(err, docs) {
                            callback(err, docs[0]);
                        });
                    } else {
                        // find and modify
                        collection.findAndModify({'_id':new mongodb.ObjectID(params.id)}, [['_id','asc']], {'$set':{'lastView':Math.round((new Date()).getTime() / 1000)}}, {}, function(err, doc) {
                            // place the object in results[2]
                            callback(err, doc);
                        });
                    }
                });
            },
            function(callback) {
                // get data
                db.collection('d', function (err, collection) {
                    collection.find({'oId':new mongodb.ObjectID(params.id)}).toArray(function(err, docs) {
                        // place the data in results[3]
                        callback(err, docs[0].d);
                    });
                });
            },
            function(callback) {
                if (params.blurb != 'true') {
                    db.collection('o', function (err, collection) {
                        collection.update({_id:new mongodb.ObjectID(params.id)},{'$inc':{numViews:1}}, function(err) {});
                        callback(null, '');
                    });
                } else {
                    callback(null, '');
                }
            }

        ], function(err, results) {

                if (err) {
                    res.send(500, {}, {'error':err});
                } else {

                    var ht = results[3];

                    if (params.processed == 'true') {

                        // could check if data has been previously processed and is not out of data here

                        // check first line for !# which indicates this is a script
                        if (results[3].substr(0,2) == '!#') {
                            // explode on newline
                            // character limit on script names
                            var l = results[3].substr(0,100).split("\n");
                            // get script name
                            var sc = l[0].substr(2);

                            if (sc == 'md') {
                                // process markdown
                                ht = md(results[3].split("\n").slice(1).join("\n"), true);
                            } else {
                                // return script not found
                                ht = 'script type '+sc+' not found';
                            }
                        } else {
                            // convert links to href
                            ht = urlize(ht);

                            // convert newlines to br
                            ht = ht.replace(/\n/g, '<br />');

                            // embed images

                            // could do all kinds of fancy stuff here
                        }

                    }

                    if (params.blurb == 'true') {
                        // limit the length of data to a blurb
                        ht = ht.substring(0,200);
                        ht = urlize(ht);
                    }

                    res.send({'success':1,'objectData':ht});
                }
        });

    }

});

/*
POST /objectRelation - add related object

AUTH REQUIRED

REQUEST PARAMS
id* - STR id of object
importance* - INT object importance of distint object
dId* - STR distint object id
dImportance* - INT distint object importance of object

RESPONSE CODES
200 - Valid Object
	returns json document object
500 - Error
	returns error
*/
router.post('/objectRelation').bind(function (req, res, params) {

	if (auth(params.username, params.password, res)) {

        async.series([

            function(callback) {
                checkParams(params, ['id','importance','dId','dImportance'], function(err) {
                    callback(err, '');
                });
            },
            function(callback) {
                params.importance = parseInt(params.importance);
                params.dImportance = parseInt(params.dImportance);
                if (params.importance > 0 && params.importance < 11 && params.dImportance > 0 && params.dImportance < 11) {
                    callback(null, '');
                } else {
                    callback ('importance and dImportance must be between 1 and 10', '');
                }
            },
            function(callback) {
                if (isValidMongoId(params.id)) {
                    callback(null, '');
                } else {
                    callback('invalid id', '');
                }
            },
            function(callback) {
                if (isValidMongoId(params.dId)) {
                    callback(null, '');
                } else {
                    callback('invalid dId', '');
                }
            },
            function(callback) {
                // make sure distint object exists
                db.collection('o', function(err, collection) {
                    collection.find({'_id':new mongodb.ObjectID(params.dId)}).toArray(function(err, docs) {
                        if (docs.length>0) {
                            callback(null, '');
                        } else {
                            callback('distint object not found with _id '+params.dId, '');
                        }
                    });
                });
            },
            function(callback) {
                // add relation to object
                db.collection('r', function(err, collection) {
                    collection.insert({'dId':new mongodb.ObjectID(params.dId),'oId':new mongodb.ObjectID(params.id),'i':params.importance,'dI':params.dImportance}, function(err, docs) {
                        callback(err, '');
                    });
                });
            },
            function(callback) {
                // add relation to distint object
                db.collection('r', function(err, collection) {
                    collection.insert({'dId':new mongodb.ObjectID(params.id),'oId':new mongodb.ObjectID(params.dId),'i':params.dImportance,'dI':params.importance}, function(err, docs) {
                        callback(err, '');
                    });
                });
            },
            function(callback) {
                // add importance to object
                db.collection('o', function(err, collection) {
                    collection.update({'_id':new mongodb.ObjectID(params.id)}, {'$inc':{'importance':params.importance}}, {'safe':true}, function(err, docs) {
                        callback(err, '');
                    });
                });
            },
            function(callback) {
                // add importance to distant object
                db.collection('o', function(err, collection) {
                    collection.update({'_id':new mongodb.ObjectID(params.dId)}, {'$inc':{'importance':params.dImportance}}, {'safe':true}, function(err, docs) {
                        callback(err, '');
                    });
                });
            }

        ], function(err, results) {

                if (err) {
                    res.send(500, {}, {'error':err});
                } else {
                    res.send({'success':1});
                }
        });

    }

});

/*
DELETE /objectRelation - delete object relation

AUTH REQUIRED

REQUEST PARAMS
id* - STR id of object
dId* - STR distint object id

RESPONSE CODES
200 - Valid Object
	returns json document object
500 - Error
	returns error
*/
router.del('/objectRelation').bind(function (req, res, params) {

	if (auth(params.username, params.password, res)) {

        async.series([

            function(callback) {
                checkParams(params, ['id','dId'], function(err) {
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
                if (isValidMongoId(params.dId)) {
                    callback(null, '');
                } else {
                    callback('invalid dId', '');
                }
            },
            function(callback) {
                // remove relation from object
                db.collection('r', function(err, collection) {
                    collection.remove({'dId':new mongodb.ObjectID(params.dId),'oId':new mongodb.ObjectID(params.id)}, function(err, docs) {
                        // remove importance from distint owner object
                        db.collection('o', function(err, collection) {
                            collection.update({'_id':new mongodb.ObjectID(params.dId)}, {'$inc':{'importance':-docs[0].i}}, {'safe':true}, function(err, docs) {
                            });
                        });
                        callback(err, '');
                    });
                });
            },
            function(callback) {
                // remove relation from distint object
                db.collection('r', function(err, collection) {
                    collection.remove({'dId':new mongodb.ObjectID(params.id),'oId':new mongodb.ObjectID(params.dId)}, function(err, docs) {
                        // remove importance from owner object
                        db.collection('o', function(err, collection) {
                            collection.update({'_id':new mongodb.ObjectID(params.id)}, {'$inc':{'importance':-docs[0].i}}, {'safe':true}, function(err, docs) {
                            });
                        });
                        callback(err, '');
                    });
                });
            }

        ], function(err, results) {

                if (err) {
                    res.send(500, {}, {'error':err});
                } else {
                    res.send({'success':1});
                }
        });

    }

});

/*
GET /objectRelations - get object relations

AUTH REQUIRED

REQUEST PARAMS
id* - STR id of object

RESPONSE CODES
200 - Valid Object
	returns json document object
500 - Error
	returns error
*/
router.get('/objectRelations').bind(function (req, res, params) {

// of course all objects which are related but also

// last edited nearly the same time
// viewed nearly the same number of times
// created nearly the same time

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
                // get related objects and importance
                db.collection('r', function(err, collection) {
                    collection.find({'oId':new mongodb.ObjectID(params.id)}).sort({'i':-1}).toArray(function(err, docs) {
                        // place the data in results[2]
                        callback(err, docs);
                    });
                });
            }

        ], function(err, results) {

                if (err) {
                    res.send(500, {}, {'error':err});
                } else {
                    res.send({'success':1,'related':results[2]});
                }
        });

    }

});

/*
POST /object - create an object

AUTH REQUIRED

REQUEST PARAMS
name* - STR name of the object
data* - STR data of the object

RESPONSE CODES
200 - Object Created
	returns json document object
500 - Error
	returns nothing
*/
router.post('/object').bind(function (req, res, params) {

	if (auth(params.username, params.password, res)) {

        async.series([

            function(callback) {
                checkParams(params, ['name','data'], function(err) {
                    callback(err, '');
                });
            },

        ], function(err, results) {

                if (err) {
                    res.send(500, {}, {'error':err});
                } else {
                    db.collection('o', function (err, collection) {
                        var i = {'name':params.name,'created':Math.round((new Date()).getTime() / 1000)};
                        collection.insert(i, function(err, docs) {
                            if (err) {
                                res.send(500, {}, {'error':err});
                            } else {
                                res.send({'success':1, 'object':docs[0]});
                                // insert the data
                                db.collection('d', function(err, collection) {
                                    collection.insert({'oId':docs[0]._id,'d':params.data}, function(err, docs) {
                                    });
                                });
                            }
                        });
                    });
                }
        });

    }

});

/*
PUT /object - update an object

AUTH REQUIRED

REQUEST PARAMS
id* - STR id of the object
name - STR name of the object
data - STR data of the object

RESPONSE CODES
200 - Valid Zone
	returns json document object
500 - Error
	returns error
*/
router.put('/object').bind(function (req, res, params) {

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

                editParams(params, ['data'], function(i) {

                if (i.data) {

                db.collection('d', function (err, collection) {
                    collection.update({'oId':new mongodb.ObjectID(params.id)}, {'$set':{'d':i.data}}, {'safe':true}, function(err, docs) {
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

                db.collection('o', function (err, collection) {
                    i.lastEdit = Math.round((new Date()).getTime() / 1000);
                    collection.update({'_id':new mongodb.ObjectID(params.id)}, {'$set':i}, {'safe':true}, function(err, docs) {
                        if (err) {
                            callback(err, '');
                        } else {
                            // increment numEdits, don't really worry if it fails or not
                            collection.update({_id:new mongodb.ObjectID(params.id)},{'$inc':{numEdits:1}}, function(err) {});
                            // put data in results[3]
                            callback(null, docs[0]);
                        }
                    });
                });

                });
            }

        ], function(err, results) {

                if (err) {
                    res.send(500, {}, {'error':err});
                } else {
                    res.send({'success':1, 'object':results[3]});
                }
        });

    }

});

/*
DELETE /object - delete an object

AUTH REQUIRED

REQUEST PARAMS
id* - STR id of the object

RESPONSE CODES
200 - Valid Zone
	returns json document admin
500 - Error
	returns error
*/
router.del('/object').bind(function (req, res, params) {

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
                db.collection('d', function (err, collection) {
                    collection.remove({'oId':new mongodb.ObjectID(params.id)}, function(err) {
                        callback(err, '');
                    });
                });
            }

        ], function(err, results) {

                if (err) {
                    res.send(500, {}, {'error':err});
                } else {
                    db.collection('o', function (err, collection) {
                        collection.remove({'_id':new mongodb.ObjectID(params.id)}, function(err) {
                            if (err) {
                                res.send(500, {}, {'error':err});
                            } else {
                                res.send({'success':1});
                            }
                        });
                    });
                }
        });

    }

});

// db open START
db.open(function (err, db) {
if (db) {

require('http').createServer(function (request, response) {

    if (request.method == 'OPTIONS') {

        response.writeHead(200, {'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Methods':'GET, POST, PUT, OPTIONS, DELETE'});
        response.end();

    } else {

    // break out params
    var up = url.parse(request.url, true);

    console.log(up.pathname);

    // check if this is a file upload
    if (up.pathname === '/upload' && request.method === 'POST') {

        // parse a file upload
        var form = new multiparty.Form({autoFields:true,autoFiles:true});

        form.on('error', function(err) {

            console.log(err);
            response.writeHead(400, {'content-type': 'text/plain'});
            response.end("invalid request: " + err);

        });

        form.on('close', function() {
            
        });

        form.on('file', function(name, file) {
            console.log(file);
        });

        form.parse(request, function(err, fields, files) {

            console.log('---------------NEW UPLOAD REQUEST---------------');
            console.log('username '+fields.username);
            console.log('password '+fields.password);
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
        request.addListener('data', function (chunk) { body += chunk });
        request.addListener('end', function () {
            // Dispatch the request to the router
            router.handle(request, body, function (result) {
                result.headers['Access-Control-Allow-Origin'] = '*';
                result.headers['Access-Control-Allow-Methods'] = '*';
                result.headers['Access-Control-Allow-Headers'] = 'X-Requested-With';
                response.writeHead(result.status, result.headers);
                response.end(result.body);
                console.log('###### '+request.method+' '+request.url+" ######\n"+result.body);
            });
        });

    }

    }

}).listen(8000);
console.log('listening on port 8000');

} else {
    console.log('db error');
    console.log(err);
}
});

// local memory update loop
function ml() {

}

ml();

// run it every minute
setInterval(ml,60000);

// startup

// indexes

// [o]bjects
db.ensureIndex('o', 'importance', {'unique':false}, function(err, name) { if (err) { console.log(err) } });
db.ensureIndex('o', 'created', {'unique':false}, function(err, name) { if (err) { console.log(err) } });
db.ensureIndex('o', 'lastView', {'unique':false}, function(err, name) { if (err) { console.log(err) } });
db.ensureIndex('o', 'lastEdit', {'unique':false}, function(err, name) { if (err) { console.log(err) } });
db.ensureIndex('o', 'numEdits', {'unique':false}, function(err, name) { if (err) { console.log(err) } });
db.ensureIndex('o', 'numViews', {'unique':false}, function(err, name) { if (err) { console.log(err) } });

// [d]ata
db.ensureIndex('d', 'oId', {'unique':true}, function(err, name) { if (err) { console.log(err) } });

// [c]onfig
//db.ensureIndex('c', '', {'unique':false}, function(err, name) { if (err) { console.log(err) } });

// [r]elations
db.ensureIndex('r', {'dId':1,'i':1}, {'unique':false}, function(err, name) { if (err) { console.log(err) } });

// global conf
var conf = {};

// get config settings from db
db.collection('c', function (err, collection) {
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

