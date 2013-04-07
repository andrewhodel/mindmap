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

            var h = '<div class="row-fluid"><p style="font-size: .8em;" class="label label-info">sorted by '+sort+'</p>';
            // loop for overview
            for (var i=0; i<data.objects.length; i++) {

                if (i%6==0) {
                    h += '</div><div class="row-fluid">';
                }

                h += '<div onClick="objectView(\''+data.objects[i]._id+'\'); return false;" id="object'+data.objects[i]._id+'" class="span2" style="height:200px;overflow:hidden;';

                h += '">';
                if (data.objects[i][sort]) {
                    h += '<p style="font-size: .8em;" class="label label-info">'+data.objects[i][sort]+'</p>';
                }
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
            t += '<li id="objectViewDataTab" class="active"><a onClick="switchRPD(\''+data.objects[0]._id+'\',\'d\'); return false;" href="#">Edit</a></li>';
            t += '<li id="objectViewProcessedDataTab" class=""><a onClick="switchRPD(\''+data.objects[0]._id+'\',\'p\'); return false;" href="#">View</a></li>';
            t += '<li id="objectViewFilesTab" class=""><a onClick="switchRPD(\''+data.objects[0]._id+'\',\'f\'); return false;" href="#">Files</a></li>';

            t += '</ul>';

            $('#objectViewTabs').html(t);
            $('#objectViewData').html('');

            // get data
            switchRPD(data.objects[0]._id, 'p');

            // show related
            apiCall('/objectRelations', 'GET', {'id':id}, function (erra, dataa) {
                if (erra) {
                    alert(erra.error);
                } else {
                    var r = '<li class="nav-header">RELATED OBJECTS</li>';

                    for (var i=0; i<dataa.related.length; i++) {
                        r += '<li>'+dataa.related[i].dId+'</li>';
                    }

                    r += '<li><a href="#" onClick="addRelation(\''+data.objects[0].name+'\',\''+data.objects[0]._id+'\');">Add to New Relation</a></li>';

                    $('#objectViewRelated').html(r);
                }
            });

            showView('objectView');

        }

    });

}

function switchRPD(id, tabname) {

    // tabname
    // d = Data
    // p = ProcessedData
    // f = Files

    if (tabname == 'p') {

        // show processed
        $('#objectViewProcessedDataTab').addClass('active');
        $('#objectViewProcessedData').show();

        // hide raw
        $('#objectViewDataTab').removeClass('active');
        $('#objectViewData').hide();
        $('#objectViewSubmit').hide();

        // hide files
        $('#objectViewFilesTab').removeClass('active');
        $('#objectViewFiles').hide();

        objectData(id, true, false, function(id, data) {
            $('#objectViewProcessedData').html(data);
        });

    } else if (tabname == 'd') {

        // show raw
        $('#objectViewDataTab').addClass('active');
        $('#objectViewData').show();
        $('#objectViewSubmit').show();

        // hide processed
        $('#objectViewProcessedDataTab').removeClass('active');
        $('#objectViewProcessedData').hide();

        // hide files
        $('#objectViewFilesTab').removeClass('active');
        $('#objectViewFiles').hide();

        objectData(id, false, false, function(id, data) {
            $('#objectViewData').val(data);
        });

    } else if (tabname == 'f') {

        // show files
        $('#objectViewFiles').addClass('active');
        $('#objectViewFiles').show();

        // hide processed
        $('#objectViewProcessedDataTab').removeClass('active');
        $('#objectViewProcessedData').hide();

        // hide data
        $('#objectViewDataTab').removeClass('active');
        $('#objectViewData').hide();
        $('#objectViewSubmit').hide();

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

var relationOne = [];
var relationTwo = [];
resetAddRelations();

function addRelation(name, id) {
    if (relationOne[0] == undefined) {
        // this is the first
        relationOne[0] = id;
        relationOne[1] = name;
        $('#rel1').html(name);
        addRelationWeight(1,0);
    } else {
        // this is the second
        relationTwo[0] = id;
        relationTwo[1] = name;
        $('#rel2').html(name);
        addRelationWeight(2,0);
    }
    $('#newRelation').show();
}

function addRelationWeight(ot, inc) {
    if (ot == 1) {
        if (relationOne[2]+inc > 10 || relationOne[2]+inc < 1) {
            alert('must be between 1 and 10');
        } else {
            relationOne[2] += inc;
            $('#rel1weight').html(relationOne[2]);
        }
    }
    if (ot == 2) {
        if (relationTwo[2]+inc > 10 || relationTwo[2]+inc < 1) {
            alert('must be between 1 and 10');
        } else {
            relationTwo[2] += inc;
            $('#rel2weight').html(relationTwo[2]);
        }
    }
}

function confirmAddRelations() {

    // add first object relation
    apiCall('/objectRelation','POST',{'id':relationOne[0],'importance':relationOne[2],'dId':relationTwo[0],'dImportance':relationTwo[2]}, function (err, data) {
        if (err) {
            alert(err.error);
        } else {
            resetAddRelations();
            alert('relationship added');
        }
    });

}

function resetAddRelations() {
    relationOne[0] = undefined;
    relationTwo[0] = undefined;
    relationOne[1] = undefined;
    relationTwo[1] = undefined;
    relationOne[2] = 1;
    relationTwo[2] = 1;
    $('#rel1').html('Object #1');
    $('#rel2').html('Object #2');
    $('#rel1weight').html(1);
    $('#rel2weight').html(1);
    $('#newRelation').hide();
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
