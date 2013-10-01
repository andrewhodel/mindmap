// helper function for all API calls

function apiCall(endpoint, requestType, requestData, callback) {

    if ($.cookie('username') && $.cookie('password')) {
        requestData.username = $.cookie('username');
        requestData.password = $.cookie('password');
    } else {
        requestData.username = $('#loginUsername').val();
        requestData.password = $('#loginPassword').val();
    }

    var request = $.ajax({
        url: "http://192.168.1.12:8000" + endpoint,
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
    showEvents(),

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

// setup upload

/*
    var input = document.getElementById("files"), 
        formdata = false;

    if (window.FormData) {
        formdata = new FormData();
        document.getElementById("btn").style.display = "none";
    }
    
    input.addEventListener("change", function (evt) {
        document.getElementById("response").innerHTML = "Uploading . . ."
        var i = 0, len = this.files.length, img, reader, file;

        //formdata.append('username', $.cookie('username'));
        //formdata.append('password', $.cookie('password'));

        for ( ; i < len; i++ ) {
            file = this.files[i];

            if (formdata) {
                formdata.append("files[]", file);
            }
        }

        if (formdata) {
            $.ajax({
                url: serverApi+'/upload',
                type: "POST",
                data: formdata,
                processData: false,
                contentType: false,
                success: function (res) {
                    alert(res);
                }
            });
        }
    }, false);
*/

function showEvents(volume) {

    // clear existing
    $("#mainWindow").html('');

    apiCall('/events', 'GET', {
        'sort': 'created',
	'volumes': volume
    }, function (err, data) {
        console.log(data.events);
        for (var i = 0; i < data.events.length; i++) {

            $("#mainWindow").append(eventObj(data.events[i]));

            // bind once
            $('#eventItem' + data.events[i]._id).one('inview', function (event, isInView, visiblePartX, visiblePartY) {
                if (isInView) {
                    // element is now visible in the viewport
                    var tid = this.id.slice(9);
                    console.log(tid);

                    eventData(tid, true, function (data) {
				$('#eventText' + tid).html(data.eventData.d);
			});

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
            });

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
            console.log(data);
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
            console.log(data);
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
    
    var created = new Date(obj.created*1000);
    var lastEdit = new Date(obj.lastEdit*1000);
 
    var months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    
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
    h += '<button style="margin-left: 6px; float: right;" class="btn" type="button" onClick="saveEdit(\'' + obj._id + '\');">Save</button> ';
    h += '<button style="margin-left: 6px; float: right;" class="btn" type="button" onClick="cancelEdit(\'' + obj._id + '\');">Cancel</button>';
    h += '<br class="clearfix" style="margin-bottom: 10px;" /></div>';

    h += '<div class="eventVolumes">';
    if (obj.volumes != undefined) {
        for (var i = 0; i < obj.volumes.length; i++) {
            //h += '<span class="pull-left" href="#" onClick="delVolume(\'' + obj._id + '\',\'' + obj.volumes[i] + '\');">' + obj.volumes[i] + '</span>';
            h += '<div><a href="#" onClick="showEvents(\'' + obj.volumes[i] + '\')">' + obj.volumes[i] + '</a> <a href="#" style="font-size: .8em;" onClick="delVolume(\'' + obj._id + '\',\'' + obj.volumes[i] + '\');"> (X)</a></div>';
        }
    }
    h += '</div>';
    
    h += '<button style="margin-left: 6px; float: right;" class="btn btn-danger" type="button" onClick="deleteEvent(\'' + obj._id + '\');">delete</button>';
    h += '<button style="margin-left: 6px; float: right;" class="btn" type="button" onClick="editEvent(\'' + obj._id + '\');">edit</button>';
    h += '<div class="input-append eventAddVolume clearfix">';
    h += '<input placeholder="add volume" class="span2" id="addVolumeText' + obj._id + '" type="text">';
    h += '<button class="btn" type="button" onClick="addVolume(\'' + obj._id + '\');">+</button>';
    h += '</div>';
    h += '<br class="clearfix" style="margin-bottom: 10px;" /></div>';

    return h;

}

// CLICK HANDLERS

$('#mindmapIcon').on("click", function (event) {
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

$('#allVolumes').on("click", function (event) {
    event.preventDefault();
    $("#mainWindow").html('');

    apiCall('/volumes', 'GET', {
    }, function (err, data) {
        console.log(data);
	shuffleArray(data.volumes);
        for (var i = 0; i < data.volumes.length; i++) {
		console.log(data.volumes[i]);
		$("#mainWindow").append('<a href="#" rel="'+data.volumes[i].count+'" onClick="showEvents(\''+data.volumes[i].name+'\');">'+data.volumes[i].name+'</a> ');
        }
	$.fn.tagcloud.defaults = {
  size: {start: 18, end: 46, unit: 'pt'},
  color: {start: '#cde', end: '#f52'}
};
	$("#mainWindow a").tagcloud();
    });

});

function shuffleArray(array) {
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
}

$('#newEventLink').on("click", function (event) {
    event.preventDefault();
    var h = '<form>';
    h += '<fieldset>';
    h += '<legend>New Event</legend>';
    h += '<input id="newEventName" type="text" placeholder="Event Name">';
    h += '<span class="help-block">Event data.</span>';
    h += '<textarea id="newEventData" style="width: 95%; height: 500px;"></textarea>';
    h += '<button type="submit" class="btn" id="newEventSubmit">Submit</button>';
    h += '</fieldset>';
    h += '</form>';
    $("#mainWindow").html(h);

});

$('#newEventSubmit').on("click", function (event) {
    event.preventDefault();

    apiCall('/event', 'POST', {
        'title': $('#newEventName').val(),
        'd': $('#newEventData').val()
    }, function (err, data) {

        if (err) {
            alert(err.error);
        } else {
            console.log('Object: ' + $('#newEventName').val() + ' created');
            $('#newEventName').val('');
            $('#newEventData').val('');
        }
        showEvents();

    });

});

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
        } else {
        }

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
