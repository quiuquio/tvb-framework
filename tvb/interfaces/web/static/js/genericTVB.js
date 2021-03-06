/**
 * TheVirtualBrain-Framework Package. This package holds all Data Management, and 
 * Web-UI helpful to run brain-simulations. To use it, you also need do download
 * TheVirtualBrain-Scientific Package (for simulators). See content of the
 * documentation-folder for more details. See also http://www.thevirtualbrain.org
 *
 * (c) 2012-2013, Baycrest Centre for Geriatric Care ("Baycrest")
 *
 * This program is free software; you can redistribute it and/or modify it under 
 * the terms of the GNU General Public License version 2 as published by the Free
 * Software Foundation. This program is distributed in the hope that it will be
 * useful, but WITHOUT ANY WARRANTY; without even the implied warranty of 
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
 * License for more details. You should have received a copy of the GNU General 
 * Public License along with this program; if not, you can download it here
 * http://www.gnu.org/licenses/old-licenses/gpl-2.0
 *
 **/

// ---------------------------------------------------------
//              GENERIC FUNCTIONS
// ---------------------------------------------------------

function displayMessage(msg, className) {
    // Change the content and style class for Message DIV.
    var messagesDiv = $("#messageDiv");
    messagesDiv.empty();
    messagesDiv.append(msg);

    var messageDivParent = document.getElementById("messageDivParent");	
    if (messageDivParent) {
        if (className == 'errorMessage'){
            className = 'msg-sticky msg-level-fatal';
            console.warn(msg);
        } else if (className =='warningMessage') {
            className = 'msg-transient transient-medium msg-level-warn';
            console.warn(msg);
        } else if (className =='importantMessage') {
            className = 'msg-transient transient-medium msg-level-confirm';
            console.info(msg);
        } else {
            className = 'msg-transient msg-level-info';
            console.info(msg);
        }
        messageDivParent.className = className;
        $(messageDivParent.parentNode).html($(messageDivParent.parentNode).html());

    } else {
        //  We are on the base_user template
        messageDivParent = $("#generic-message");
        messageDivParent.removeClass('no-message');
        messageDivParent[0].className = 'generic-message ' + className;
    }
}

function checkForIE() {
    var browserName=navigator.appName;

    if (browserName=="Microsoft Internet Explorer") {
        var msg = "Internet Explorer is not supported. Please use Google Chrome, Mozilla Firefox or Apple Safari.";
        displayMessage(msg, 'errorMessage');
    }
}

function get_URL_param(param) {
   var search = window.location.search.substring(1);
   var compareKeyValuePair = function(pair) {
      var key_value = pair.split('=');
      var decodedKey = decodeURIComponent(key_value[0]);
      var decodedValue = decodeURIComponent(key_value[1]);
      if(decodedKey == param) return decodedValue;
      return null;
   };

   var comparisonResult = null;

   if(search.indexOf('&') > -1) {
      var params = search.split('&');
      for(var i = 0; i < params.length; i++) {
         comparisonResult = compareKeyValuePair(params[i]);
         if(comparisonResult !== null) {
            break;
         }
      }
   } else {
      comparisonResult = compareKeyValuePair(search);
   }

   return comparisonResult;
}

/**
 * Function for pagination: Change hidden current_page and submit.
 * @param page Page number to get to
 * @param formId Form to submit
 */
function changeDisplayPage(page, formId) {
    document.getElementById("currentPage").value = page;
    document.getElementById(formId).submit();
}


//              TAB Accessibility FUNCTIONS
// This was a work-around for FF compatibility.
var pressedKey = 0;

function setUpKeyWatch(){
    $(document.documentElement).keydown(function (event) {
      pressedKey = event.keyCode;
      return true;
    });
}

function redirectToHrefChild(redirectPage) {
   if (pressedKey == 13) {
        var children = redirectPage.children;
        for (var i=0; i < children.length; i++) {
                if (children[i].tagName == "A") {
                    window.location = children[i].href;
                    children[i].onclick();
                    break;
                }
            }
       }
 }

function fireOnClick(redirectElem) {
    if (pressedKey == 13) {
        redirectElem.onclick();
    }
}


// ---------- Function on the top left call-out
function updateCallOutProject() {
    doAjaxCall({
        async : false,
        type: 'GET',
        url: "/project/generate_call_out_control/",
        success: function(r) {
             $("#control_top_left").html(r);
        }
    });
}


// ---------- Function on right call-out
function includeAdapterInterface(divId, projectId, algorithmId, back_page) {
    // Populate in divId, the interface of the adapter, specified by algorihmId.
    // The interface will be automatically populated with dataTypes from projectId     
    var get_url = "/flow/getadapterinterface/"+ projectId+ "/" + algorithmId + '/' +back_page;
    doAjaxCall({
        async : false,
        type: 'GET',
        url: get_url,
        success: function(r) { $("#"+ divId).html(r); }
    });
}


/*
 * For a given input DIV id, gather all the inputs and selects entry
 * in a {name : value} dictionary.
 */
function getSubmitableData(inputDivId, allowDisabled) {

    var inputs = $("#" + inputDivId + " input");
    var submitableData = {};
    for (var ii = 0; ii < inputs.length; ii++) {
        var thisInput = inputs[ii];
        if (!allowDisabled && thisInput.disabled) {
            continue;
        }
        if (thisInput.type != 'button') {
            if (thisInput.type == 'checkbox') {
                submitableData[thisInput.name] = thisInput.checked;
            } else if (thisInput.type == 'radio') {
                if (thisInput.checked) {
                    submitableData[thisInput.name] = thisInput.value;
                }
            } else {
                submitableData[thisInput.name] = thisInput.value;
            }
        }
    }
    var selects = $("#" + inputDivId + " select");
    for (var i = 0; i < selects.length; i++) {
        var thisSelect = selects[i];
        if (!allowDisabled && thisSelect.disabled) {
            continue;
        }
        if (thisSelect.multiple) {
            var selectedOptions = [];
            for (var j=0; j < thisSelect.options.length; j++) {
                if (thisSelect.options[j].selected) {
                    selectedOptions.push(thisSelect.options[j].value);
                }
            }
            submitableData[thisSelect.name] = selectedOptions;
        } else if (thisSelect.selectedIndex >= 0){
            submitableData[thisSelect.name] = thisSelect.options[thisSelect.selectedIndex].value;
        }
    }
    return submitableData;
}


/**
 * Generic function to maximize /minimize a column in Michael's columnize framework.
 */
function toggleMaximizeColumn(link, maximizeColumnId) {
    var mainDiv = $("div[id='main']");
    if (link.text == "Maximize") {
        if (!mainDiv.hasClass('is-maximized')) {
            mainDiv[0].className = mainDiv[0].className + " is-maximized";
            var maximizeColumn = $("#" + maximizeColumnId)[0];
            maximizeColumn.className = maximizeColumn.className + ' shows-maximized';
        }
        link.innerHTML = "Minimize";
        link.className = link.className.replace('action-zoom-in', 'action-zoom-out');

    } else {
        minimizeColumn(link, maximizeColumnId);
    }
}

function minimizeColumn(link, maximizeColumnId) {

    $("div[id='main']").each(function() {
        $(this).removeClass('is-maximized');
    });
    $("#" + maximizeColumnId).each(function() {
        $(this).removeClass('shows-maximized');
    });
    link.innerHTML = "Maximize";
    link.className = link.className.replace('action-zoom-out', 'action-zoom-in');
}

// ---------------END GENERIC ------------------------


// ---------------------------------------------------------
//              USER SECTION RELATED FUNCTIONS
// ---------------------------------------------------------


function changeMembersPage(projectId, pageNo, divId, editEnabled) {
    $(".projectmembers-pagetab-selected").attr("class", "projectmembers-pagetab");
    $("#tab-" + pageNo).attr("class", "projectmembers-pagetab projectmembers-pagetab-selected");
    var membersElem = $('span[class="user_on_page_'+ pageNo+'"]');
    if (membersElem.length > 0) {
        $('span[class^="user_on_page_"]').hide(); 
        membersElem.show();
    } else {
        var my_url = '/project/getmemberspage/' + pageNo;
        if (projectId) {
            my_url = my_url + "/"+ projectId;
        }
        doAjaxCall({
            async: false,
            type: 'GET',
            url:  my_url,
            success: function(r) {
                $('span[class^="user_on_page_"]').hide();
                $("#" + divId).append(r);
                if (editEnabled) {
                    $("#visitedPages").val(function(idx, val){return val + "," + pageNo});
                }
            }
        });
    }
}


function show_hide(show_class, hide_class) {
    var elems = $(show_class);
    for (var i=0; i< elems.length; i++) {
        elems[i].style.display = 'inline';
    }
    elems = $(hide_class);
    for (var ii=0; ii< elems.length; ii++) {
        elems[ii].style.display = 'none';
    }
}

/**
 * Function on the Settings page.
 */
function _on_validation_finished(r){
    r = $.parseJSON(r);
    if (r['status'] == 'ok') {
        displayMessage(r['message'], "infoMessage");
    } else {
        displayMessage(r['message'], "errorMessage");
    }
}

function validateDb(db_url, tvb_storage){
    var db_url_value = document.getElementById(db_url).value;
    var storage = document.getElementById(tvb_storage).value;
    doAjaxCall({
        async : false,
        type: 'POST',
        url: "/settings/check_db_url",
        data: { URL_VALUE: db_url_value , TVB_STORAGE : storage},
        success: _on_validation_finished
      });
}

function validateMatlabPath(matlab_path){
    var matlab_path_value = document.getElementById(matlab_path).value;
    doAjaxCall({
        async : false,
        type: 'GET',
        url: "/settings/validate_matlab_path",
        data: { MATLAB_EXECUTABLE: matlab_path_value},
        success: _on_validation_finished
    });
}

function changeDBValue(selectComponent) {
    var component = eval(selectComponent);
    var selectedValue = $(component).val();
    var correspondingValue = component.options[component.selectedIndex].attributes.correspondingVal.nodeValue;
    var correspondingTextField = document.getElementById('URL_VALUE');
    correspondingTextField.value = correspondingValue;
    if (selectedValue == 'sqlite') {
        correspondingTextField.setAttribute('readonly', 'readonly');
    } else {
        correspondingTextField.removeAttribute('readonly');
    }
}

function settingsPageInitialize(){
    $('#TVB_STORAGE').change( function() {
        if ($('#SELECTED_DB').val() == 'sqlite') {
            var storagePath = $('#TVB_STORAGE').val();
            if (storagePath.slice(-1) !== '/'){
                storagePath += '/'
            }
            $('#URL_VALUE').val('sqlite:///' + storagePath + 'tvb-database.db');
        }
    });
}


// ------------------END USER-----------------------------


// ---------------------------------------------------------
//              GENERIC PROJECT FUNCTIONS
// ---------------------------------------------------------

function viewProject(projectId, formId) {
    document.getElementById(formId).action = "/project/editone/"+ projectId;
    document.getElementById(formId).submit();
}

function selectProject(projectId, formId) {
    // Change hidden project_id and submit
    document.getElementById("hidden_project_id").value = projectId;
    document.getElementById(formId).submit();
}

function exportProject(projectId) {
    window.location = "/project/downloadproject/?project_id=" + projectId
}

function removeProject(projectId, formId){
    var form = document.getElementById(formId);
    form.action = "/project/editone/"+ projectId + "/?delete=Delete" ;
    form.submit();
}

// ---------------END PROJECT ------------------------


// -----------------------------------------------------------------------
//              OVERLAY DATATYPE/OPERATIONS
//------------------------------------------------------------------------

// Set to true when we want to avoid display of overlay (e.g. when switching TAB on Data Structure page).
var TVB_skipDisplayOverlay = false;
var TVB_NODE_OPERATION_TYPE = "operation";
var TVB_NODE_OPERATION_GROUP_TYPE = "operationGroup";
var TVB_NODE_DATATYPE_TYPE = "datatype";
/**
 * Displays the overlay with details for a node(operation or dataType group/single).
 *
 * @param entity_gid an operation or dataType GID
 * @param entityType the type of the entity: operation or dataType
 * @param backPage is a string, saying where the visualizers that can be launched from the overlay should point their BACK button.
 * @param excludeTabs Tabs to be displayed as not-accessible
 */
function displayNodeDetails(entity_gid, entityType, backPage, excludeTabs) {
    closeOverlay(); // If there was overlay opened, just close it
    if (entity_gid == undefined || entity_gid == "firstOperation" || entity_gid == "fakeRootNode" || TVB_skipDisplayOverlay) {
        return;
    }
    var url;
    if (entityType == TVB_NODE_OPERATION_TYPE) {
        url = '/project/get_operation_details/' + entity_gid + "/0";
    } else if (entityType == TVB_NODE_OPERATION_GROUP_TYPE) {
        url = '/project/get_operation_details/' + entity_gid + "/1";
    } else {
        url = '/project/get_datatype_details/' + entity_gid;
    }

    if (!backPage) {
        backPage = get_URL_param('back_page');
    }
    if (backPage) {
        url = url + "/" + backPage;
    }
    if (excludeTabs) {
        url = url + "?exclude_tabs=" + excludeTabs
    }
    showOverlay(url, true);
}


/**
 * Close overlay and refresh backPage.
 */	
function closeAndRefreshNodeDetailsOverlay(returnCode, backPage) {

    closeOverlay();
    if (returnCode == 0) {

        if (backPage == 'operations') {
            document.getElementById('operationsForm').submit();

        } else if (backPage == 'data') {
            if ($("#lastVisibleTab").val() == GRAPH_TAB) {
                update_workflow_graph('workflowCanvasDiv', TREE_lastSelectedNode, TREE_lastSelectedNodeType);
            } else {
                updateTree('#treeStructure');
           }

        } else if (backPage == 'burst') {
            $("#tab-burst-tree")[0].onclick();
        }
    }
}


/**
 * Used from DataType(Group) overlay to store changes in meta-data.
 */
function overlaySubmitMetadata(formToSubmitId, backPage) {

    var submitableData = getSubmitableData(formToSubmitId, false);
    doAjaxCall({
        async : false,
        type: 'POST',
        url: "/project/updatemetadata",
        data: submitableData,
        success: function(r) {
            if (r) {
                displayMessage(r, 'errorMessage');
            } else {
                displayMessage("Data successfully stored!");
                closeAndRefreshNodeDetailsOverlay(0, backPage);
            }
        }
     });
}


/**
 * Used from DataType(Group) overlay to remove current entity.
 */
function overlayRemoveEntity(projectId, dataGid, backPage) {
    doAjaxCall({
        async : false,
        type: 'POST',
        url: "/project/noderemove/" + projectId + "/" + dataGid,
        success: function(r) {
            if (r) {
                displayMessage(r, 'errorMessage');
            } else {
                displayMessage("Node succesfully removed!");
                TREE_lastSelectedNode = undefined;
                TREE_lastSelectedNodeType = undefined;
                closeAndRefreshNodeDetailsOverlay(0, backPage);
            }
        }
    });
}


/**
 * Take an operation Identifier and reload previously selected input parameters for it.
 * Used from Operation-Overlay and View All Operations button/each row. 
 */
function reloadOperation(operationId, formId) {
    document.getElementById(formId).action = "/flow/reloadoperation/"+ operationId;
    document.getElementById(formId).submit();
}


/**
 * Take an operation Identifier which was started from a burst, and redirect to the 
 * burst page with that given burst as the selected one.
 */
function reloadBurstOperation(operationId, isGroup, formId) {
    document.getElementById(formId).action = "/flow/reload_burst_operation/" + operationId + '/' + isGroup;
    document.getElementById(formId).submit();
}


/**
 * To be called from Operation/DataType overlay window to switch current entity's visibility.
 */
function overlayMarkVisibility(entityGID, entityType, toBeVisible, backPage) {
    var returnCode = _markEntityVisibility(entityGID, entityType, toBeVisible);
    closeAndRefreshNodeDetailsOverlay(returnCode, backPage);
}


/**
 * Used from view-operations and overlay-dataType /operation as well.
 */
function _markEntityVisibility(entityGID, entityType, toBeVisible) {
    var returnCode = 0;
    doAjaxCall({
        async: false,
        type: 'POST',
        url: "/project/set_visibility/" + entityType+"/"+ entityGID+"/"+ toBeVisible,
        success: function() {
            displayMessage("Visibility was changed.");
        },
        error: function() {
            displayMessage("Error when trying to change visibility! Check logs...", "errorMessage");
            returnCode = 1;
        }
    });
    return returnCode;
}

// ---------------END OVERLAY DATATYPE/OPERATIONS ------------------------

// ---------------------------------------------------------
//              OPERATIONS FUNCTIONS
// ---------------------------------------------------------

// a global flag to be set when the page has been submitted and is about to reload
// Any function that wants to submit the page should do so only if this flag is not set
var TVB_pageSubmitted = false;

/**
 * Sets the visibility for an operation, from specifically the View Operation page. 
 * This will also trigger operation reload.
 *
 * @param operationGID an operation/operationGroup GID
 * @param isGroup True if OperationGroup entity
 * @param toBeRelevant <code>True</code> if the operation is to be set relevant, otherwise <code>False</code>.
 * @param submitFormId ID for the form to parent form, to submit operation through it.
 */
function setOperationRelevant(operationGID, isGroup, toBeRelevant, submitFormId) {
    var entityType;
    if (isGroup) {
        entityType = "operationGroup"
    }else{
        entityType = "operation";
    }
    var returnCode = _markEntityVisibility(operationGID, entityType, toBeRelevant);
    if (returnCode == 0){
        document.getElementById(submitFormId).submit();
    }
}


function _stopOperationsOrBurst(operationId, isGroup, isBurst, removeAfter) {

    var urlBase = "/flow/stop_operation/";
    if (isBurst) {
        urlBase = "/flow/stop_burst_operation/";
    }
    urlBase += operationId + '/' + isGroup ;
    if (removeAfter) {
        urlBase += '/True';
    }

    doAjaxCall({
        async: false,
        type: 'POST',
        url: urlBase,
        success: function(r) {
            if (r.toLowerCase() == 'true') {
                displayMessage("The operation was successfully removed.", "infoMessage")
            } else {
                displayMessage("Could not remove operation.",'warningMessage');
            }
            if (removeAfter) {
                refreshOperations();
            }
        },
        error: function() {
            displayMessage("Some error occurred while removing operation.",'errorMessage');
        }
    });
}


function stopOperation(operationId, isGroup) {
    // Take an operation Identifier and reload previously selected input parameters for it.
    _stopOperationsOrBurst(operationId, isGroup, false, false);
}

function stopBurstOperation(operationId, isGroup) {
    // Take an operation Identifier and reload previously selected input parameters for it.
    _stopOperationsOrBurst(operationId, isGroup, true, false);
}


function deleteOperation(operationId, isGroup) {
    // Delete a operation that was not part of a Burst
    _stopOperationsOrBurst(operationId, isGroup, false, true);
}


function deleteBurstOperation(operationId, isGroup) {
    // Delete a operation that was part of a burst launch
    _stopOperationsOrBurst(operationId, isGroup, true, true);
}


function resetOperationFilters(submitFormId) {
    //Reset all the filters set for the operation page.
    var input = document.createElement("INPUT");
    input.type = "hidden";
    input.name = "reset_filters";
    input.value = "true";
    var form = document.getElementById(submitFormId);
    form.appendChild(input);
    form.submit()
}

function applyOperationFilter(filterName, submitFormId) {
    // Make sure pagination is reset otherwise it might happen for he new filter the given page does not exist.
    document.getElementById("currentPage").value = 1;
    document.getElementById('filtername').value = filterName;
    document.getElementById(submitFormId).submit();
}

/*
 * Refresh the operation page is no overlay is currently displayed.
 */
function refreshOperations() {
    // do not cancel another request
    if(TVB_pageSubmitted){
       return;
    }

    if (document.getElementById("overlay") == null) {
        // let other requests cancel the refresh . Do not set the flag
        // TVB_pageSubmitted = true
        document.getElementById('operationsForm').submit();
    } else {
        setTimeout(refreshOperations, 30000);
    }
}

// ----------------END OPERATIONS----------------------------

// ---------------------------------------------------------
//              OVERLAY RELATED FUNCTIONS
// ---------------------------------------------------------


var _keyUpEvent = "keyup";

/**
 * Opens the overlay dialog and fill in
 *
 * @param url URL to be called in order to get overlay code
 * @param message_data OPTIONAL Submit data
 * @param allowClose TRUE when ECS is allowed to close current overlay.
 */
function showOverlay(url, allowClose, message_data) {

    $.ajax({
        async:false,
        type:'GET',
        url: url,
        dataType:'html',
        cache:true,
        data: message_data,
        success:function (htmlResult) {
            var bodyElem = $('body');
            bodyElem.addClass("overlay");
            if (allowClose) {
                bodyElem.bind(_keyUpEvent, closeOverlayOnEsc);
            }
            var parentDiv = $("#main");
            if (parentDiv.length === 0) {
                parentDiv = bodyElem;
            }
            parentDiv.prepend(htmlResult);
            MathJax.Hub.Queue(["Typeset", MathJax.Hub, "overlay"]);
        },
        error:function (r) {
            if (r) {
                displayMessage(r, 'errorMessage');
            } 
        }
    });
}

/**
 * Closes Overlay dialog.
 *
 */
function closeOverlay() {
    var bodyElem = $('body');
    bodyElem.removeClass("overlay");
    bodyElem.unbind(_keyUpEvent, closeOverlayOnEsc);
    $("#overlay").remove();
}

/**
 * Event listener attached to <body> to handle ESC key pressed
 * @param evt keyboard event
 */
function closeOverlayOnEsc(evt) {
    var evt_value = (evt) ? evt : ((event) ? event : null);

    // handle ESC key code
    if (evt_value.keyCode == 27) {
        closeOverlay();
        // Force page reload, otherwise the div#main with position absolute will be wrongly displayed
        // The wrong display happens only when iFrame with anchors are present in the Help Inline Doc.
        window.location.href = window.location.href;
    }
}

/**
 * Select a given tab from overlay
 *
 * @param tabsPrefix prefix in the neighbouring tabs names, to un-select them
 * @param tabId identifier of the tab to be selected
 */
function selectOverlayTab(tabsPrefix, tabId) {
    var css_class = "active";

    $("li[id^='" + tabsPrefix + "']").each(function() {
        $(this).removeClass(css_class);
    });

    $("section[id^='overlayTabContent_']").each(function () {
        $(this).removeClass(css_class);
    });

    $("#"+ tabsPrefix + tabId).addClass(css_class);
    $("#overlayTabContent_" + tabId).addClass(css_class);
}

/**
 * This function activate progress bar and blocks any user
 * action.
 */
function showOverlayProgress() {
    var overlayElem = $("#overlay");
    if (overlayElem != null) {
        overlayElem.addClass("overlay-blocker");
        var bodyElem = $('body');
        bodyElem.unbind(_keyUpEvent, closeOverlayOnEsc);
    }

    return false;
}

// ---------------------------------------------------------
// Here are specific functions for each overlay to be opened
// ---------------------------------------------------------

// We use this counter to allow multiple Ajax calls in the 
// same time. This way we ensure only the first one opens 
// overlay and last one closes it.
var _blockerOverlayCounter = 0;
var _blockerOverlayTimeout = null;

function showBlockerOverlay(timeout, overlay_data) {
    timeout = checkArg(timeout, 60 * 1000);
    overlay_data = checkArg(overlay_data,
        {"message_data": "Your request is being processed right now. Please wait a moment..."});
    _blockerOverlayCounter++;
    if (_blockerOverlayCounter == 1) {
        showOverlay("/showBlockerOverlay", false, overlay_data);

        // Ensure that overlay will close in 1 min
        _blockerOverlayTimeout = setTimeout(forceCloseBlockerOverlay, timeout);
    }
}

function showQuestionOverlay(question, yesCallback, noCallback) {
    /*
     * Dispaly a question overlay with yes / no answers. The params yesCallback / noCallback
     * are javascript code that will be evaluated when pressing the corresponding choice buttons.
     */
    if (yesCallback == null) {
        yesCallback = 'closeOverlay()';
    }
    if (noCallback == null) {
        noCallback = 'closeOverlay()';
    }
    var url = "/project/show_confirmation_overlay";
    var data = {'yes_action': yesCallback, 'no_action': noCallback};
    if (question != null) {
        data['question'] = question;
    }
    showOverlay(url, true, data);
}

function forceCloseBlockerOverlay() {
    displayMessage('It took too much time to process this request. Please reload page.', 'errorMessage');
    closeBlockerOverlay();
}

function closeBlockerOverlay() {
    _blockerOverlayCounter--;
    if (_blockerOverlayCounter <= 0) {
        if (_blockerOverlayTimeout != null) {
            clearTimeout(_blockerOverlayTimeout);
            _blockerOverlayTimeout = null;
        }
        closeOverlay();

        _blockerOverlayCounter = 0;
    }
}

/**
 * Function which opens online-help into overlay
 * 
 * @param {Object} section
 * @param {Object} subsection
 */
function showHelpOverlay(section, subsection) {
    var url = "/help/showOnlineHelp";
    if (section != null) {
        url += "/" + section;
    }
    if (subsection != null) {
        url += "/" + subsection;
    }

    showOverlay(url, true);
}


/**
 * Function that opens a loading overlay until the file storage update is done.
 */
function upgradeFileStorage() {
    doAjaxCall({
        overlay_timeout: 60 * 1000 * 60 * 4, //Timeout of 4 hours
        overlay_data: {'message_data': "Due to upgrade from pytables to h5py we need to update all your stored data. Please be patient and don't close TVB during the process."},
        showBlockerOverlay : true,
        type:'GET',
        url:'/user/upgrade_file_storage',
        success:function (data) {
            var result = $.parseJSON(data);
            var message = result['message'];
            var status = result['status'];
            if (message.length > 0) {
                if (status == true) {
                    displayMessage(message, "infoMessage");
                } else {
                    displayMessage(message, "errorMessage");
                }
            }
            closeBlockerOverlay();
       }
    });
}



/**
 * Displays the dialog which allows the user to upload certain data.
 *
 * @param projectId the selected project
 */
function showDataUploadOverlay(projectId) {
    showOverlay("/project/get_data_uploader_overlay/" + projectId, true);
     // Bind the menu events for the online help pop-ups
     setupMenuEvents($('.uploader .adaptersDiv'));
}

/**
 * Displays the dialog which allows the user to upload a project.
 */
function showProjectUploadOverlay() {
    showOverlay("/project/get_project_uploader_overlay", true);
}


// -------------END OVERLAY--------------------------------


// ---------------------------------------------------------
//              RESULT FIGURE RELATED FUNCTIONS
// ---------------------------------------------------------

/**
 * Displays the zoomed image.
 */
function zoomInFigure(figure_id) {
    showOverlay("/project/figure/displayzoomedimage/" + figure_id, true);
}


function displayFiguresForSession(selected_session) {
    var actionUrl = "/project/figure/displayresultfigures/" + selected_session;
    var myForm = document.createElement("form");
    myForm.method = "POST";
    myForm.action = actionUrl;
    document.body.appendChild(myForm);
    myForm.submit();
    document.body.removeChild(myForm);
}

// --------------END RESULT FIGURE------------------------------


// -------------------------------------------------------------
//              AJAX Calls
// -------------------------------------------------------------

/**
 * Execute an AJAX call using jQuery with some parameters from given dictionary.
 *
 * - {String} url URL to call
 * - {String} type request TYPE (POST, GET). Default = POST
 * - {bool} async Specify if the call should be done Sync
 * 		or Async. Default = true (asynchronous)
 * - {function} success Function to be called for success
 * - {function} error Function to be called for error
 * - {bool} showBlockerOverlay if True will show blocker overlay until request is done. Default = false
 */

function doAjaxCall(params) {
    params.type = checkArg(params.type, 'POST');
    params.async = checkArg(params.async, true);
    params.showBlockerOverlay = checkArg(params.showBlockerOverlay, false);

    if(params.showBlockerOverlay) {
        // should execute async, otherwise overlay is not shown
        params.async = true;
        showBlockerOverlay(params.overlay_timeout, params.overlay_data);
    }

    function closeOverlay(){
        if(params.showBlockerOverlay) {
            closeBlockerOverlay();
        }
    }

    function onSuccess(data, textStatus, jqXHR) {
        if( params.success != undefined) {
            params.success(data, textStatus, jqXHR);
        }
    }

    function onError(jqXHR, textStatus, error){
        if (jqXHR.status == 401) {
            displayMessage('Your session has expired. Please log in.', 'errorMessage');
        } else if (jqXHR.status == 303 ) {
            //handle a redirect.
            displayMessage(error, 'errorMessage');
        } else if( params.error != undefined) {
            params.error(jqXHR, textStatus, error);
        } else {
            displayMessage(error, 'errorMessage');
        }
    }

    // Do AJAX call
    $.ajax({
        url : params.url,
        type : params.type,
        async : params.async,
        success : [onSuccess, closeOverlay],
        error : [onError, closeOverlay],
        data : params.data,
        cache : params.cache
    });
}

// -------------End AJAX Calls----------------------------------

function checkArg(arg, def) {
    return ( typeof arg === 'undefined' ? def : arg);
}

/**
 * Converts a number to a string keeping the first significant numbers.
 * If the number is < 1 this is Number.toPrecision else it is Number.toFixed
 * @param number
 * @param precision defaults to 2
 * toSignificantDigits(0.0233) == "0.023"
 * toSignificantDigits(0.0233) == "23"
 * toSignificantDigits(23.3) == "23.30"
 */
function toSignificantDigits(number, precision){
    if(precision == null || precision < 0){
        precision = 2;
    }
    if(number == 0 || number > 1){
        return number.toFixed(precision);
    }else{
        return number.toPrecision(precision);
    }
}

var activeMenu = null;

function openMenu(selector){
    hideMenus();
    activeMenu = $(selector);
    activeMenu.find('.extension').show();
}

function hideMenus(){
    if (activeMenu){
        activeMenu.find('.extension').hide();
        activeMenu = null;
    }
}

/**
 * Binds menu events for all menus.
 * By default attaches events to elements matching $(".can-extend").not(".auto-extends").add(".inline-menu")
 * If the parent param is present it will search it's children for menus
 * @param [parent]
 * Dynamically created menus must call this to initialize. parent is provided so that this use case will not rebind all events.
 * todo: Introduce a new class for this new menu behaviour as the above selector is complex
 */
function setupMenuEvents(parent){
    if(parent == null){
        parent = $(document);
    }
    // By menu root understand the element which shows the menu on click. The root contains the menu dom.
    var menuRoots = parent.find(".can-extend").not(".auto-extends").add(".inline-menu");

    menuRoots.off('click.menus');

    menuRoots.on('click.menus', function(event){
        // hide menu if the menu root of the current menu has been clicked
        // but do nothing if the menu extension was clicked
        var clickedOnActiveMenu = activeMenu && activeMenu[0] == this;
        if (clickedOnActiveMenu){
            var clickedExtension = activeMenu.find('.extension').find(event.target).length;
            if( ! clickedExtension){
                hideMenus();
            }
        }else{
            openMenu(this);
        }
    });

    $(document).click(function(event){
        if (activeMenu){
            var clickedOutsideMenu = activeMenu.find(event.target).length === 0;
            if (clickedOutsideMenu){
                hideMenus();
            }
        }
    });
}

// todo: this is *NOT* the right place. Where is the place for document wide initialisations?
$(document).ready(function(){
    setupMenuEvents();
});