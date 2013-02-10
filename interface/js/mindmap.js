        // helper function for all API calls
        function apiCall(endpoint, requestType, requestData, callback) {

            requestData.username = $('#loginUsername').val();
            requestData.password = $('#loginPassword').val();

            var request = $.ajax({
            url: serverApi+endpoint,
            type: requestType,
            data: requestData,
            dataType: "json",
            success: function(data) {
                callback(false, data);
            }
            });
            request.fail(function(jqXHR, textStatus, errorThrown) {
                var s = String(jqXHR.responseText);
                try {
                    jQuery.parseJSON(s);
                    var j = jQuery.parseJSON(s);
                    callback({'error':j.error});
                } catch (e) {
                    callback({'error':errorThrown});
                }
            });

        }

        // function updates content on a loop
        function loopData() {

            // update zones nav
            apiCall('/zones','GET',{}, function (err, data) {

                if (!err) {
                    if (data.success == 1) {

                        var h = '<li class="nav-header">ZONES</li>';
                        for (var i in data.zones) {
                            h += '<li><a href="#" onClick="zoneView(\''+data.zones[i]._id+'\');">'+data.zones[i].name+' ('+data.zones[i].numUp+'/'+data.zones[i].numTotal+')';

                            if (data.zones[i].numDown>0) {
                                h += ' <span style="float: right;" class="label label-important">Hosts Down</span>';
                            } else {
                                h += ' <span style="float: right;" class="label label-success">Stable</span>';
                            }

                            h += '</a></li>';
                        }
                        $('#zonesNav').html(h);

                    }
                } else {
                    alert(err.error);
                }

            });

            // update cols nav
            apiCall('/globalCollectors','GET',{}, function (err, data) {

                if (!err) {
                    if (data.success == 1) {

                        var h = '<li class="nav-header">COLLECTORS</li>';
                        for (var i in data.collectors) {
                            h += '<li><a href="#">'+data.collectors[i]+'</a></li>';
                        }
                        $('#colsNav').html(h);

                    }
                } else {
                    alert(err.error);
                }

            });

        }

        function doLogin() {

            // set background-color to white
            $('body').css({'background-color':'#fff'});
            // set logout username
            $('#logout').html($('#loginUsername').val());
            // hide #preAuthDisplay and show #postAuthDisplay
            $('#preAuthDisplay').hide('slow');
            $('#postAuthDisplay').show('slow');

            // start loopData and timer every 5 minutes
            loopData();
            setInterval(loopData, 300000);

        }

        $('#loginButton').on("click", function(event) {
            event.preventDefault();

            $('#loginErr').html('');

            apiCall('/auth','GET',{}, function (err, data) {

                if (!err) {

                    // set username and password cookie
                    $.cookie('username', $('#loginUsername').val(), {expires:7});
                    $.cookie('password', $('#loginPassword').val(), {expires:7});
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
            $('body').css({'background-color':'#f5f5f5'});
            // hide #postAuthDisplay and show #preAuthDisplay
            $('#postAuthDisplay').hide('slow');
            $('#preAuthDisplay').show('slow');
            // remove logout username
            $('#logout').html('');            

        }

        $('#newZone').on("click", function(event) {
            event.preventDefault();
            showView('newZoneView');
        });

        $('#newZoneViewButton').on("click", function(event) {
            event.preventDefault();

            apiCall('/zone','POST',{'name':$('#newZoneViewName').val(),'notes':$('#newZoneViewNotes').val()}, function (err, data) {

                if (err) {
                    alert(err.error);
                } else {
                    loopData();
                    alert('Zone: '+$('#newZoneViewName').val()+' created');
                    $('#newZoneViewName').val('');
                    $('#newZoneViewNotes').val('');
                }

            });

        });

        $('#newGroup').on("click", function(event) {
            event.preventDefault();

            // get zones for Parent Zone
            apiCall('/zones','GET',{}, function (err, data) {

                if (err) {
                    alert(err.error);
                } else {
                    $('#newGroupViewZoneId').children().remove();
                    $('#newGroupViewZoneId').append('<option value="">Select a Zone</option>');
                    for (var i in data.zones) {
                        $('#newGroupViewZoneId').append('<option value="'+data.zones[i]._id+'">'+data.zones[i].name+'</option>');
                    }
                }

            });

            showView('newGroupView');
        });

        $('#newGroupViewButton').on("click", function(event) {
            event.preventDefault();

            apiCall('/group','POST',{'name':$('#newGroupViewName').val(),'notes':$('#newGroupViewNotes').val(),'zoneId':$('#newGroupViewZoneId').val()}, function (err, data) {

                if (err) {
                    alert(err.error);
                } else {
                    alert('Group: '+$('#newGroupViewName').val()+' created');
                    $('#newGroupViewName').val('');
                    $('#newGroupViewNotes').val('');
                }

            });

        });

        $('#newHost').on("click", function(event) {
            event.preventDefault();

            // get zones for Parent Zone
            apiCall('/zones','GET',{}, function (err, data) {

                if (err) {
                    alert(err.error);
                } else {
                    $('#newHostViewZoneId').children().remove();
                    $('#newHostViewZoneId').append('<option value="">Select a Zone</option>');
                    for (var i in data.zones) {
                        $('#newHostViewZoneId').append('<option value="'+data.zones[i]._id+'">'+data.zones[i].name+'</option>');
                    }
                }

            });

            function dMap() {

                var map = new google.maps.Map(document.getElementById("newHostViewMap"), defMapOptions);
                var marker = null;

                if(navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(function(position) {
                        map.setCenter(new google.maps.LatLng(position.coords.latitude, position.coords.longitude));
                        map.setZoom(12);
                    });
                }

                google.maps.event.addListener(map, 'click', function(e) {
                    if (marker != null) {
                        marker.setMap(null);
                    }
                    $('#newHostViewLatitude').val(e.latLng.lat());
                    $('#newHostViewLongitude').val(e.latLng.lng());
                    marker = new google.maps.Marker({position:e.latLng,map:map});
                });

            }
            setTimeout(dMap, 1000);

            showView('newHostView');
        });

        $('#newHostViewZoneId').change(function() {

            // get groups for Parent Group
            apiCall('/groups','GET',{'zoneId':$('#newHostViewZoneId').val()}, function (err, data) {

                if (err) {
                    alert(err.error);
                } else {
                    $('#newHostViewGroupId').children().remove();
                    $('#newHostViewGroupId').append('<option value="">Select a Group</option>');
                    for (var i in data.groups) {
                        $('#newHostViewGroupId').append('<option value="'+data.groups[i]._id+'">'+data.groups[i].name+'</option>');
                    }
                }

            });

        });

        $('#newHostViewButton').on("click", function(event) {
            event.preventDefault();

            apiCall('/host','POST',{'login':$('#newHostViewLogin').val(),'key':$('#newHostViewKey').val(),'name':$('#newHostViewName').val(),'notes':$('#newHostViewNotes').val(),'latitude':$('#newHostViewLatitude').val(),'longitude':$('#newHostViewLongitude').val(),'wirelessMode':$('#newHostViewWirelessMode').val(),'wds':$('#newHostViewWds').val(),'channel':$('#newHostViewChannel').val(),'vlan':$('#newHostViewVlan').val(),'ssid':$('#newHostViewSsid').val(),'encryption':$('#newHostViewEncryption').val(),'encryptionKey':$('#newHostViewEncryptionKey').val(),'groupId':$('#newHostViewGroupId').val()}, function (err, data) {

                if (err) {
                    alert(err.error);
                } else {
                    loopData();
                    alert('Host: '+$('#newHostViewName').val()+' created');
                    $('#newHostViewLogin').val('');
                    $('#newHostViewName').val('');
                    $('#newHostViewNotes').val('');
                    $('#newHostViewLatitude').val('');
                    $('#newHostViewLongitude').val('');
                    $('#newHostViewChannel').val('');
                }

            });
        });

        function zoneView(zoneId) {

            $('#zoneViewMap').html('');

            apiCall('/zone','GET',{'zoneId':zoneId}, function (err, data) {

                if (err) {
                    alert(err.error);
                } else {
                    $('#zoneViewTitle').html(data.zone.name);
                    $('#zoneViewUD').html('<p><span class="label label-success">'+data.zone.numUp+' up</span> <span class="label label-important">'+data.zone.numDown+' down</span> <a href="#" onClick="deleteZone(\''+zoneId+'\');" class="label label-warning">Delete Zone</a> <a href="#" onClick="updateZone(\''+zoneId+'\');" class="label label-info">Update Zone</a></p>');
                    loopData();
                    $('#zoneViewNotes').html(data.zone.notes);
                }

            });

            apiCall('/groups','GET',{'zoneId':zoneId}, function (err, data) {

                if (err) {
                    alert(err.error);
                } else {
                    var c = 0;
                    var h = '<h2>Groups -></h2>';
                    for (var i in data.groups) {

                        if (c%3 == 0) {
                            h += '<div class="row-fluid">';
                        }

                        h += '<div class="span4">';
                        h += '<h3>'+data.groups[i].name+'</h3>';
                        h += '<p><span class="label label-success">'+data.groups[i].numUp+' up</span>';
                        if (data.groups[i].numDown > 0) {
                            h += ' <span class="label label-important">'+data.groups[i].numDown+' down</span>';
                        }
                        h += '</p>';
                        h += '<p><pre class="notesHolder">'+data.groups[i].notes+'</pre></p>';
                        h += '<p><a class="btn" href="#" onClick="groupView(\''+data.groups[i]._id+'\');">View group &raquo;</a></p>';
                        h += '</div><!--/span-->';

                        if (c%3 == 2) {
                            h += '</div><!--/row-->';
                        }

                        c++;

                    }

                    apiCall('/hostsForZone','GET',{'zoneId':zoneId}, function (err, data) {
                        if (err) {
                            alert(err.error);
                        } else {

                        function dMap() {
                            var map = new google.maps.Map(document.getElementById("zoneViewMap"), defMapOptions);
                            var LatLngList = new Array();

                            for (var i in data.hosts) {
                                if (data.hosts[i].latitude && data.hosts[i].longitude) {
                                    var mo = {position:new google.maps.LatLng(data.hosts[i].latitude, data.hosts[i].longitude),map:map,title:data.hosts[i].name};
                                    if (data.hosts[i].lastUpdate == undefined || data.hosts[i].lastUpdate < Math.round((new Date()).getTime() / 1000)-600) {
                                        mo.icon = 'http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=%E2%80%A2|B94A48';
                                    } else {
                                        mo.icon = 'http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=%E2%80%A2|468847';
                                    }
                                    var marker = new google.maps.Marker(mo);
                                    marker.html = '<h3>host: <a href="#" onClick="hostView(\''+data.hosts[i]._id+'\');">'+data.hosts[i].name+'</a></h3>';
                                    var iw = new google.maps.InfoWindow({content:'loading...'});

                                    google.maps.event.addListener(marker, 'click', function() {
                                        iw.open(map, this);
                                        iw.setContent(this.html);
                                    });
                                    LatLngList.push(new google.maps.LatLng(data.hosts[i].latitude, data.hosts[i].longitude));
                                }
                            }

                            if (LatLngList.length>0) {
                                var bounds = new google.maps.LatLngBounds();
                                for (var i = 0, LtLgLen = LatLngList.length; i < LtLgLen; i++) {
                                    bounds.extend(LatLngList[i]);
                                }
                                map.fitBounds(bounds);
                            }

                        }
                        setTimeout(dMap, 1000);

                        }
                    });

                    $('#zoneViewGroups').html(h);
                    showView('zoneView');

                }

            });

        }

        function groupView(groupId) {

            $('#groupViewMap').html('');

            apiCall('/group','GET',{'groupId':groupId}, function (err, data) {

                if (err) {
                    alert(err.error);
                } else {
                    $('#groupViewTitle').html(data.group.name);
                    $('#groupViewNotes').html(data.group.notes);
                }

            });

            apiCall('/hosts','GET',{'groupId':groupId}, function (err, data) {

                if (err) {
                    alert(err.error);
                } else {
                    data.group = {};
                    data.group.numUp = 0;
                    data.group.numDown = 0;
                    data.group.numTotal = 0;
                    var c = 0;
                    var h = '<h2>Hosts -></h2>';
                    for (var i in data.hosts) {

                        if (c%3 == 0) {
                            h += '<div class="row-fluid">';
                        }

                        h += '<div class="span4">';
                        h += '<h3>'+data.hosts[i].name+'</h3>';
                        h += '<p><pre class="notesHolder">'+data.hosts[i].notes+'</pre></p>';
                        h += '<p><span class="label label-info">Login:</span> '+data.hosts[i].login+'</p>';
                        h += '<p><span class="label label-info">Last Update:</span> <span class="epochago">'+data.hosts[i].lastUpdate+'</span></p>';

                        if (data.hosts[i].version) {
                            h += '<p><span class="label label-info">Version:</span> '+data.hosts[i].version+'</p>';
                        }

                        if (data.hosts[i].wirelessMode) {
                            h += '<p><span class="label label-info">Wireless Mode:</span> '+data.hosts[i].wirelessMode+'</p>';
                        }

                        if (data.hosts[i].channel) {
                            h += '<p><span class="label label-info">Channel:</span> '+data.hosts[i].channel+'</p>';
                        }

                        h += '<p>';
                        if (data.hosts[i].lastUpdate == undefined || data.hosts[i].lastUpdate < Math.round((new Date()).getTime() / 1000)-600) {
                            h += '<span style="float: right;" class="label label-important">Down</span>';
                            data.group.numDown += 1;
                        } else {
                            h += '<span style="float: right;" class="label label-success">Stable</span>';
                            data.group.numUp += 1;
                        }
                        data.group.numTotal += 1;
                        h += '</p>';
                        h += '<p><a class="btn" href="#" onClick="hostView(\''+data.hosts[i]._id+'\');">View host &raquo;</a></p>';
                        h += '</div><!--/span-->';

                        if (c%3 == 2) {
                            h += '</div><!--/row-->';
                        }

                        c++;

                    }

                    $('#groupViewUD').html('<p><span class="label label-success">'+data.group.numUp+' up</span> <span class="label label-important">'+data.group.numDown+' down</span> <a href="#" onClick="deleteGroup(\''+groupId+'\');" class="label label-warning">Delete Group</a> <a href="#" onClick="updateGroup(\''+groupId+'\');" class="label label-info">Update Group</a></p>');

                    function dMap() {
                        var map = new google.maps.Map(document.getElementById("groupViewMap"), defMapOptions);
                        var LatLngList = new Array();

                        for (var i in data.hosts) {
                            if (data.hosts[i].latitude && data.hosts[i].longitude) {
                                var mo = {position:new google.maps.LatLng(data.hosts[i].latitude, data.hosts[i].longitude),map:map,title:data.hosts[i].name};
                                if (data.hosts[i].lastUpdate == undefined || data.hosts[i].lastUpdate < Math.round((new Date()).getTime() / 1000)-600) {
                                    mo.icon = 'http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=%E2%80%A2|B94A48';
                                } else {
                                    mo.icon = 'http://chart.apis.google.com/chart?chst=d_map_pin_letter&chld=%E2%80%A2|468847';
                                }
                                var marker = new google.maps.Marker(mo);
                                marker.html = '<h3>host: <a href="#" onClick="hostView(\''+data.hosts[i]._id+'\');">'+data.hosts[i].name+'</a></h3>';

                                if (data.hosts[i].version) {
                                    marker.html += '<p><span class="label label-info">Version:</span> '+data.hosts[i].version+'</p>';
                                }

                                if (data.hosts[i].wirelessMode) {
                                    marker.html += '<p><span class="label label-info">Wireless Mode:</span> '+data.hosts[i].wirelessMode+'</p>';
                                }

                                if (data.hosts[i].channel) {
                                    marker.html += '<p><span class="label label-info">Channel:</span> '+data.hosts[i].channel+'</p>';
                                }
                                var iw = new google.maps.InfoWindow({content:'loading...'});

                                google.maps.event.addListener(marker, 'click', function() {
                                    iw.open(map, this);
                                    iw.setContent(this.html);
                                });
                                LatLngList.push(new google.maps.LatLng(data.hosts[i].latitude, data.hosts[i].longitude));
                            }
                        }

                        if (LatLngList.length>0) {
                            var bounds = new google.maps.LatLngBounds();
                            for (var i = 0, LtLgLen = LatLngList.length; i < LtLgLen; i++) {
                                bounds.extend(LatLngList[i]);
                            }
                            map.fitBounds(bounds);
                        }

                    }
                    setTimeout(dMap, 1000);

                    $('#groupViewHosts').html(h);
                    showView('groupView');

                }

            });

        }

        function updateZone(zoneId) {
            apiCall('/zone','PUT',{'zoneId':zoneId,'name':$('#zoneViewTitle').html(),'notes':$('#zoneViewNotes').html()}, function (err, data) {

                if (err) {
                    alert(err.error);
                } else {
                    alert('Zone Updated');
                    zoneView(zoneId);
                    loopData();
                }

            });
        }

        function deleteZone(zoneId) {
            apiCall('/zone','DELETE',{'zoneId':zoneId}, function (err, data) {

                if (err) {
                    alert(err.error);
                } else {
                    alert('Zone Deleted');
                    zoneView(zoneId);
                    loopData();
                }

            });
        }

        function updateGroup(groupId) {
            apiCall('/group','PUT',{'groupId':groupId,'name':$('#groupViewTitle').html(),'notes':$('#groupViewNotes').html()}, function (err, data) {

                if (err) {
                    alert(err.error);
                } else {
                    alert('Group Updated');
                    groupView(groupId);
                }

            });
        }

        function deleteGroup(groupId) {
            apiCall('/group','DELETE',{'groupId':groupId}, function (err, data) {

                if (err) {
                    alert(err.error);
                } else {
                    alert('Group Deleted');
                    showView(null);
                    loopData();
                }

            });
        }

        function accountsView() {

            $('#accountsViewContent').html('');

            apiCall('/admins','GET',{}, function (err, data) {

                if (err) {
                    alert(err.error);
                } else {

                    var h = '';

                    for (var i=0; i<data.admins.length; i++) {

                        h += '<div class="alert alert-info">';
                        h += '<h4 style="float: left;">' + data.admins[i].username;
                        if (data.admins[i].email) {
                            h += ' - ' + data.admins[i].email;
                        }
                        h += ' (<a href="#" onClick="deleteAdmin(\''+data.admins[i].username+'\');">X</a>)</h4>';
                        if (data.admins[i].readOnly == 1) {
                            h += '<a href="#" onClick="setAdminViewOnly(\''+data.admins[i].username+'\',0);" style="float: right;" class="label label-important">READ ONLY</a>';
                        } else {
                            h += '<a href="#" onClick="setAdminViewOnly(\''+data.admins[i].username+'\',1);" style="float: right;" class="label label-success">FULL ADMIN</a>';
                        }
                        h += '<br style="clear: both;" /></div>';

                    }

                    $('#accountsViewContent').html(h);
                    showView('accountsView');

                }

            });

        }

        function deleteAdmin(username) {
            apiCall('/admin','DELETE',{'adminUsername':username}, function (err, data) {

                if (err) {
                    alert(err.error);
                } else {
                    alert('Admin Deleted');
                    accountsView();
                }

            });
        }

        function setAdminViewOnly(username,v) {
            apiCall('/admin','PUT',{'adminUsername':username,'adminReadOnly':v}, function (err, data) {

                if (err) {
                    alert(err.error);
                } else {
                    accountsView();
                }

            });
        }

        $('#accountsViewCreateAdmin').on("click", function(event) {
            event.preventDefault();

            apiCall('/admin','POST',{'adminUsername':$('#accountsViewUsername').val(),'adminPassword':$('#accountsViewPassword').val(),'adminEmail':$('#accountsViewEmail').val(),'adminReadOnly':1}, function (err, data) {

                if (err) {
                    alert(err.error);
                } else {
                    alert('Admin: '+$('#accountsViewUsername').val()+' created');
                    $('#accountsViewUsername').val('');
                    $('#accountsViewPassword').val('');
                    $('#accountsViewEmail').val('');
                    accountsView();
                }

            });

        });

        $('#accountsViewChangeSubmit').on("click", function(event) {
            event.preventDefault();

            apiCall('/admin','PUT',{'adminUsername':$.cookie('username'),'adminPassword':$('#accountsViewChangePassword').val(),'adminEmail':$('#accountsViewChangeEmail').val()}, function (err, data) {

                if (err) {
                    alert(err.error);
                } else {
                    alert('Account Updated');
                    if ($('#accountsViewChangePassword').val() != '') {
                        logOut();
                    } else {
                        accountView();
                    }
                    $('#accountsViewChangePassword').val('');
                    $('#accountsViewChangeEmail').val('');
                }

            });

        });

        function writeLogView() {

            $('#writeLogViewContent').html('');

            apiCall('/adminLog','GET',{}, function (err, data) {

                if (err) {
                    alert(err.error);
                } else {

                    var h = '';

                    for (var i=0; i<data.adminLog.length; i++) {

                        if (data.adminLog[i].request.indexOf('DELETE') == 0) {
                            h += '<div class="alert alert-error">';
                        } else {
                            h += '<div class="alert alert-success">';
                        }
                        h += '<h4>' + data.adminLog[i].username + ' <span class="epochago">'+data.adminLog[i].ts+'</span></h4>';
                        h += '<p>' + data.adminLog[i].request + '</p>';
                        h += '</div>';

                    }

                    $('#writeLogViewContent').html(h);
                    showView('writeLogView');

                }

            });

        }

        // login if cookie exists
        if ($.cookie('username') && $.cookie('password')) {
            $('#loginUsername').val($.cookie('username'));
            $('#loginPassword').val($.cookie('password'));
            apiCall('/auth','GET',{}, function (err, data) {
                if (!err) {
                    doLogin();
                } else {
                    $('#loginErr').html(err.error);
                }
            });
        }

        function showView(viewName) {
            var views = ['newZoneView','newGroupView','newHostView','zoneView','groupView','accountsView','writeLogView'];
            for (var i=0; i<views.length; i++) {
                $('#'+views[i]).hide();
            }
            if (viewName != null) {
                $('#'+viewName).show('fast');
            }
            setTimeout($('.epochago').epochago(),1000);
        }
