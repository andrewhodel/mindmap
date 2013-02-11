// helper function for all API calls
function apiCall(endpoint, requestType, requestData, callback) {

    requestData.username = $('#loginUsername').val();
    requestData.password = $('#loginPassword').val();

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
        'processType': $('#newObjectViewProcessType').val(),
        'defaultProcess': dp,
        'data': $('#newObjectViewData').val()
    }, function (err, data) {

        if (err) {
            alert(err.error);
        } else {
            alert('Object: ' + $('#newObjectViewName').val() + ' created');
            $('#newObjectViewName').val('');
            $('#newObjectViewProcessType').val('');
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

            var h = '';
            // loop for overview
            for (var i=0; i<data.objects.length; i++) {
                h += '<div id="object'+data.objects[i]._id+'" class="clearfix" style="background-color: rgb(245,245,245); border-radius: 4px; border: 1px solid #d3d3d3; padding: 8px; margin-bottom: 20px;">';
                h += '<div style="margin: 8px;">';
                h += '<div class="pull-left" style="font-size: 2em; font-weight: bold;">'+data.objects[i].name+'</div>';
                h += '<div class="pull-right" style="font-size: .8em; color: #666;">'+data.objects[i].numViews+' (views) - '+data.objects[i].numEdits+' (edits) - '+data.objects[i].importance+' (importance)</div>';
                h += '<br class="clearfix" />';
                h += '<hr style="margin: 2px;" />';
                if (data.objects[i].processType) {
                    h += '<div class="pull-left" style="font-size: .8em; color: #666;">'+data.objects[i].processType+' (process type) - '+data.objects[i].defaultProcess+' (always process)</div>';
                }
                h += '<div class="pull-right" style="font-size: .8em; color: #666;"><span class="epochago">'+data.objects[i].created+'</span> (created) - <span class="epochago">'+data.objects[i].lastEdit+'</span> (last edited) - <span class="epochago">'+data.objects[i].lastView+'</span> (last viewed)</div>';
                h += '<br class="clearfix" />';
                h += '<div class="well well-small" id="objectData'+data.objects[i]._id+'" style="background-color: #fff; margin-left: 10px; white-space: pre-line;">';
                h += '</div>';
                h += '<hr style="margin: 2px;" />';
                h += '<div class="" style="font-size: .8em;"><a href=#">Related:</a></div>';
                h += '</div>';
                h += '</div>';
            }

            $('#objectsListViewObjects').html(h);
            showView('objectsListView');

            // loop for data
            for (var i=0; i<data.objects.length; i++) {
                // show data
                objectDataBlurb(data.objects[i]._id);
            }

        }

    });

}

function objectDataBlurb(id) {
    apiCall('/objectData', 'GET', {'id':id,'blurb':true}, function (err, data) {
        $('#objectData'+id).html(data.objectData);
    });
}

function showView(viewName) {
    var views = ['newObjectView','objectsListView'];
    for (var i = 0; i < views.length; i++) {
        $('#' + views[i]).hide();
    }
    if (viewName != null) {
        $('#' + viewName).show('fast');
    }
    setTimeout($('.epochago').epochago(), 1000);
}

// login if cookie exists
if ($.cookie('username') && $.cookie('password')) {
    $('#loginUsername').val($.cookie('username'));
    $('#loginPassword').val($.cookie('password'));
    apiCall('/auth', 'GET', {}, function (err, data) {
        if (!err) {
            doLogin();
        } else {
            $('#loginErr').html(err.error);
        }
    });
}

// show default view
$('#objectsImportant').click();
