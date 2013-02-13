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

    // set background-color to white
    $('body').css({
        'background-color': '#fff'
    });
    // hide #preAuthDisplay and show #postAuthDisplay
    $('#preAuthDisplay').hide('slow');
    $('#postAuthDisplay').show('slow');

    // show default view
    $('#objectsImportant').click();

    // start loopData and timer every 5 minutes
    loopData();
    setInterval(loopData, 300000);

}

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

// logout
function logOut() {

    // destroy cookies
    $.removeCookie('username');
    $.removeCookie('password');

    // set background-color to white
    $('body').css({
        'background-color': '#f5f5f5'
    });
    // hide #postAuthDisplay and show #preAuthDisplay
    $('#postAuthDisplay').hide('slow');
    $('#preAuthDisplay').show('slow');

}

$('#newObject').on("click", function (event) {
    event.preventDefault();
    showView('newObjectView');
});

$('#newObjectViewSubmit').on("click", function (event) {
    event.preventDefault();

    var dp = false;

    if ($('#newObjectViewDefaultProcess').is(':checked')) {
        dp = true;
    }

    apiCall('/object', 'POST', {
        'name': $('#newObjectViewName').val(),
        'data': $('#newObjectViewData').val()
    }, function (err, data) {

        if (err) {
            alert(err.error);
        } else {
            alert('Object: ' + $('#newObjectViewName').val() + ' created');
            $('#newObjectViewName').val('');
            $('#newObjectViewData').val('');
        }

    });

});

$('#objectsImportant').on("click", function (event) {
    event.preventDefault();
    objectsListView('importance');
});

$('#objectsNewest').on("click", function (event) {
    event.preventDefault();
    objectsListView('created');
});

$('#objectsUpdated').on("click", function (event) {
    event.preventDefault();
    objectsListView('lastEdit');
});

$('#objectsMostUpdated').on("click", function (event) {
    event.preventDefault();
    objectsListView('numEdits');
});

$('#objectsViewed').on("click", function (event) {
    event.preventDefault();
    objectsListView('lastView');
});

$('#objectsMostViewed').on("click", function (event) {
    event.preventDefault();
    objectsListView('numViews');
});

function objectsListView(sort, reverseOrder) {

    apiCall('/objectsList', 'GET', {'sort':sort,'reverseOrder':reverseOrder}, function (err, data) {

        if (err) {
            alert(err.error);
        } else {

            var h = '<div class="row-fluid"><p style="font-size: .8em; color: #333;">by '+sort+'</p>';
            // loop for overview
            for (var i=0; i<data.objects.length; i++) {

                if (i%6==0) {
                    h += '</div><div class="row-fluid">';
                }

                h += '<div onClick="objectView(\''+data.objects[i]._id+'\'); return false;" id="object'+data.objects[i]._id+'" class="span2" style="height:200px;overflow:hidden;';

                h += '">';
                h += '<p style="font-weight: bold; border-bottom: 1px solid #333;">'+data.objects[i].name+'</p>';

                h += '<p id="objectData'+data.objects[i]._id+'" style="font-size: .8em; color: #666;"></p>';

/*
                h += '<div class="pull-right" style="font-size: .8em; color: #666;">';
                h += data.objects[i].numViews+' (views) - '+data.objects[i].numEdits+' (edits) - '+data.objects[i].importance+' (importance) ';
                h += '<span class="epochago">'+data.objects[i].created+'</span> (created) - <span class="epochago">'+data.objects[i].lastEdit+'</span> (last edit) - <span class="epochago">'+data.objects[i].lastView+'</span> (last view)';
                h += '</div>';
*/

                h += '</div>';

            }

            h += '</div>';

            $('#objectsListView').html(h);
            showView('objectsListView');

            // loop for data
            for (var i=0; i<data.objects.length; i++) {

                // get data
                objectData(data.objects[i]._id, false, true, function(id, data) {
                    $('#objectData'+id).html(data);
                });

            }

        }

    });

}

function objectView(id) {

    apiCall('/objectsList', 'GET', {'id':id}, function (err, data) {

        if (err) {
            alert(err.error);
        } else {

            addCrumb(data.objects[0].name, data.objects[0]._id);

            $('#objectViewName').html(data.objects[0].name);
            $('#objectViewViews').html(data.objects[0].numViews);
            $('#objectViewEdits').html(data.objects[0].numEdits);
            $('#objectViewImportance').html(data.objects[0].importance);
            $('#objectViewCreated').html(data.objects[0].created);
            $('#objectViewLastEdit').html(data.objects[0].lastEdit);
            $('#objectViewLastView').html(data.objects[0].lastView);
            $('#objectViewSubmit').html('<button onClick="updateObject(\''+data.objects[0]._id+'\'); return false;" class="btn btn-large btn-primary" type="submit">Save Changes</button>');

            var t = '<ul class="nav nav-tabs">';

            // process by default would be set here
            t += '<li id="objectViewDataTab" class="active"><a onClick="switchRPD(\''+data.objects[0]._id+'\'); return false;" href="#">Edit</a></li>';
            t += '<li id="objectViewProcessedDataTab" class=""><a onClick="switchRPD(\''+data.objects[0]._id+'\'); return false;" href="#">View</a></li>';

            t += '</ul>';

            $('#objectViewTabs').html(t);
            $('#objectViewData').html('');

            // get data
            switchRPD(data.objects[0]._id);

            showView('objectView');

        }

    });

}

function switchRPD(id) {

    if ($('#objectViewDataTab').hasClass('active')) {

        // switch to processed
        $('#objectViewProcessedDataTab').addClass('active');
        $('#objectViewProcessedData').show();

        $('#objectViewDataTab').removeClass('active');
        $('#objectViewData').hide();
        $('#objectViewSubmit').hide();

        objectData(id, true, false, function(id, data) {
            $('#objectViewProcessedData').html(data);
        });

    } else {

        // switch to raw
        $('#objectViewDataTab').addClass('active');
        $('#objectViewData').show();
        $('#objectViewSubmit').show();

        $('#objectViewProcessedDataTab').removeClass('active');
        $('#objectViewProcessedData').hide();

        objectData(id, false, false, function(id, data) {
            $('#objectViewData').val(data);
        });

    }

}

function updateObject(id) {
    apiCall('/object','PUT',{'id':id,'name':$('#objectViewName').html(),'data':$('#objectViewData').val()}, function (err, data) {
        if (err) {
            alert(err.error);
        } else {
            alert('object updated');
            objectView(id);
        }
    });
}

var objectData = function(id, processed, blurb, cb) {
    apiCall('/objectData', 'GET', {'id':id,'blurb':blurb,'processed':processed}, function (err, data) {
        cb(id,data.objectData);
    });
}

function showView(viewName) {
    var views = ['newObjectView','objectsListView','objectView'];
    for (var i = 0; i < views.length; i++) {
        $('#' + views[i]).hide();
    }
    if (viewName == 'objectView') {
        $('#objectViewRel').show();
    } else if (viewName != 'objectView') {
        $('#objectViewRel').hide();
    }
    if (viewName != null) {
        $('#' + viewName).show();
    }
    setTimeout($('.epochago').epochago(), 1000);
}

var crumbs = [];
function addCrumb(name, id) {

    if (crumbs.length == 0 || crumbs[crumbs.length-1].id != id) {
        // this isn't the same as the last crumb, so add it

        crumbs.push({name:name,id:id});

        if (crumbs.length>10) {
            crumbs.splice(0,1);
        }

        var h = 'object history: ';

        for (var i=0; i<crumbs.length; i++) {
            h += '<li><a onClick="objectView(\''+crumbs[i].id+'\'); return false;" href="#">'+crumbs[i].name+'</a>';
            if (i<crumbs.length-1) {
                h += '<span class="divider"><i class="icon-arrow-right"></i></span>';
            }
            h += '</li>';
        }

        $('#objectCrumbs').html(h);
        $('#objectCrumbs').show();

    }

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
            $('#loginErr').html(err.error);
        }
    });
}
