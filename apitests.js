var gId = 0;
var request = require("request");

request({
        uri: "http://127.0.0.1:8000/events?username=username&password=password&sort=created",
        method: "GET",
        timeout: 10000,
        followRedirect: true,
        maxRedirects: 10
    }, function(error, response, body) {

        console.log('####### ' + response.request.method + ': ' + response.request.uri.href);
        console.log(body);

        var request = require("request");
        request({
                uri: "http://127.0.0.1:8000/event?username=username&password=password&title=testevent&d=testeventdata",
                method: "POST",
                timeout: 10000,
                followRedirect: true,
                maxRedirects: 10
            }, function(error, response, body) {

                console.log('####### ' + response.request.method + ': ' + response.request.uri.href);
                console.log(body);
                var json = JSON.parse(body);
                gId = json.event._id;

                var request = require("request");
                request({
                        uri: "http://127.0.0.1:8000/eventData?username=username&password=password&id=" + gId,
                        method: "GET",
                        timeout: 10000,
                        followRedirect: true,
                        maxRedirects: 10
                    }, function(error, response, body) {

                        console.log('####### ' + response.request.method + ': ' + response.request.uri.href);
                        console.log(body);

                        var request = require("request");
                        request({
                                uri: "http://127.0.0.1:8000/eventVolume?username=username&password=password&id=" + gId + "&v=newvolume",
                                method: "POST",
                                timeout: 10000,
                                followRedirect: true,
                                maxRedirects: 10
                            }, function(error, response, body) {

                                console.log('####### ' + response.request.method + ': ' + response.request.uri.href);
                                console.log(body);

                                var request = require("request");
                                request({
                                        uri: "http://127.0.0.1:8000/eventVolume?username=username&password=password&id=" + gId + "&v=newvolume",
                                        method: "DELETE",
                                        timeout: 10000,
                                        followRedirect: true,
                                        maxRedirects: 10
                                    }, function(error, response, body) {

                                        console.log('####### ' + response.request.method + ': ' + response.request.uri.href);
                                        console.log(body);

                                        var request = require("request");
                                        request({
                                                uri: "http://127.0.0.1:8000/events?username=username&password=password&sort=created&volumes=all",
                                                method: "GET",
                                                timeout: 10000,
                                                followRedirect: true,
                                                maxRedirects: 10
                                            }, function(error, response, body) {

                                                console.log('####### ' + response.request.method + ': ' + response.request.uri.href);
                                                console.log(body);

                                                var request = require("request");
                                                request({
                                                        uri: "http://127.0.0.1:8000/event?username=username&password=password&id=" + gId,
                                                        method: "DELETE",
                                                        timeout: 10000,
                                                        followRedirect: true,
                                                        maxRedirects: 10
                                                    }, function(error, response, body) {

                                                        console.log('####### ' + response.request.method + ': ' + response.request.uri.href);
                                                        console.log(body);

                                                        var request = require("request");
                                                        request({
                                                                uri: "http://127.0.0.1:8000/event?username=username&password=password&id=",
                                                                method: "PUT",
                                                                timeout: 10000,
                                                                followRedirect: true,
                                                                maxRedirects: 10
                                                            }, function(error, response, body) {

                                                                console.log('####### ' + response.request.method + ': ' + response.request.uri.href);
                                                                console.log(body);

                                                            });

                                                    });

                                            });

                                    });
                            });
                    });
            });
    });
