var config = require('./config');
var journey = require('journey');
var mongodb = require('mongodb');
var async = require('async');
var bcrypt = require('bcryptjs');
var fs = require('fs');
var url = require('url');
var https = require('https');
var static = require('node-static');
var marked = require('marked');
var multiparty = require('multiparty');
var util = require('util');
var mime = require('mime');
var im = require('imagemagick');
var sys = require('sys')
var exec = require('child_process').exec;
var path = require('path');
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
limit - limit results to number
last - show after last

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
			var validSorts = ['_id', 'created', 'lastView', 'lastEdit', 'numEdits', 'numViews'];
			if (params.sort == 'created') {
				params.sort = '_id';
			}
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

		// setup limit
		if (typeof params.limit === 'undefined') {
			params.limit = 0;
		}

		if (typeof params.last !== 'undefined') {
			if (so[Object.keys(so)[0]] === -1) {
				f[Object.keys(so)[0]] = {
					'$lt': new mongodb.ObjectID(params.last)
				};
			} else {
				f[Object.keys(so)[0]] = {
					'$gt': new mongodb.ObjectID(params.last)
				};
			}
		}

		db.collection('e', function(err, collection) {
			collection.find(f).sort(so).limit(Number(params.limit)).toArray(function(err, docs) {
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
						'$set': {
							lastView: Math.round((new Date()).getTime() / 1000)
						}
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
					collection.find({
						eId: new mongodb.ObjectID(params.id)
					}).toArray(function(err, docs) {

						if (docs.length > 0) {

						ht = docs[0];

						if (params.html == 'true') {

							var mo = {
								gfm: true,
								highlight: false,
								tables: true,
								breaks: false,
								pedantic: false,
								sanitize: true,
								smartLists: true,
								smartypants: false,
								langPrefix: 'lang-'
							};

							marked(ht.d, mo, function(err, content) {
								if (err) throw err;

								ht.d = content;

								res.send({
									'success': 1,
									'eventData': ht
								});

							});

						} else {

							res.send({
								'success': 1,
								'eventData': ht
							});

						}

						} else {
							console.log('did not find that db entry');
							res.send(500, {}, {'error':'did not find that db entry'});
						}
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
								for (var i = 0; i < docs[0].volumes.length; i++) {
									if (docs[0].volumes[i] == params.v) {
										// exists
										exists = true;
									}
								}
								if (exists) {
									callback('volume already exists for event', '');
								} else {
									callback(null, docs);
								}
							} else {
								// event has no volumes, succeed
								callback(null, 'novolumes');
							}
						} else {
							callback('event not found with _id ' + params.id, '');
						}
					});
				});
			},
			function(callback) {
				// add volume to event
				db.collection('e', function(err, collection) {
					collection.update({
						'_id': new mongodb.ObjectID(params.id)
					}, {
						'$push': {
							'volumes': params.v
						}
					}, {
						'new': true
					}, function(err, docs) {

						// update lastEdit for event
						collection.update({
							'_id': new mongodb.ObjectID(params.id)
						}, {
							'$set': {
								lastEdit: Math.round((new Date()).getTime() / 1000)
							}
						}, {
							'safe': true
						}, function(err, docs) {});

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
						'upsert': true
					}, function(err, docs) {
						callback(err, '');
					});
				});

			},

		], function(err, results) {

			//console.log(results);
			if (results[2] != 'novolumes') {
				for (var i = 0; i < results[2][0].volumes.length; i++) {

					if (results[2][0].volumes[i] != params.v) {
						// for each other volume on this event we must add 1 to the connection for params.v
						db.collection('v', function(err, collection) {
							var variable = 'connections.' + results[2][0].volumes[i];
							var action = {};
							action[variable] = 1;
							collection.update({
								'name': params.v
							}, {
								'$inc': action
							}, {
								'safe': true
							}, function(err, docs) {
								console.log(err);
							});
						});

						// as well as add 1 to params.v for each other volume
						db.collection('v', function(err, collection) {
							var variable = 'connections.' + params.v;
							var action = {};
							action[variable] = 1;
							collection.update({
								'name': results[2][0].volumes[i]
							}, {
								'$inc': action
							}, {}, function(err, docs) {});
						});
					}

				}
			}

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
							callback(null, docs);
						} else {
							callback('event not found with _id ' + params.id, '');
						}
					});
				});
			},
			function(callback) {
				// remove volume from event
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

						// update lastEdit for event
						collection.update({
							'_id': new mongodb.ObjectID(params.id)
						}, {
							'$set': {
								lastEdit: Math.round((new Date()).getTime() / 1000)
							}
						}, {
							'safe': true
						}, function(err, docs) {});

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

			//console.log(results);

			for (var i = 0; i < results[2][0].volumes.length; i++) {

				if (results[2][0].volumes[i] != params.v) {
					// for each other volume on this event we must subtract 1 to the connection for params.v
					db.collection('v', function(err, collection) {
						var variable = 'connections.' + results[2][0].volumes[i];
						var action = {};
						action[variable] = -1;
						collection.update({
							'name': params.v
						}, {
							'$inc': action
						}, {
							'safe': true
						}, function(err, docs) {
							console.log(err);
						});
					});
					// as well as subtract 1 to params.v for each other volume
					db.collection('v', function(err, collection) {
						var variable = 'connections.' + params.v;
						var action = {};
						action[variable] = -1;
						collection.update({
							'name': results[2][0].volumes[i]
						}, {
							'$inc': action
						}, {}, function(err, docs) {});
					});
				}

			}

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
single - name of single volume to return if you only want 1

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
				// get volumes

				var f = {};

				// first figure out volumes
				if (params.single != undefined) {
					f.name = params.single;
				}

				db.collection('v', function(err, collection) {
					collection.find(f).sort({
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
created - INT unix timestamp of creation date

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
						'created': Math.round((new Date()).getTime() / 1000),
						'lastEdit': Math.round((new Date()).getTime() / 1000),
						'lastView': Math.round((new Date()).getTime() / 1000),
						'numEdits': 0,
						'numViews': 0
					};

					if (params.created > 0) {
						// add ts
						i.created = Number(params.created);
					}

					console.log('adding ',i);

					collection.insert(i, function(err, docs) {

						if (err) {
							res.send(500, {}, {
								'error': err
							});
						} else {
							res.send({
								'success': 1,
								'event': docs.ops[0]
							});
							db.collection('ed', function(err, collection) {
								collection.insert({
									'eId': docs.ops[0]._id,
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
				// update e

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
					collection.remove({
						'eId': new mongodb.ObjectID(params.id)
					}, function(err, result) {});
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

							if (typeof object.volumes !== 'undefined') {

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

							}


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

/*
DELETE /file - delete a file
file must have no event

AUTH REQUIRED

REQUEST PARAMS
fileId* - STR id of the file

RESPONSE CODES
200 - Valid
	returns json document admin
500 - Error
	returns error
*/
router.del('/file').bind(function(req, res, params) {

	if (auth(params.username, params.password, res)) {

		async.series([

			function(callback) {
				checkParams(params, ['fileId'], function(err) {
					callback(err, '');
				});
			},
			function(callback) {
				if (isValidMongoId(params.fileId)) {
					callback(null, '');
				} else {
					callback('invalid fileId', '');
				}
			},
			function(callback) {
				// get the file from filebin

				db.collection('filebin', function(err, collection) {
					collection.find({
						'fileId': new mongodb.ObjectID(params.fileId)
					}).toArray(function(err, docs) {
						callback(err, docs)
					});
				});

			}

		], function(err, results) {

			if (err) {
				res.send(500, {}, {
					'error': err
				});
			} else {

				if (results[2][0].length < 1) {
					// no file, error
					res.send(500, {}, {
						'error': 'no file exists'
					});
				} else if (results[2][0].event != '' && results[2][0].event != undefined) {
					console.log('cannot delete file, event = ' + results[2][0].event)
					res.send(500, {}, {
						'error': 'cannot delete file, event = ' + results[2][0].event
					});
				} else {
					// remove filebin entry
					db.collection('filebin', function(err, collection) {
						collection.remove({
							'fileId': new mongodb.ObjectID(params.fileId)
						}, function(err, result) {
							res.send({
								'success': 1
							});
						});
					});

					// remove thumbs from gridstore
					if (results[2][0].thumbs) {
						for (var i = 0; i < results[2][0].thumbs.length; i++) {
							mongodb.GridStore.unlink(db, results[2][0].thumbs[i].fileId, function(err, gridStore) {
								console.log('gridstore removing thumb');
							});
						}
					}

					// remove videoThumb from gridstore
					if (results[2][0].videoThumb) {
						mongodb.GridStore.unlink(db, results[2][0].videoThumb.fileId, function(err, gridStore) {
							console.log('gridstore removing videoThumb');
						});
					}

					// remove file from gridstore
					mongodb.GridStore.unlink(db, new mongodb.ObjectID(params.fileId), function(err, gridStore) {
						console.log('gridstore removing file');
					});

				}
			}

		});

	}

});

/*
GET /filebin - list all files in filebin

AUTH REQUIRED

REQUEST PARAMS
event - pass an event id if you want just files for one event

RESPONSE CODES
200 - Valid Object
	returns json document object
500 - Error
	returns error
*/
router.get('/filebin').bind(function(req, res, params) {

	if (auth(params.username, params.password, res)) {

		async.series([

			function(callback) {
				if (params.event) {
					if (isValidMongoId(params.event)) {
						callback(null, '');
					} else {
						callback('invalid id', '');
					}
				} else {
					callback(null, '');
				}
			},
			function(callback) {
				// get filebin
				var i = {
					event: null
				};
				if (params.event) {
					if (isValidMongoId(params.event)) {
						i.event = new mongodb.ObjectID(params.event);
					}
				}

				db.collection('filebin', function(err, collection) {
					collection.find(i).sort({
						'created': -1
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
					'filebin': results[1]
				});
			}
		});

	}

});

/*
POST /fileEvent - add a file to an event

AUTH REQUIRED

REQUEST PARAMS
id* - STR id of event
f* - STR id of file

RESPONSE CODES
200 - Valid
	returns success
500 - Error
	returns error
*/
router.post('/fileEvent').bind(function(req, res, params) {

	if (auth(params.username, params.password, res)) {

		async.series([

			function(callback) {
				checkParams(params, ['id', 'f'], function(err) {
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
				if (isValidMongoId(params.f)) {
					callback(null, '');
				} else {
					callback('invalid f', '');
				}
			},
			function(callback) {
				// make sure event exists
				db.collection('e', function(err, collection) {
					collection.find({
						'_id': new mongodb.ObjectID(params.id)
					}).toArray(function(err, docs) {
						if (docs.length > 0) {
							callback(null);
						} else {
							callback('event not found with _id ' + params.id, '');
						}
					});
				});
			},
			function(callback) {
				// make sure file exists
				db.collection('filebin', function(err, collection) {
					collection.find({
						'fileId': new mongodb.ObjectID(params.f)
					}).toArray(function(err, docs) {
						if (docs.length > 0) {
							callback(null);
						} else {
							callback('file not found with fileId ' + params.f, '');
						}
					});
				});
			},
			function(callback) {
				// add file to event
				db.collection('e', function(err, collection) {
					collection.update({
						'_id': new mongodb.ObjectID(params.id)
					}, {
						'$push': {
							'files': new mongodb.ObjectID(params.f)
						}
					}, {
						'safe': true
					}, function(err, docs) {

						// update lastEdit for event
						collection.update({
							'_id': new mongodb.ObjectID(params.id)
						}, {
							'$set': {
								lastEdit: Math.round((new Date()).getTime() / 1000)
							}
						}, {
							'safe': true
						}, function(err, docs) {});

						callback(err, '');
					});
				});
			},
			function(callback) {
				// add event to file
				db.collection('filebin', function(err, collection) {
					collection.update({
						'fileId': new mongodb.ObjectID(params.f)
					}, {
						'$set': {
							'event': new mongodb.ObjectID(params.id)
						}
					}, {
						'safe': true
					}, function(err, docs) {

						callback(err, '');
					});
				});

			},

		], function(err, results) {

			//console.log(results);

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
DELETE /fileEvent - delete a file from an event

AUTH REQUIRED

REQUEST PARAMS
id* - STR id of event
f* - STR id of file

RESPONSE CODES
200 - Valid
	returns success
500 - Error
	returns error
*/
router.del('/fileEvent').bind(function(req, res, params) {

	if (auth(params.username, params.password, res)) {

		async.series([

			function(callback) {
				checkParams(params, ['id', 'f'], function(err) {
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
				if (isValidMongoId(params.f)) {
					callback(null, '');
				} else {
					callback('invalid f', '');
				}
			},
			function(callback) {
				// make sure event exists
				db.collection('e', function(err, collection) {
					collection.find({
						'_id': new mongodb.ObjectID(params.id)
					}).toArray(function(err, docs) {
						if (docs.length > 0) {
							callback(null);
						} else {
							callback('event not found with _id ' + params.id, '');
						}
					});
				});
			},
			function(callback) {
				// make sure file exists
				db.collection('filebin', function(err, collection) {
					collection.find({
						'fileId': new mongodb.ObjectID(params.f)
					}).toArray(function(err, docs) {
						if (docs.length > 0) {
							callback(null);
						} else {
							callback('file not found with fileId ' + params.f, '');
						}
					});
				});
			},
			function(callback) {
				// remove file from event
				db.collection('e', function(err, collection) {
					collection.update({
						'_id': new mongodb.ObjectID(params.id)
					}, {
						'$pull': {
							'files': new mongodb.ObjectID(params.f)
						}
					}, {
						'safe': true
					}, function(err, docs) {

						// update lastEdit for event
						collection.update({
							'_id': new mongodb.ObjectID(params.id)
						}, {
							'$set': {
								lastEdit: Math.round((new Date()).getTime() / 1000)
							}
						}, {
							'safe': true
						}, function(err, docs) {});

						callback(err, '');
					});
				});
			},
			function(callback) {
				// remove event from file
				db.collection('filebin', function(err, collection) {
					collection.update({
						'fileId': new mongodb.ObjectID(params.f)
					}, {
						'$unset': {
							'event': ''
						}
					}, {
						'safe': true
					}, function(err, docs) {

						callback(err, '');
					});
				});

			},

		], function(err, results) {

			//console.log(results);

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
POST /fetch - download a url to the filebin

works with http, ftp, youtube-dl and torrents

AUTH REQUIRED

REQUEST PARAMS
url* - STR url of the item to be downloaded

RESPONSE CODES
200 - Object Created
	returns json document
500 - Error
	returns nothing
*/
router.post('/REWRITEfetch').bind(function(req, res, params) {

	if (auth(params.username, params.password, res)) {

		async.series([

			function(callback) {
				checkParams(params, ['url'], function(err) {
					callback(err, '');
				});
			},

		], function(err, results) {

			if (err) {
				res.send(500, {}, {
					'error': err
				});
			} else {

				// Our file ID
				var fileId = new mongodb.ObjectID();

				console.log('fetching file ' + params.url);

				var s = params.url.split('/');
				var tmp = "/tmp/" + fileId + '-' + s[s.length - 1];
				// start download
				var filestream = fs.createWriteStream(tmp);
				var urlp = url.parse(params.url);
				var req = require('follow-redirects').http.request({
					hostname: urlp.hostname,
					path: urlp.path,
					method: urlp.method,
					port: urlp.port,
					headers: {
						'User-Agent': 'Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US; rv:1.8.1.13) Gecko/20080311 Firefox/2.0.0.13'
					}
				}, function(resp) {
					if (resp.statusCode == 200) {

						// add filebin entry for mongo as uploaded
						db.collection('filebin', function(err, collection) {
							var i = {
								'name': params.url,
								'fileId': fileId,
								'exception': 'fetching',
								'created': Math.round((new Date()).getTime() / 1000)
							};
							collection.insert(i, function(err, docs) {});
						});
						// send back success	
						res.send(200, {}, {
							'success': 1
						});

						// write data to file
						resp.on('data', function(data) {
							filestream.write(data);
							//console.log(data.length);
						});

						resp.on('error', function(err) {
							console.log(err);
							// error, need to update filebin entry
						});

						resp.on('end', function() {
							processFile(fileId, tmp, function(err) {});
						});
					} else {
						// invalid fetch url
						console.log('invalid fetch url');
						res.send(500, {}, {
							'error': 'invalid fetch url'
						});
					}
				});

				filestream.on('error', function(err) {
					console.log(err);
					// error, need to update filebin entry
				})

				req.on('error', function(err) {
					console.log(err);
				});

				req.end();

			}
		});

	}

});

// function to load a fs file into gridstore
function fileToDb(fileId, filepath, deleteFile, cb) {

	// Open a new file
	var gridStore = new mongodb.GridStore(db, fileId, 'w', {
		'content_type': mime.getType(filepath)
	});

	// Open the new file
	gridStore.open(function(err, gridStore) {

		if (err) {
			callback(err, null);
		}

		// Write the file to gridFS
		gridStore.writeFile(filepath, function(err, doc) {
			console.log('added to gridfs ' + fileId);

			if (deleteFile === true) {
				// delete source file
				fs.unlink(filepath, function(err) {});
			}
			cb(err);

		});
	});
}

// function to process a file
function processFile(filepath, name, cb) {

	console.log('processFile', filepath, name);

	var fileId = new mongodb.ObjectID();

	var m = mime.getType(filepath);

	var filestats = fs.statSync(filepath);

	var u = {
		mimetype: m,
		size: filestats.size,
		name: name,
		fileId: fileId,
		created: Math.round((new Date()).getTime() / 1000)
	};

	// update db with size and thumbnails
	db.collection('filebin', function(err, collection) {
		collection.insert(u, function(err, docs) {});
		// callback
		cb(err);
	});

	// call thumbs
	if (m == 'image/jpeg' || m == 'image/gif' || m == 'image/png') {
		// call fileToDb for filepath
		fileToDb(fileId, filepath, false, function(err) {
			// generate image thumbnails
			q.push({
				'fileId': fileId,
				'filepath': filepath,
				'type': 'image'
			});
		});
	} else if (m.indexOf('video') == 0) {
		fileToDb(fileId, filepath, false, function(err) {
			// video thumbnails
			q.push({
				'fileId': fileId,
				'filepath': filepath,
				'type': 'video'
			});
		});
	} else {
		// move file to db and delete it, since we aren't processing anything
		fileToDb(fileId, filepath, true, function(err) {});
	}

}

// thumb queue
var q = async.queue(function(task, callback) {
	console.log('running q for ---------------'),
		console.log(task);
	if (task.type == 'image') {
		imageThumb(task.fileId, task.filepath, function(err) {
			callback(err);
		});
	} else if (task.type == 'video') {
		videoThumb(task.fileId, task.filepath, function(err) {
			callback(err);
		});
	}
}, 2);

// assign a callback
q.drain = function() {
	//console.log('all items have been processed');
}

// function to generate image thumbnails
function imageThumb(fileId, filepath, cb) {

	async.series([

			function(callback) {
				// get root image size, why not
				exec('identify ' + filepath + ' | cut -d" " -f 3', function(error, stdout, stderr) {
					console.log('identify ' + filepath + ' | cut -d" " -f 3');
					console.log(stdout);
					console.log(stderr);
					// callback and replace newline chars
					callback(null, stdout.replace(/\s/g, ''));
				});
			},
			function(callback) {
				// create 100px thumbnail
				var basename = path.basename(filepath);
				var dirname = path.dirname(filepath);
				var thisname = dirname + '/100px_' + basename;
				exec('convert ' + filepath + ' -resize 100x100 ' + thisname, function(error, stdout, stderr) {
					console.log('convert ' + filepath + ' -resize 100x100 ' + thisname);
					console.log(stdout);
					console.log(stderr);
					callback(null, thisname);
				});
			},
			function(callback) {
				// create 1000px thumbnail
				var basename = path.basename(filepath);
				var dirname = path.dirname(filepath);
				var thisname = dirname + '/1000px_' + basename;
				exec('convert ' + filepath + ' -resize 1000x1000 ' + thisname, function(error, stdout, stderr) {
					console.log('convert ' + filepath + ' -resize 1000x1000 ' + thisname);
					console.log(stdout);
					console.log(stderr);
					callback(null, thisname);
				});
			},

		],
		function(err, results) {

			if (!err) {
				// this means image processing was done, add the thumbs to the filebin entry
				var u = {};
				u.imagesize = results[0];

				u.thumbs = [];

				// 100 px
				var ofid = new mongodb.ObjectID();
				u.thumbs[0] = {
					imagesize: '100x100',
					fileId: ofid
				};
				fileToDb(ofid, results[1], true, function(err) {});

				// 1000 px
				var sfid = new mongodb.ObjectID();
				u.thumbs[1] = {
					imagesize: '1000x1000',
					fileId: sfid
				};
				fileToDb(sfid, results[2], true, function(err) {});

				// update db with size and thumbnails
				db.collection('filebin', function(err, collection) {
					collection.update({
						'fileId': fileId
					}, {
						'$set': u
					}, {
						'safe': true
					}, function(err, docs) {
						// all done, safe to callback
						cb(err);
					});
				});

			} else {
				cb(err);
			}

			// delete the source filepath no matter what
			fs.unlink(filepath, function(err) {});

		});

}

// function to generate video thumbnails
function videoThumb(fileId, filepath, cb) {

	async.series([

			function(callback) {
				// create 100 px thumbnail
				var basename = path.basename(filepath);
				var dirname = path.dirname(filepath);
				var thisname = dirname + '/100px_' + basename + '.png';
				exec('ffmpeg -itsoffset -4 -i ' + filepath + ' -vcodec png -vframes 1 -an -f rawvideo -vf scale=100:-1 -y ' + thisname, function(error, stdout, stderr) {
					console.log('ffmpeg -itsoffset -4 -i ' + filepath + ' -vcodec png -vframes 1 -an -f rawvideo -vf scale=100:-1 -y ' + thisname);
					console.log(stdout);
					console.log(stderr);
					callback(null, thisname);
				});
			},

			function(callback) {
				// overlay play button
				var basename = path.basename(filepath);
				var dirname = path.dirname(filepath);
				exec('composite -gravity center ./lib/overlay.png ' + dirname + '/100px_' + basename + '.png ' + dirname + '/100px_' + basename + '.png', function(error, stdout, stderr) {
					console.log('composite -gravity center ./lib/overlay.png ' + dirname + '/100px_' + basename + '.png ' + dirname + '/100px_' + basename + '.png');
					console.log(stdout);
					console.log(stderr);
					callback(null, filepath);
				});
			},

			function(callback) {
				// create webm file
				var basename = path.basename(filepath);
				var dirname = path.dirname(filepath);
				var thisname = dirname + '/' + basename + '.webm';
				exec('ffmpeg -i ' + filepath + ' -cpu-used 0 -b:v 1M -qmin 10 -qmax 42 -maxrate 1M -bufsize 2M ' + thisname, function(error, stdout, stderr) {
					console.log('ffmpeg -i ' + filepath + ' -cpu-used 0 -b:v 1M -qmin 10 -qmax 42 -maxrate 1M -bufsize 2M ' + thisname);
					console.log(stdout);
					console.log(stderr);
					callback(null, thisname);
				});
			},
			function(callback) {
				db.collection('filebin', function(err, collection) {
					collection.find({
						'fileId': fileId
					}).toArray(function(err, docs) {
						callback(err, docs)
					});
				});
			},

		],
		function(err, results) {

			if (!err) {
				// this means video processing was done, add the thumb to the filebin entry
				var u = {};

				// 100 px
				var ofid = new mongodb.ObjectID();
				u.videoThumb = {
					imagesize: '100x100',
					fileId: ofid
				};
				fileToDb(ofid, results[0], true, function(err) {});

				// webm video
				u.mimetype = 'video/webm';
				// change file name to show we transcoded it
				u.name = results[3][0].name + '.webm';

				var filestats = fs.statSync(results[2]);
				u.size = filestats.size;

				// overwrite original file with webm transcode
				fileToDb(fileId, results[2], true, function(err) {});

				// update db with size and thumbnails
				db.collection('filebin', function(err, collection) {
					collection.update({
						'fileId': fileId
					}, {
						'$set': u
					}, {
						'safe': true
					}, function(err, docs) {
						// safe to call cb
						cb(err);
					});
				});

			} else {
				cb(err);
			}

			// delete the source filepath no matter what
			fs.unlink(filepath, function(err) {});

		});

}

// db open START
db.open(function(err, db) {

	//console.log('db open err, db', err, db);

	if (db) {

		var options = {
			key: fs.readFileSync('./keys/privatekey.pem'),
			cert: fs.readFileSync('./keys/certificate.pem')
		};

		var fss = new static.Server('./i');

		https.createServer(options, httpsConnection).listen(config.serverPort, '0.0.0.0');
		console.log('listening on port ' + config.serverPort);

		function httpsConnection(request, response) {

			console.log('###### ' + request.connection.remoteAddress + ' ' + request.method + ' ' + request.url + " ######\n");

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

					console.log('file upload');

					// parse a file upload
					var form = new multiparty.Form();

					form.on('error', function(err) {
						response.writeHead(400, {
							'content-type': 'text/plain'
						});
						response.end("invalid request: " + err);
					});

					form.on('close', function() {});

					/*
					                    var multipartybug = [];

					                    form.on('file', function (name, file) {
					                        multipartybug.push(file);
					                        // need to move this to form.parse, once form.parse returns more than 1 file


					                    });
					*/

					form.parse(request, function(err, fields, files) {

						if (fields.username[0] == conf.username && bcrypt.compareSync(fields.password[0], conf.password)) {

							for (var i = 0; i < files.Filedata.length; i++) {
								processFile(files.Filedata[i].path, files.Filedata[i].originalFilename, function(err) {
									if (err) {
										console.log('file upload error in function processFile()');
									}
								});
							}

							// success response
							response.statusCode = 200;
							response.setHeader("Content-Type", "text/html");
							response.setHeader('Access-Control-Allow-Origin', '*');
							response.end('success');

						} else {
							response.statusCode = 401;
							response.setHeader("Content-Type", "text/html");
							response.setHeader('Access-Control-Allow-Origin', '*');
							response.end('error');
						}
					});

				} else if ((up.pathname.indexOf('/file/') == 0 || up.pathname === '/file') && request.method === 'GET') {
					/*
													GET /file - get a file
													
													REQUEST PARAMS
													fileId*
													
													RESPONSE CODES
													200 - Valid Object
														returns json document object
													500 - Error
														returns error
													*/

					if (up.pathname !== '/file') {
						// this request includes no params and the filename
						// we need to set up.query
						var s = up.path.split('/');
						up.query.fileId = s[2];
					}

					async.series([

						function(callback) {
							checkParams(up.query, ['fileId'], function(err) {
								callback(err, '');
							});
						},
						function(callback) {
							if (isValidMongoId(up.query.fileId)) {
								callback(null, '');
							} else {
								callback('invalid fileId', '');
							}
						},

						function(callback) {
							mongodb.GridStore.exist(db, new mongodb.ObjectID(up.query.fileId), function(err, exists) {
								if (exists == true) {
									// file exists, return it
									callback(null);
								} else {
									callback('file does not exist');
								}
							});
						}

					], function(err, results) {

						if (err) {
							response.writeHead(500, {
								'content-type': 'text/plain'
							});
							response.end(err);
						} else {
							// need to get file and return it here
							var gridStore = new mongodb.GridStore(db, new mongodb.ObjectID(up.query.fileId), "r");
							gridStore.open(function(err, gridStore) {

								if (request.headers.range) {

									// this is a partial request

									var start = 0;
									var end = 0;
									var range = request.headers.range;
									if (range != null) {
										start = parseInt(range.slice(range.indexOf('bytes=') + 6,
											range.indexOf('-')));
										end = parseInt(range.slice(range.indexOf('-') + 1,
											range.length));
									}
									if (isNaN(end) || end == 0) end = gridStore.length - 1;

									if (start > end) return;

									sys.puts('Browser requested bytes from ' + start + ' to ' +
										end + ' of file ' + up.query.fileId);

									response.writeHead(206, { // NOTE: a partial http response
										'Connection': 'close',
										'Content-Length': end - start,
										'Content-Range': 'bytes ' + start + '-' + end + '/' + gridStore.length,
										'Content-Type': gridStore.contentType,
										'Accept-Ranges': 'bytes',
										'Server': 'mindmap',
										'Transfer-Encoding': 'chunked'
									});

									var length = end - start;

									gridStore.seek(start, function() {
										gridStore.read(length, function(err, data) {

											response.end(new Buffer(data, 'binary'));

										});
									});

								} else {

									// this is a non partial request
									var stream = gridStore.stream(true);

									//response.setHeader("Content-Type", gridStore.contentType);
									//response.setHeader("Content-Length", gridStore.length);
									//response.setHeader("Cache-Control", 'public, max-age=86400');

									response.writeHead(200, {
										"Content-Type": gridStore.contentType,
										"Content-Length": gridStore.length,
										"Cache-Control": 'public, max-age=86400',
										'Accept-Ranges': 'bytes'
									});

									//stream.pipe(response);

									stream.on('data', function(data) {
										var flushed = response.write(data);
										// Pause the read stream when the write stream gets saturated
										if (!flushed) {
											stream.pause();
										}
									});

									response.on('drain', function() {
										// Resume the read stream when the write stream gets hungry 
										stream.resume();
									});

									stream.on('end', function() {
										response.end();
									});

									stream.on('error', function(err) {
										console.error('Exception', err);
										response.end();
									});

								}

							});
						}
					});

				} else if (up.pathname.indexOf('/api') == 0) {

					// this is an API request
					request.url = request.url.substring(4);
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
						});
					});

				} else {
					request.addListener('end', function() {
						fss.serve(request, response);
					}).resume();
				}

			}

		}

		// local memory update loop
		function ml() {

		}
		ml();

		// run it every minute
		setInterval(ml, 60000);

		// startup

		// indexes
		console.log('generating indexes');

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
		db.ensureIndex('v', 'connections', {
			'unique': false
		}, function(err, name) {
			if (err) {
				console.log(err)
			}
		});

		// filebin
		db.ensureIndex('filebin', 'event', {
			'unique': false
		}, function(err, name) {
			if (err) {
				console.log(err)
			}
		});
		db.ensureIndex('filebin', 'fileId', {
			'unique': false
		}, function(err, name) {
			if (err) {
				console.log(err)
			}
		});
		console.log('indexes generated');

		// boot time volume connections/relations

		function getVolumesPerEvent(volume, cb) {

			var vpt = {};

			// for every volume, get all it's events
			db.collection('e', function(err, collection) {
				collection.find({
					'volumes': volume
				}).toArray(function(err, docs1) {
					vpt[volume] = {};
					for (var ii = 0; ii < docs1.length; ii++) {
						// loop for each volume in event
						if (docs1[ii].volumes) {
							for (var iii = 0; iii < docs1[ii].volumes.length; iii++) {
								// dont count yourself
								if (docs1[ii].volumes[iii] != volume) {
									if (vpt[volume][docs1[ii].volumes[iii]] > 0) {
										vpt[volume][docs1[ii].volumes[iii]]++;
									} else {
										vpt[volume][docs1[ii].volumes[iii]] = 1;
									}
								}
							}
						}
					}
					cb(err, vpt);
				});
			});

		}

		async.waterfall([

			function(callback) {

				db.collection('v', function(err, collection) {
					collection.find({}).toArray(function(err, docs) {
						callback(null, docs);
					});
				});

			},
			function(volumes, callback) {
				var v = [];
				for (var i = 0; i < volumes.length; i++) {
					v.push(volumes[i].name);
				}
				async.map(v, getVolumesPerEvent, function(err, results) {
					callback(null, results);
				});
			}
		], function(err, result) {

			// put connections back in for each volume
			for (var i = 0; i < result.length; i++) {

				//console.log(Object.keys(result[i])[0]);
				//console.log(result[i]);

				db.collection('v', function(err, collection) {

					collection.update({
						'name': Object.keys(result[i])[0]
					}, {
						'$set': {
							'connections': result[i][Object.keys(result[i])[0]]
						}
					}, {
						'safe': true
					}, function(err, docs) {});

				});
			}

		});

		// get config settings from db
		db.collection('c', function(err, collection) {
			collection.find({}).toArray(function(err, docs) {
				if (docs.length > 0) {
					// this database has settings
					conf.username = docs[0].username;
					conf.password = bcrypt.hashSync(docs[0].password, 8);
				} else {
					// this database has default settings
					conf.username = 'username';
					conf.password = bcrypt.hashSync('password', 8);
				}
			});
		});

	} else {
		console.log('db error');
		console.log(err);
	}
});
