// helper function for all API calls
var serverApi = 'http://192.168.1.12:8000';

function apiCall(endpoint, requestType, requestData, callback) {

    if ($.cookie('username') && $.cookie('password')) {
        requestData.username = $.cookie('username');
        requestData.password = $.cookie('password');
    } else {
        requestData.username = $('#loginUsername').val();
        requestData.password = $('#loginPassword').val();
    }

    var request = $.ajax({
        url: serverApi + endpoint,
        type: requestType,
        data: requestData,
        dataType: "json",
        success: function (data) {
            callback(false, data);
        }
    });
    request.fail(function (jqXHR, textStatus, errorThrown) {
        var s = String(jqXHR.responseText);
        try {
            jQuery.parseJSON(s);
            var j = jQuery.parseJSON(s);
            callback({
                'error': j.error
            });
        } catch (e) {
            callback({
                'error': errorThrown
            });
        }
    });

}

// function updates content on a loop

function loopData() {

}

function doLogin() {

    // hide #login
    $('#loginHolder').hide('slow');
    $('#mainNav').show('slow');

    // show events
    showVolumes(),

    // start loopData and timer every 5 minutes
    loopData();
    setInterval(loopData, 300000);

}

// logout

function logOut() {

    // destroy cookies
    $.removeCookie('username');
    $.removeCookie('password');

    // show #login
    $('#loginHolder').show('slow');
    $('#mainNav').hide('slow');

}

// login if cookie exists
if ($.cookie('username') && $.cookie('password')) {
    apiCall('/auth', 'GET', {}, function (err, data) {
        if (!err) {
            doLogin();
        } else {
            // remove cookies
            $.removeCookie('username');
            $.removeCookie('password');
            $('#loginErr').show('fast');
            $('#loginErr').html(err.error);
        }
    });
}

function showEvents(volume, sort) {
    if (typeof (volume) === 'undefined') volume = null;
    if (typeof (sort) === 'undefined') sort = 'created';

    var myv = 'all events';
    var mys = {
        'sort': sort
    };
    if (volume != null) {
        myv = volume;
        mys.volumes = volume;
    }

    var sorts = [];
    sorts.push({
        call: 'created',
        title: 'DATE CREATED'
    });
    sorts.push({
        call: 'lastEdit',
        title: 'DATE OF LAST EDIT'
    });
    sorts.push({
        call: 'numEdits',
        title: 'EDIT COUNT'
    });

    var myh = '<div id="eventsListHeader">';
    myh += '<div id="elhLeft">' + myv + ' <span id="elhTotal"></span></div>';
    myh += '<div id="elhRight">ORDER EVENTS BY: ';

    for (var i = 0; i < sorts.length; i++) {
        var newShowCall = 'showEvents(\'' + volume + '\',\'' + sorts[i].call + '\');';
        if (volume == null) {
        	newShowCall = 'showEvents(null,\'' + sorts[i].call + '\');';
        }
        var myt = sorts[i].title;
        if (sort == sorts[i].call) {
            myt = '<strong>' + sorts[i].title + '</strong>';
        }
        myh += '<a href="#" onClick="' + newShowCall + ' return false;">' + myt + '</a>';
    }

    myh += '</div>';
    myh += '</div>';

    $("#mainWindow").html(myh);

    apiCall('/events', 'GET', mys, function (err, data) {
    	    $("#elhTotal").html(data.events.length+' total');
        for (var i = 0; i < data.events.length; i++) {

            $("#mainWindow").append(eventObj(data.events[i]));

            // bind once
            $('#eventItem' + data.events[i]._id).one('inview', function (event, isInView, visiblePartX, visiblePartY) {
                console.log(this.d);
                if (isInView) {
                    // element is now visible in the viewport
                    var tid = this.d._id;
                    //console.log(tid);

                    eventData(tid, true, function (data) {
                        $('#eventText' + tid).html(data.eventData.d);
                    });

                    if (typeof this.d.files != 'undefined') {
                        loadFilebinFiles(tid, function (data) {
                            for (var i = 0; i < data.length; i++) {
                                $('#eventFiles' + tid).append(fileIcon(data[i]));
                            }
                        });
                    }

                    if (visiblePartY == 'top') {
                        // top part of element is visible
                    } else if (visiblePartY == 'bottom') {
                        // bottom part of element is visible
                    } else {
                        // whole part of element is visible
                    }
                } else {
                    // element has gone out of viewport
                }
            }.bind({
                d: data.events[i]
            }));

        }
    });

}

function eventData(id, html, cb) {
    // html true for html output
    // get data
    apiCall('/eventData', 'GET', {
        'id': id,
        'html': html
    }, function (err, data) {
        if (!err) {
            //console.log(data);
            //$('#eventText' + id).html(data.eventData.d);
            cb(data);
        } else {
            console.log(err);
        }
    });
}

function eventUpdate(id) {
    // get meta data

    apiCall('/events', 'GET', {
        'id': id
    }, function (err, data) {
        if (!err) {
            //console.log(data);
            $('#eventItem' + id).replaceWith(eventObj(data.events[0]));
            eventData(id, true, function (data) {
                $('#eventText' + id).html(data.eventData.d);
            });
        } else {
            console.log(err);
        }
    });

}

function eventObj(obj) {
    // return formatted object

    var h = '<div id="eventItem' + obj._id + '" class="eventItem">';

    h += '<div class="eventTimes">';
    h += 'views ' + obj.numViews + '<br /> edits ' + obj.numEdits + '';
    h += '</div>';

    var created = new Date(obj.created * 1000);
    var lastEdit = new Date(obj.lastEdit * 1000);

    var months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

    h += '<div class="eventCreatedBig">';
    h += '<div class="eventCreatedBigMonth">' + months[created.getMonth()] + '';

    h += '</div>';
    h += '<div class="eventCreatedBigYear"><strong>' + created.getDate() + ', ' + created.getFullYear() + '</strong>';

    h += '</div>';
    h += '</div>';

    h += '<div class="eventTitle">';
    h += '<div class="eventTitleName">';
    h += obj.title;
    h += '</div>';
    h += '<div class="eventTitleAccess">';
    h += '<span>created</span> ' + obj.created + ' <span>edited</span> ' + obj.lastEdit + '';
    h += '</div>';
    h += '</div>';

    h += '<div class="eventText" id="eventText' + obj._id + '">';
    h += '</div>';

    h += '<div class="eventEdit" id="eventEdit' + obj._id + '">';
    h += '<textarea style="width: 99%; height: 500px;" id="eventEditText' + obj._id + '">';
    h += '</textarea><br />';
    h += '<button style="margin-left: 6px; float: right;" class="btn" type="button" onClick="saveEdit(\'' + obj._id + '\'); return false;">Save</button> ';
    h += '<button style="margin-left: 6px; float: right;" class="btn" type="button" onClick="cancelEdit(\'' + obj._id + '\'); return false;">Cancel</button>';
    h += '<br class="clearfix" style="margin-bottom: 10px;" /></div>';

    h += '<div class="eventVolumes">';
    if (obj.volumes != undefined) {
        for (var i = 0; i < obj.volumes.length; i++) {
            h += '<div><a href="#" onClick="showEvents(\'' + obj.volumes[i] + '\'); return false;">' + obj.volumes[i] + '</a> <a href="#" style="font-size: .8em;" onClick="volumeConnections(\'' + obj.volumes[i] + '\'); return false;">(C)</a> <a href="#" style="font-size: .8em;" onClick="delVolume(\'' + obj._id + '\',\'' + obj.volumes[i] + '\'); return false;">(X)</a></div>';
        }
    }
    h += '</div>';

    h += '<button style="margin-left: 6px; float: right;" class="btn btn-danger" type="button" onClick="deleteEvent(\'' + obj._id + '\'); return false;">delete</button>';
    h += '<button style="margin-left: 6px; float: right;" class="btn" type="button" onClick="editEvent(\'' + obj._id + '\'); return false;">edit</button>';
    h += '<button style="margin-left: 6px; float: right;" class="btn" type="button" onClick="addFilesToEvent(\'' + obj._id + '\'); return false;">add files</button>';
    h += '<div class="input-append eventAddVolume clearfix">';
    h += '<input placeholder="add volume" class="span2" id="addVolumeText' + obj._id + '" type="text">';
    h += '<button class="btn" type="button" onClick="addVolume(\'' + obj._id + '\'); return false;">+</button>';
    h += '</div>';
    h += '<br class="clearfix" style="margin-bottom: 10px;" />';
    h += '<div class="eventFiles" id="eventFiles' + obj._id + '"></div>';

    h += '</div>';

    return h;

}

// CLICK HANDLERS

$('#allEventsLink').on("click", function (event) {
    event.preventDefault();
    showEvents();
});

$('#loginButton').on("click", function (event) {
    event.preventDefault();

    $('#loginErr').html('');

    apiCall('/auth', 'GET', {}, function (err, data) {

        if (!err) {

            // set username and password cookie
            $.cookie('username', $('#loginUsername').val(), {
                expires: 7
            });
            $.cookie('password', $('#loginPassword').val(), {
                expires: 7
            });
            doLogin();

        } else {
            $('#loginErr').html(err.error);
            $('#loginErr').show('fast');
        }

    });

});

$('#logoutLink').on("click", function (event) {
    event.preventDefault();

    logOut();

});

function showVolumes() {
    $("#mainWindow").html('');

    apiCall('/volumes', 'GET', {}, function (err, data) {
        //console.log(data);

        for (var i = 0; i < data.volumes.length; i++) {
                $("#mainWindow").append('<a href="#" rel="' + data.volumes[i].count + '" onClick="showEvents(\'' + data.volumes[i].name + '\'); return false;">' + data.volumes[i].name + '</a> ');
        }

    });

}

function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
}

function fileIcon(file) {
    var h = '<div class="fileIcon">';
    h += '<a target="_blank" href="' + serverApi + '/file/' + file.fileId + '/' + file.name + '">';
    if (file.thumbs != undefined) {
        // display image thumbnail
        h += '<img src="' + serverApi + '/file?fileId=' + file.thumbs[0].fileId + '" />';
    } else if (file.videoThumb != undefined) {
    	   // display video thumbnail
    	   h += '<img src="' + serverApi + '/file?fileId=' + file.videoThumb.fileId + '" />';
    } else {
        // display generic icon
        h += '<img src="img/fileicon.png" />';
    }
    h += '</a>';
    h += '<p class="filename">' + file.name + '';
    h += '<br /><a href="#" onClick="fileInfo(\'' + file.fileId + '\');">I</a> | <a href="#" onClick="removeFileFromEvent(\'' + file.fileId + '\',\'' + file.event + '\');">X</a></p>';
    h += '</div>';
    return h;
}

function fileInBin(file, eventId) {
    var h = '<div class="fileInBin">';
    if (file.thumbs != undefined) {
        // display image thumbnail
        h += '<img src="' + serverApi + '/file?fileId=' + file.thumbs[0].fileId + '" />';
    } else if (file.videoThumb != undefined) {
    	   // display video thumbnail
    	   h += '<img src="' + serverApi + '/file?fileId=' + file.videoThumb.fileId + '" />';
    } else {
        // display generic icon
        h += '<img src="img/fileicon.png" />';
    }
    if (eventId) {
     h += '<span><a href="#" onClick="moveFileToEvent(\'' + file.fileId + '\',\'' + eventId + '\');">Move to event</a></span>';
    }
    h += '<span><a href="#" onClick="deleteFile(\'' + file.fileId + '\',\'' + eventId + '\');">Delete file</a></span>';
    h += '<span><a target="_blank" href="' + serverApi + '/file?fileId=' + file.fileId + '">Open file</a></span>';
    h += '<span>' + file.name + '</span>';
    h += '</div>';
    return h;
}

function moveFileToEvent(fileId, eventId) {
    apiCall('/fileEvent', 'POST', {
        f: fileId,
        id: eventId
    }, function (err, data) {

        if (err) {
            alert(err.error);
        } else {
            console.log(data);
            $('#filebinFiles').html('');
            loadFilebinFiles(undefined, function (data) {
                for (var i = 0; i < data.length; i++) {
                    $('#filebinFiles').append(fileInBin(data[i], eventId));
                }
            });
        }

    });
}

function removeFileFromEvent(fileId, eventId) {
    apiCall('/fileEvent', 'DELETE', {
        f: fileId,
        id: eventId
    }, function (err, data) {

        if (err) {
            alert(err.error);
        } else {
            console.log(data);
            $('#eventFiles' + eventId).html('');
            loadFilebinFiles(eventId, function (data) {
                for (var i = 0; i < data.length; i++) {
                    $('#eventFiles' + eventId).append(fileIcon(data[i]));
                }
            });
        }

    });
}

function deleteFile(fileId, eventId) {
    apiCall('/file', 'DELETE', {
        fileId: fileId
    }, function (err, data) {

        if (err) {
            alert(err.error);
        } else {
            console.log(data);
            $('#filebinFiles').html('');
            loadFilebinFiles(undefined, function (data) {
                for (var i = 0; i < data.length; i++) {
                    $('#filebinFiles').append(fileInBin(data[i], eventId));
                }
            });
        }

    });
}

function loadFilebinFiles(event, cb) {
    $('#filebinFiles').html('');
    var i = {};
    if (event !== undefined) {
        i.event = event;
    }
    apiCall('/filebin', 'GET', i, function (err, data) {

        if (err) {
            alert(err.error);
        } else {
            cb(data.filebin);
        }

    });
}

var filebinToEvent = '';

function addFilesToEvent(eventId) {
	filebinToEvent = eventId;
	$('#filebinLink').click();
}

$('#filebinLink').on("click", function (event) {
    event.preventDefault();

    var h = '<div id="filebinCon"><div id="filebinFiles"></div></div><div id="filebinNav"><div id="uploadPane">';
    h += '<h3>Upload</h3>';
    h += '<p>Upload files from your computer.</p>';
    h += '<input type="file" multiple="multiple" id="uploadFiles" name="files[]" /><br /><br /><div id="uploadProgress"></div>';
    h += '</div>';
    h += '<div id="fetchPane">';
    h += '<h3>Fetch</h3>';
    h += '<p>Paste a http/ftp, youtube or torrent magnet url and press [enter].</p>';
    h += '<input type="text" id="fetchUrl" placeholder="fetch url (press enter)" /></div></div>';

    var myfilebinToEvent = '';
    if (filebinToEvent != '') {
        myfilebinToEvent = filebinToEvent;
        filebinToEvent = '';
        h += '<h2>Select files to send to ' + myfilebinToEvent + '</h2>';
    }

    h += '';
    $("#mainWindow").html(h);

    loadFilebinFiles(undefined, function (data) {
        for (var i = 0; i < data.length; i++) {
            $('#filebinFiles').append(fileInBin(data[i], myfilebinToEvent));
        }
    });

    $('#fetchUrl').keypress(function (e) {
        var p = e.which;
        if (p == 13) {
            // enter pressed, fetch file
            apiCall('/fetch', 'POST', {
                'url': $('#fetchUrl').val()
            }, function (err, data) {

                if (err) {
                    alert(err.error);
                } else {
                    // clear fetchUrl
                    $('#fetchUrl').val('');
                    loadFilebinFiles(undefined, function (data) {
                        for (var i = 0; i < data.length; i++) {
                            $('#filebinFiles').append(fileInBin(data[i], myfilebinToEvent));
                        }
                    });
                }

            });
        }
    });

    document.getElementById('uploadFiles').addEventListener('change', function (evt) {

        var files = evt.target.files; // FileList object
        var formdata = new FormData();
        formdata.append('username', $.cookie('username'));
        formdata.append('password', $.cookie('password'));
        // open xhr
        var xhr = new XMLHttpRequest();
        
        // load progress bar
            var hh = '<div class="progress progress-info">';
            hh += '<div class="bar" id="progressPercentBar" style="width: 1%;"></div>';
            hh += '</div>';
            $('#uploadProgress').html(hh);

        // progress event
        xhr.upload.addEventListener("progress", function (e) {
            if (e.lengthComputable) {
                var currentState = (e.loaded / e.total) * 100;
                $('#progressPercentBar').width(currentState+'%');
            }
        }, false);

        // error event
        xhr.upload.addEventListener("error", function (e) {
            alert('error uploading file');
        }, false);

        // loadend event
        xhr.upload.addEventListener("loadend", function (e) {
            loadFilebinFiles(undefined, function (data) {
                for (var i = 0; i < data.length; i++) {
                    $('#filebinFiles').append(fileInBin(data[i], myfilebinToEvent));
                }
            });
            $('#uploadProgress').html('');
        }, false);

        // Loop through the FileList
        for (var i = 0, f; f = files[i]; i++) {

            // add file to formdata
            formdata.append('Filedata', files[i]);

        }

        // send xhr
        xhr.open('POST', serverApi + '/upload');
        xhr.send(formdata);

    });

});

$('#newEventLink').on("click", function (event) {
    event.preventDefault();
    var h = '<form>';
    h += '<fieldset>';
    h += '<h3>New Event</h3>';
    h += '<input id="newEventName" type="text" placeholder="Event Name">';
    h += '<span class="help-block">Event data.</span>';
    h += '<textarea id="newEventData" style="width: 95%; height: 500px;"></textarea>';
    h += '<button type="submit" class="btn" onClick="newEventSubmit(); return false;">Submit</button>';
    h += '</fieldset>';
    h += '</form>';
    $("#mainWindow").html(h);

});

function newEventSubmit() {

    apiCall('/event', 'POST', {
        'title': $('#newEventName').val(),
        'd': $('#newEventData').val()
    }, function (err, data) {

        if (err) {
            alert(err.error);
        } else {
            //console.log('Object: ' + $('#newEventName').val() + ' created');
            $('#newEventName').val('');
            $('#newEventData').val('');
        }
        showEvents();

    });

}

function editEvent(id) {
    // hide eventText
    $('#eventText' + id).hide();
    $('#eventEdit' + id).show();
    eventData(id, false, function (data) {
        $('#eventEditText' + id).html(data.eventData.d);
    });
}

function cancelEdit(id) {
    $('#eventEdit' + id).hide();
    $('#eventText' + id).show();
}

function saveEdit(id) {
    $('#eventEdit' + id).hide();
    $('#eventText' + id).show();

    apiCall('/event', 'PUT', {
        'id': id,
        'd': $('#eventEditText' + id).val()
    }, function (err, data) {

        if (err) {
            alert(err.error);
        } else {

            eventData(id, true, function (data) {
                $('#eventText' + id).html(data.eventData.d);
            });
        }

    });

}

function deleteEvent(id) {
    $('#eventItem' + id).remove();

    apiCall('/event', 'DELETE', {
        'id': id
    }, function (err, data) {

        if (err) {
            alert(err.error);
        } else {}

    });

}

function addVolume(id) {

    apiCall('/eventVolume', 'POST', {
        'id': id,
        'v': $('#addVolumeText' + id).val()
    }, function (err, data) {

        if (err) {
            alert(err.error);
        } else {
            // update event
            eventUpdate(id);
        }

    });

}

function delVolume(id, v) {
    apiCall('/eventVolume', 'DELETE', {
        'id': id,
        'v': v
    }, function (err, data) {

        if (err) {
            alert(err.error);
        } else {
            // update event
            eventUpdate(id);
        }

    });

}

function volumeConnections(v) {
    apiCall('/volumes', 'GET', {
        'single': v
    }, function (err, data) {

        if (err) {
            alert(err.error);
        } else {
            var s = '';
            for (var key in data.volumes[0].connections) {
                var obj = data.volumes[0].connections[key];
                s += key + ':' + obj + ' ';
            }
            alert(s);
        }

    });

}
