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
/* global doAjaxCall */
/*
 * SIMULATOR (BURST) related JS calls.
 *  - Configure and launch a new burst; 
 *  - Load a previous executed burst; 
 *  - Show progress.
 */

// Object holding current burst ID/ NAME / STATE
var EMPTY_BURST = {id: "", 
                   name: "",
                   isFinished: false,
                   isRange: false
                   };
var sessionStoredBurst = clone(EMPTY_BURST);

//A list of selected portlets id. Used to correctly change/update the portlet checkboxes for each tab.
var selectedPortlets;
//Keeps track of the currently selected tab.
var selectedTab = 0;
//Keeps track of the index of the currently configured portlet in the currently selected tab.
var indexInTab = -1;
//Flag to keep track if we are configuring portlets or just change tabs for visualization.
var portletConfigurationActive = false;
//Keep track of all the timeouts that are set for portlet updating
var refreshTimeouts = [];
// Class mapping to the active burst entry
var ACTIVE_BURST_CLASS = 'burst-active';
// Class mapping to a workflow from a group launch
var GROUP_BURST_CLASS = 'burst-group-expanded';
// When user edits a title, we won't overwrite that (e.g. by adding 'Copy of' prefix)
var user_edited_title = false;



function clone(object_) {
    return JSON.parse(JSON.stringify(object_));
}

/*************************************************************************************************************************
 * 			HISTORY COLUMN
 *************************************************************************************************************************/

  /*
   * When clicking on the New Burst Button reset to defaults for simulator interface and portlets. 
   */
function resetToNewBurst() {
    doAjaxCall({
        type: "POST",
        url: '/burst/reset_burst/',
        success: function() {
            loadSimulatorInterface();
            returnToSessionPortletConfiguration();
            setNewBurstActive();
            fill_burst_name('', false, false);
            displayMessage("Completely new configuration loaded!");
        },
        error: function() {
           displayMessage("We encountered an error while generating the new simulation. Please try reload and then check the logs!", "errorMessage");
           sessionStoredBurst = clone(EMPTY_BURST);
        }
    });
}

/*
 * When clicking the copy button on a burst-history entry, a clone of that burst is prepared.
 */
function copyBurst(burstID) {
    doAjaxCall({
        type: "POST",
        url: '/burst/copy_burst/' + burstID,
        success: function(r) {
            loadSimulatorInterface();
            setNewBurstActive();
            fill_burst_name(r, false, true);
            displayMessage("A copy of previous simulation was prepared for you!");
        },
        error: function() {
            displayMessage("We encountered an error while generating a copy of the simulation. Please try reload and then check the logs!", "errorMessage");
            sessionStoredBurst = clone(EMPTY_BURST);
        }
    });
}

/*
 * Reload entire Burst-History column.
 */
function loadBurstHistory() {
    doAjaxCall({
        type: "POST",
        url: '/burst/load_burst_history',
        cache: false,
        async: false,
        success: function(r) {
            var historyElem = $('#section-view-history');
            historyElem.empty();
            historyElem.append(r);
            MathJax.Hub.Queue(["Typeset", MathJax.Hub, "section-view-history"]);
            //setupMenuEvents(historyElem);
        },
        error: function() {
            displayMessage("Simulator data could not be loaded properly..", "errorMessage");
        }
    });
    scheduleNewUpdate(false);
}

/*
 * Periodically look for updates in burst history status and update their classes accordingly.
 */
function updateBurstHistoryStatus() {

    var burst_ids = [];
    $("#burst-history").find("li").each(function () {
        if (this.className.indexOf('burst-started') >= 0) {
            if (this.id.indexOf('burst_id_') >= 0) {
                var id = this.id.replace('burst_id_', '');
                burst_ids.push(id);
            }
        }
    });
    if (burst_ids.length > 0) {
        doAjaxCall({
            type: "POST",
            data: {'burst_ids' : JSON.stringify(burst_ids)},
            url: '/burst/get_history_status',
            success: function(r) {
                var finalStatusReceived = false;
                var changedStatusOnCurrentBurst = false;
                var result = $.parseJSON(r);

                for (var i = 0; i < result.length; i++) {
                    if (result[i][1] !== 'running') {
                        finalStatusReceived = true;
                        if (result[i][0] === sessionStoredBurst.id) {
                            changedStatusOnCurrentBurst = true;
                        }
                    }
                }
                scheduleNewUpdate(finalStatusReceived, changedStatusOnCurrentBurst);
            },
            error: function() {
                displayMessage("Error during simulation status update...", "errorMessage");
                scheduleNewUpdate(false);
            }
        });
    }
}

/**
 * Schedule burst-history section update, in the next 5 seconds.
 * If "withFullUpdate" is true, then a full history section replacement happens before the periodical update.
 */
function scheduleNewUpdate(withFullUpdate, refreshCurrent) {

    if ($('#burst-history').length !== 0) {
        if (withFullUpdate) {
            loadBurstHistory();
            if (refreshCurrent) {
                loadBurst(sessionStoredBurst.id);
            }
        } else {
            setTimeout(updateBurstHistoryStatus, 5000);
        }
    }
}

/*
 * Cancel or Remove the burst entity given by burst_id. Also update the history column accordingly.
 */
function cancelOrRemoveBurst(burst_id) {

    doAjaxCall({
        type: "POST",
        url: '/burst/cancel_or_remove_burst/' + burst_id,
        showBlockerOverlay : true,
        success: function(r) {
            var liParent = document.getElementById("burst_id_"+ burst_id);
            if (r == 'canceled') {
                if (liParent.className.indexOf(ACTIVE_BURST_CLASS) >= 0) {
                    liParent.className = ACTIVE_BURST_CLASS + ' burst-canceled burst';
                } else {
                    liParent.className = 'burst-canceled burst';
                }
                loadBurstHistory();
            } else {
                var ulGrandparent = document.getElementById("burst-history");
                ulGrandparent.removeChild(liParent);
                if (r == 'reset-new') {
                    resetToNewBurst();
                }
            }
        } ,
        error: function() {
            displayMessage("Could not cancel/remove simulation.", "errorMessage");
        }
    });
}

/*
 * Create a input field that should be displayed on top of the HREF with the
 * burst name. On lost focus just set that name as the new burst name and update the
 * entity.
 */
function renameBurstEntry(burst_id, new_name_id) {

    var newValue = document.getElementById(new_name_id).value;
    doAjaxCall({
        type: "POST",
        async: false,
        url: '/burst/rename_burst/' + burst_id + '/' + newValue,
        success: function(r) {
            var result = $.parseJSON(r);
            if ('success' in result) {
                displayMessage(result['success']);
                $("#burst_id_" + burst_id + " a").html(newValue);
                if (sessionStoredBurst.id == burst_id + "") {
                    sessionStoredBurst.name = newValue;
                    fill_burst_name(newValue, true, false);
                }
            } else {
                displayMessage(result['error'], "errorMessage");
            }
        } ,
        error: function() {
            displayMessage("Error when renaming simulation.", "errorMessage");
        }
    });
}

/*
 * Load a given burst entry from history. 
 */
function changeBurstHistory(burst_id) {

    var clickedBurst = document.getElementById("burst_id_" + burst_id);
    if ((clickedBurst.className.indexOf(ACTIVE_BURST_CLASS) >= 0) && (clickedBurst.className.indexOf(GROUP_BURST_CLASS) < 0)) {
        displayMessage("Simulation already loaded...", "warningMessage");
        return;
    }
    $("#burst-history").find("li").each(function () {
        $(this).removeClass(ACTIVE_BURST_CLASS);
        $(this).removeClass(GROUP_BURST_CLASS);
    });
    // Load the selected burst.
    loadBurst(burst_id);
}

/*************************************************************************************************************************
 * 			MIDDLE COLUMN (SIMULATION PARAMETERS)
 *************************************************************************************************************************/


function _toggleLaunchButtons(beActiveLaunch, beActiveRest) {
    var launchButton = $("#button-launch-new-burst");
    //var continueButton = $("#button-continue-burst");
    var branchButton = $("#button-branch-burst");

    if (beActiveLaunch) {
        launchButton.show();
    } else {
        launchButton.hide();
    }

    if (beActiveRest) {
        //continueButton.show();
        branchButton.show();
    } else {
        //continueButton.hide();
        branchButton.hide();
    }
}

function _fillSimulatorParametersArea(htmlContent, isConfigure) {

    var simParamElem = $("#div-simulator-parameters");
    simParamElem.empty();
    simParamElem.append(htmlContent);

    if (isConfigure) {
        document.getElementById("configure-simulator-button").innerHTML = "Save Configuration";
        $("#configRegionModelParam").hide();
        $("#configSurfaceModelParam").hide();
        $("#button-uncheck-all-params").show();
        $("#button-check-all-params").show();
        setSimulatorChangeListener('div-simulator-parameters');
    } else {
        document.getElementById("configure-simulator-button").innerHTML = "Configure Interface";
        $("#configRegionModelParam").show();
        $("#configSurfaceModelParam").hide();
        toggleConfigSurfaceModelParamsButton();
        // Do this before ranger expand since otherwise on FF the ranger is hidden.
        setSimulatorChangeListener('div-simulator-parameters');
        tryExpandRangers();
        $("#button-uncheck-all-params").hide();
        $("#button-check-all-params").hide();
    }
    _toggleLaunchButtons(!isConfigure && sessionStoredBurst.id=='', !isConfigure && sessionStoredBurst.id!='' && sessionStoredBurst.isFinished && !sessionStoredBurst.isRange);

    MathJax.Hub.Queue(["Typeset", MathJax.Hub, "div-simulator-parameters"]);
}

/*
 * Load the left side simulator interface without any check-boxes.
 */
function loadSimulatorInterface() {
    doAjaxCall({
        type: "GET",
        url: '/burst/get_reduced_simulator_interface',
        showBlockerOverlay : true,
        success: function(r) {
            _fillSimulatorParametersArea(r, false);
        } ,
        error: function() {
            displayMessage("Simulator data could not be loaded properly..", "errorMessage");
        }
    });
}

function tryExpandRangers() {
    doAjaxCall({type: "GET",
        url: '/burst/get_previous_selected_rangers',
        success: function(r) {
            var result = $.parseJSON(r);
            updateRangeValues(result);
        } ,
        error: function() {
            displayMessage("Could not load previous rangers!.", "warningMessage");
        }
    });
}

/*
 * Set on change on all simulator inputs, to set a new burst as active whenever something changes.
 */
function setSimulatorChangeListener(parentDivId) {
    var parentDiv = $('#' + parentDivId);
    parentDiv.find('select').each(function() {
        if (!this.disabled) { this.onchange(); }
    });
    parentDiv.find('input[type="radio"]').each(function() {
        if (!this.disabled && this.checked) { this.onchange(); }
    });
    parentDiv.find(":input").each(function () {
        if (this.type != 'checkbox') {
            $(this).change(function() {
                if (this.type != 'checkbox') {
                    markBurstChanged();
                }
            });
        }
    });
}

/*
 * Switch the simulator part from the 'configure' view with checkboxes next to 
 * entries to the normal mode only with a reduce set of parameters.
 */
function configureSimulator(configureHref) {

    if (configureHref.text == "Configure Interface") {
        doAjaxCall({
            type: "GET",
            url: '/burst/configure_simulator_parameters',
            showBlockerOverlay : true,
            success: function(r) {
                _fillSimulatorParametersArea(r, true);
            },
            error: function() {
                displayMessage("Error occurred during parameter save.", "errorMessage");
            }
        });
    } else {
        var submitableData = getSubmitableData('div-simulator-parameters', true);

        doAjaxCall({
            type: "POST",
            data: {'simulator_parameters' : JSON.stringify(submitableData)},
            url: '/burst/save_simulator_configuration?exclude_ranges=True',
            success: function() {
                loadSimulatorInterface()
            } ,
            error: function() {
                displayMessage("Error during saving configuration.", "errorMessage");
            }
        });
    }
}

/**
 * Shortcut into selecting/unselecting all simulation parameters.
 */
function toggleSimulatorParametersChecks(beChecked) {
    $(".param-config-checkbox").each(function () {
        if (beChecked) {
            $(this).attr("checked", 'true');
        } else {
            $(this).removeAttr('checked');
        }
    });
}

/**
 * Submit currently set simulation parameters. 
 * For Model-Visual-Setter important are: Connectivity and Model.
 */
function configureModel(actionUrl) {

    var submitableData = getSubmitableData("div-simulator-parameters", false);
    doAjaxCall({
        type: "POST",
        data: {'simulator_parameters' : JSON.stringify(submitableData),
               'burstName': $("#input-burst-name-id").val()},
        url: '/burst/save_simulator_configuration?exclude_ranges=False',
        success: function() {
            // After submitting current parameters, go to a different page.
            var myForm = document.createElement("form");
            myForm.method="POST" ;
            myForm.action = actionUrl;
            document.body.appendChild(myForm);
            myForm.submit();
            document.body.removeChild(myForm);
        } ,
        error: function() {
            displayMessage("Sorry, the model visual-configurator is unavailable! Please contact your administrator!", "errorMessage");
        }
    });
}

function configureModelParamsOnRegions() {
    configureModel("/spatial/modelparameters/regions/edit_model_parameters/");
}

function configureModelParamsOnSurface() {
    configureModel("/spatial/modelparameters/surface/edit_model_parameters/");
}

function configureNoiseParameters() {
    configureModel("/spatial/noiseconfiguration/edit_noise_parameters")
}

function toggleConfigSurfaceModelParamsButton() {
    var selectorSurfaceElem = $("select[name='surface']");
    selectorSurfaceElem.unbind('change.configureSurfaceModelParameters');
    selectorSurfaceElem.bind('change.configureSurfaceModelParameters', function () {
        var selectedValue = this.value;
        if (selectedValue == null || selectedValue == 'None' || selectedValue.length == 0) {
            $("#configSurfaceModelParam").hide();
        } else {
            $("#configSurfaceModelParam").show();
        }
    });
    selectorSurfaceElem.trigger("change");
    if (selectorSurfaceElem.length < 1) {
        $("#configSurfaceModelParam").hide();
    }
}

/*************************************************************************************************************************
 * 			PORTLETS COLUMN (3rd COLUMN)
 *************************************************************************************************************************/

function switch_top_level_visibility(currentVisibleSelection) {
    $("#section-portlets").hide();
    $("#section-pse").hide();
    if (currentVisibleSelection) {
        $("" + currentVisibleSelection).show();
    }
    var maximize_flot = $('#button-maximize-flot')[0];
    var maximize_iso = $('#button-maximize-iso')[0];
    var maximize_portlets = $('#button-maximize-portlets')[0];

    if (maximize_flot) {
        minimizeColumn(maximize_flot, 'section-pse');
    }
    if (maximize_iso) {
        minimizeColumn(maximize_iso, 'section-pse');
    }
    minimizeColumn(maximize_portlets, 'section-portlets');
}


function loadGroup(groupGID) {
    // Hide both divs
    $('#burst-pse-flot').hide();
    $('#burst-pse-iso').hide();
    $("#section-portlets-ul").find("li").each(function () {
            $(this).removeClass('active');
        });
    doAjaxCall({
        type: "POST",
        async: false,
        url: '/burst/explore/get_default_pse_viewer/' + groupGID,
        success: function(r) {
                if (r == 'FLOT') {
                    $('#burst-pse-flot').show();
                    $('#pse-flot').addClass('active');
                } else if (r == 'ISO') {
                    $('#burst-pse-iso').show();
                    $('#pse-iso').addClass('active');
                } else {
                    displayMessage("None of the parameter exploration viewers are compatible with range.", "warningMessage");
                }

                switch_top_level_visibility("#section-pse");
                var pseElem = $('#section-pse');
                var isoWidth = pseElem.width();
                var isoHeight = pseElem.height();
                PSE_mainDraw('burst-pse-flot', 'burst', groupGID);
                Isocline_MainDraw(groupGID, 'burst-pse-iso', isoWidth, isoHeight)
            },
        error: function() {
            displayMessage("Error while loading burst.", "errorMessage");
        }});
}


function changePSETab(clickedHref, toShow) {
    $("#section-portlets-ul").find("li").each(function () {
            $(this).removeClass('active');
        });
    $(clickedHref).parent().addClass('active');
    if (toShow == 'flot') {
        $('#burst-pse-flot').show();
        $('#burst-pse-iso').hide();
        redrawPlot('main_div_pse');
    } else {
        $('#burst-pse-flot').hide();
        $('#burst-pse-iso').show();
        resizeIsoFigures();
    }
}


function resizeIsoFigures() {
    var pseElem = $('#burst-pse-flot');
    var width = pseElem.width();
    var height = pseElem.height();
    try {
        resizePlot(width - 60, height - 90); // Don't resize quite to full since we have selects under plot and margins to plot
    }
    catch(ReferenceError) { // just means we on the error page so no plot to resize
    }
}


function toggleMaximizeBurst(hrefElement) {
    /*
     * Maximize or minimize the left side div on a group burst. Also resize
     * plot for the tab that is currently selected.
     */
    toggleMaximizeColumn(hrefElement, 'section-pse');
    if ($('#pse-iso').hasClass('active')) {
        resizeIsoFigures();
    }
    if ($('#pse-flot').hasClass('active')) {
        redrawPlot('main_div_pse');
    }
}


function updatePortletsToolbar(state) {
    var secondClass;
    if (state == 0) {
        // Empty toolbar, when Tree TAB is selected
        secondClass ='empty-portlets-toolbar';
    }else if (state == 1) {
        // Save and Cancel buttons when selecting currently visible portlets
        secondClass = 'select-portlets-toolbar';
    } else if (state == 2) {
        // Save and Cancel when filling portlet parameters to work with
        secondClass = 'parameters-portlets-toolbar';
    } else {
        // Standard (Configure button only) in rest
        secondClass = 'standard-portlets-toolbar';
    }
    $("#portlets-toolbar")[0].className = 'toolbar-inline ' + secondClass;
}

/*
 * Update the selected portlets. Used when changing any of the select combos.
 */
function updatePortletSelection(selectComponent, indexInTab) {

    if (selectedPortlets != null) {
        var selectedOption = selectComponent.options[selectComponent.selectedIndex];
        var portletId = selectedOption.value;
        var portletName = selectedOption.innerHTML;
        document.getElementById('portlet-name_entry-' + indexInTab).value = portletName;
        selectedPortlets[selectedTab][indexInTab] = [parseInt(portletId), portletName];
    }
}


/*
 * Switch between portlets selection and portlet preview/results display.
 */
function selectPortlets(isSave) {

    if (!isSave) {
        updatePortletConfiguration();
        $("#portlets-display").hide();
        $("#portlets-configure").show();
        portletConfigurationActive = true;
        updatePortletsToolbar(1);

    } else {
        // If we want to save the configuration, show the corresponding div, and make a call
        // to server to get the previews(static images) for these portlets.
        for (var i = 0; i < selectedPortlets[0].length; i++) {
            selectedPortlets[selectedTab][i][1] = document.getElementById('portlet-name_entry-' + i).value;
        }
        doAjaxCall({
            type: "POST",
            data: {"tab_portlets_list": JSON.stringify(selectedPortlets)},
            url: '/burst/portlet_tab_display',
            success: function(r) {
                var portletDisplayElem = $("#portlets-display");
                portletDisplayElem.replaceWith(r);
                // When saving configuration we need to show only the static previews even if we started
                // from the static previews page or the visualization page.
                portletDisplayElem.hide();
                portletDisplayElem.show();
                $("#portlets-configure").hide();
                portletConfigurationActive = false;
                markBurstChanged();
                updatePortletsToolbar(3);
            } ,
            error: function() {
                displayMessage("Selection was not saved properly.", "errorMessage");
            }
        });
    }
    $("#portlet-param-config").hide();
}

/*
 * Set the right side display to the static image previews of the portlets.
 */
function setPortletsStaticPreviews() {
    doAjaxCall({
        type: "POST",
        url: '/burst/get_configured_portlets',
        success: function(r) {
           $("#portlets-display").replaceWith(r);
        } ,
        error: function() {
           displayMessage("Selection was not saved properly.", "errorMessage");
        }
    });
}

/*
 * Update the select inputs for portlet configurations.
 */
function updatePortletConfiguration() {

    var selectedPortletsForThisTab = selectedPortlets[selectedTab];
    for (var i = 0; i < selectedPortletsForThisTab.length; i++) {
        var selectComponent = document.getElementById('selectportlet-' + i);
        var currentConfig = selectedPortletsForThisTab[i];
        var selectedIndex = 0;
        for (var k = 0; k < selectComponent.options.length; k++) {
            var selectedOption = selectComponent.options[k];
            if (parseInt(selectedOption.value) == currentConfig[0]) {
                selectedIndex = k;
            }
        }
        selectComponent.selectedIndex = selectedIndex;
        document.getElementById('portlet-name_entry-' + i).value = currentConfig[1];
    }
}

/*
 * Save the inputs for the currently selected portlet.
 */
function savePortletParams() {

    var submitableData = getSubmitableData('portlet-param-config', false);
    doAjaxCall({
        type: "GET",
        data: {"portlet_parameters": JSON.stringify(submitableData)},
        url: '/burst/save_parameters/' + indexInTab,
        traditional: true,
        success: function(r) {
            // When saving parameters for a portlet, a relaunch might be needed (in case analyzer param changed)
            // or might not be needed (in case of visualizer change)
            if (r == "relaunchView" && sessionStoredBurst.id != '') {
                var currentPortletDiv = $(".portlet-" + indexInTab)[0];
                var width = Math.floor(currentPortletDiv.clientWidth);
                var height = Math.floor(currentPortletDiv.clientHeight);
                doAjaxCall({
                    type: "GET",
                    url: '/burst/check_status_for_visualizer/' + selectedTab + '/' + indexInTab + '/' + width + '/' + height,
                    success: function(r) {
                        currentPortletDiv.replaceWith(r);
                        $("#portlets-display").show();
                    } ,
                    error: function() {
                        displayMessage("Error when retrieving visualizers configuration!", "errorMessage");
                    }
               });
            } else {
                markBurstChanged();
                doAjaxCall({
                    type: "POST",
                    data: {"tab_portlets_list": JSON.stringify(selectedPortlets)},
                    url: '/burst/portlet_tab_display',
                    success: function(r) {
                        $("#portlets-display").replaceWith(r);
                    } ,
                    error: function() {
                        displayMessage("Selection was not saved properly.", "errorMessage");
                    }
                });
                displayMessage("Viewers configuration saved succesfully!", "infoMessage");
            }
        } ,
        error: function() {
            displayMessage("Error during saving configuration.", "errorMessage");
        }
    });
    $("#portlet-param-config").hide();
    $("#portlets-display").show();
    updatePortletsToolbar(3);
}

/*
 * Receive as input the index of a portlet in the currently selected tab.
 * Update the indexInTab variable.
 * Then get the configurable interface for the portlet.
 */
function showPortletParametersPage(tabIdx) {

    // The tabIdx received is just a relative number (the n-th portlet in this tab)
    // but the configuration stored is in the form [ [id, name], [-1, None], [-1, None], [id, name]]
    // so go through this to find out the absolute index in this tab for this portlet
    for (var i = 0; i < selectedPortlets[selectedTab].length; i++) {
        if (selectedPortlets[selectedTab][i][0] >= 0) {
            if (tabIdx > 0) {
                tabIdx = tabIdx - 1;
            } else {
                indexInTab = i;
                break;
            }
        }
    }
    doAjaxCall({
        type: "GET",
        url: '/burst/get_portlet_configurable_interface/' + indexInTab,
        success: function(r) {
            var portletElem = $("#portlet-param-config");
            portletElem.empty();
            portletElem.append(r);
            MathJax.Hub.Queue(["Typeset", MathJax.Hub, "portlet-param-config"]);
            $("#portlets-display").hide();
            portletElem.show();
            updatePortletsToolbar(2);
        } ,
        error: function() {
            displayMessage("View configuration was not property loaded...", "errorMessage");
        }
    });
}

/*
 * First cancel the configuration, and also get the stored configuration for this
 * tab from server session, and update the selected portlets by that.
 */
function returnToSessionPortletConfiguration() {

    cancelPortletConfig();
    $("#portlets-configure").hide();
    doAjaxCall({
        type: "GET",
        async: false,
        url: '/burst/get_portlet_session_configuration',
        success: function(r) {
                selectedPortlets = $.parseJSON(r);
        } ,
        error: function() {
                displayMessage("Error during retrieving viewer configuration.", "errorMessage");
        }
    });
}

/*
 * Cancel the configuration of a portlet. Just hide the configuration DIV and show the display one.
 */
function cancelPortletConfig() {

    updatePortletsToolbar(3);
    $("#portlet-param-config").hide();
    $("#portlets-configure").hide();
    $("#portlets-display").show();
}

/*
 * Check for each portlet that is in running status if it is done or not.
 */
function checkIfPortletDone(portlet_element_id, timedSelectedTab, timedTabIndex) {

    var portlet_element = $("#" + portlet_element_id);
    if (portlet_element.length > 0) {
        var width = Math.floor(portlet_element[0].clientWidth);
        var height = Math.floor(portlet_element[0].clientHeight);
        doAjaxCall({
            type: "GET",
            url: '/burst/check_status_for_visualizer/' + timedSelectedTab + '/' + timedTabIndex + '/' + width + '/' + height,
            success: function(r) {
                var expectedParentElem = $("#" + portlet_element_id);
                if (expectedParentElem.length > 0) {
                    expectedParentElem.replaceWith(r);
                    var runningFlag = $(".portlet-"+ timedTabIndex+" input[id^='running-portlet-']");
                    if (runningFlag.length > 0) {
                        var new_portlet_id = $(".portlet-" + timedTabIndex)[0].id;
                        var timeout = setTimeout("checkIfPortletDone('" + new_portlet_id + "'," + selectedTab + ", " + timedTabIndex + ")", 3000);
                        refreshTimeouts.push(timeout);
                    }
                }
            } ,
            error: function() {
                displayMessage("Error during retrieving viewer configuration.", "errorMessage");
            }
        });
    }
}

function _setPortletRefreshTimeouts() {
    $("input[id^='running-portlet-']").each(function () {
            var parent_div_id = 'portlet-view-'+$(this).val();
            var tabIndex = $(this)[0].id.replace('running-portlet-', '');
            var timeout = setTimeout("checkIfPortletDone('" + parent_div_id + "', " + selectedTab + ", " + tabIndex + ")", 3000);
            refreshTimeouts.push(timeout);
    });
}

function _clearAllTimeouts() {
    for (var i = 0; i < refreshTimeouts.length; i++) {
        clearTimeout(refreshTimeouts[i]);
    }
}

/*
 * Change tab for current burst.
 */
function changeBurstTile(selectedHref) {
    _clearAllTimeouts();
    $("#div-burst-tree").hide();
    $("#section-portlets-ul, #section-portlets-ul").find("li").each(function () {
            $(this).removeClass('active');
        });
    $(selectedHref).parent().addClass('active');
    // Refresh buttons
    returnToSessionPortletConfiguration();
    // First update with the value stored in the input fields
    if (selectedTab >=0) {
        for (var i = 0; i < selectedPortlets[0].length; i++) {
            selectedPortlets[selectedTab][i][1] = $('#portlet-name_entry-' + i).val();
        }
    }
    selectedTab = selectedHref.id.split('_')[1];
    // Also update selected tab on cherryPy session.
    doAjaxCall({type: "POST",
                async: false,
                url: '/burst/change_selected_tab/' + selectedTab
            });
    // Next update the checked check-boxes for this newly selected tab
    updatePortletConfiguration();

    if (!portletConfigurationActive) {
        if (sessionStoredBurst.id == '') {
            // If we are in display phase, depending on the condition that this is a new burst or a loaded one, take the corresponding action.
            setPortletsStaticPreviews();
        } else {
            var sectionPortlets = $("#section-portlets")[0];
            var width = Math.floor(sectionPortlets.clientWidth);
            var height = Math.floor(sectionPortlets.clientHeight);
            doAjaxCall({
                type: "POST",
                url: '/burst/load_configured_visualizers/' + width + '/' + height,
                success: function(r) {
                    $("#portlets-display").replaceWith(r);
                    _setPortletRefreshTimeouts();
                    MathJax.Hub.Queue(["Typeset", MathJax.Hub, "portlets-display"]);
                } ,
                error: function() {
                    displayMessage("Visualizers selection was not properly saved.", "errorMessage");
                }
            });
        }
        cancelPortletConfig();
    }
}

/**
 * Hide portlet DIVs and display Burst-Tree section.
 */
function displayBurstTree(selectedHref, selectedProjectID, baseURL) {

    _clearAllTimeouts();
    returnToSessionPortletConfiguration();

    updatePortletsToolbar(0);
    $("#section-portlets-ul").find("li").each(function () {
            $(this).removeClass('active');
        });
    $(selectedHref).parent().addClass('active');
    // Also update selected tab on cherryPy session.
    doAjaxCall({type: "POST",
                async: false,
                url: '/burst/change_selected_tab/-1'
            });
    var filterValue = {'type' : 'from_burst', 'value' : sessionStoredBurst.id};
    if (filterValue.value == '') {
        filterValue = {'type' : 'from_burst', 'value' : "0"};
    }
    updateTree("#treeOverlay", selectedProjectID, baseURL, JSON.stringify(filterValue));
    $("#portlets-display").hide();
    $("#portlets-configure").hide();
    $("#portlet-param-config").hide();
    $("#div-burst-tree").show();
}

/*************************************************************************************************************************
 * 			GENERIC FUNCTIONS
 *************************************************************************************************************************/

  /*
   * If a burst is stored in session then load from there. Called on coming to burst page from a valid session.
   */
function initBurstConfiguration(sessionPortlets, selectedTab) {
    //Get the selected burst from session and store it to be used further ....
    doAjaxCall({
        type: "POST",
        url: '/burst/get_selected_burst',
        cache: false,
        async: false,
        success: function(r) {
            if (r != 'None') {
                sessionStoredBurst.id = r;
            } else {
                sessionStoredBurst = clone(EMPTY_BURST);
            }
        },
        error: function() {
            displayMessage("Simulator data could not be loaded properly..", "errorMessage");
        }
    });

    loadBurstHistory();

    if (sessionStoredBurst.id != "") {
        loadBurst(sessionStoredBurst.id);
    } else {
        tryExpandRangers();
    }

    toggleConfigSurfaceModelParamsButton();
    
    if ('-1' == selectedTab) {
        $("#tab-burst-tree").click();
    }
    selectedPortlets = sessionPortlets;
    setPortletsStaticPreviews();
}

/*
 * Given a burst id, make all the required AJAX calls to populate the right and the left side.
 */
function loadBurst(burst_id) {

    sessionStoredBurst.id = burst_id;
    // If left side was on portlet config phase, cancel that.
    cancelPortletConfig();
    _clearAllTimeouts();

    // Call ASYNC since it returns a HTML that contains the burst status
    // This is updated immediately after this function exits so we need to make
    // sure AJAX response is loaded by then

    doAjaxCall({
        type: "POST",
        url: '/burst/load_burst/' + burst_id,
        showBlockerOverlay : true,
        success: function(r) {
                var result = $.parseJSON(r);
                selectedTab = result['selected_tab'];
                var groupGID = result['group_gid'];
                var selectedBurst = $("#burst_id_" + burst_id)[0];
                // This is for the back-button issue with Chrome. Should be removed after permanent solution.
                if (selectedBurst != null) {
                    selectedBurst.className = selectedBurst.className + ' ' + ACTIVE_BURST_CLASS;
                    sessionStoredBurst.isFinished = (result['status']=='finished');
                    sessionStoredBurst.isRange = (groupGID != null && groupGID != "None");
                    fill_burst_name(selectedBurst.children[0].text, true, false);
                    updatePortletsToolbar(3);
                }
                // Now load simulator interface and the corresponding right side div depending
                // on the condition if the burst was a group launch or not.
                loadSimulatorInterface();
                if (groupGID != null && groupGID != "None") {
                    loadGroup(groupGID);
                } else if (selectedTab == -1) {
                    switch_top_level_visibility();
                    $("#section-portlets").show();
                    $("#tab-burst-tree").click();
                } else {
                    switch_top_level_visibility();
                    var sectionPortletsElem = $("#section-portlets");
                    sectionPortletsElem.show();
                    var portletsDisplay = $("#portlets-display")[0];
                    var fullWidth = Math.floor(portletsDisplay.clientWidth);
                    var fullHeight = Math.floor(sectionPortletsElem[0].clientHeight - 95);
                    doAjaxCall({
                        type: "POST",
                        url: '/burst/load_configured_visualizers/' + fullWidth + '/' + fullHeight,
                        showBlockerOverlay : true,
                        success: function(portlets) {
                            doAjaxCall({
                                    type: "POST",
                                    async: false,
                                    url: '/burst/get_selected_portlets',
                                    showBlockerOverlay : true,
                                    success: function(rr) {
                                        selectedPortlets = $.parseJSON(rr);
                                    } ,
                                    error: function() {
                                        displayMessage("Viewers not loaded completely...", "errorMessage");
                                    }
                                });
                            $("#portlets-display").replaceWith(portlets);
                            _setPortletRefreshTimeouts();
                            MathJax.Hub.Queue(["Typeset", MathJax.Hub, "portlets-display"]);
                            displayMessage("Simulation successfully loaded!");
                        } ,
                        error: function() {
                            displayMessage("Viewers not loaded properly...", "errorMessage");
                        }
                    });
                }
            },
        error: function() {
            displayMessage("Simulation was not loaded properly...", "errorMessage");
        }
    });
}


/*
 * Set the new burst entry from the burst history column as active. Update visualization accordingly.
 */
function setNewBurstActive() {

    switch_top_level_visibility("#section-portlets");
    $("#burst-history").find("li").each(function () {
        $(this).removeClass(ACTIVE_BURST_CLASS);
        $(this).removeClass(GROUP_BURST_CLASS);
    });

    if (selectedTab === -1) {
        sessionStoredBurst.id = "";
        switch_top_level_visibility();
        $("#section-portlets").show();
        $("#tab-burst-tree").click();
    } else {
        setPortletsStaticPreviews();
    }
    sessionStoredBurst = clone(EMPTY_BURST);
}

/**
 * Mark current burst as changed, to see the user than the latest changes are not yet persisted.
 */
function markBurstChanged() {
    if (sessionStoredBurst.id == '') {
        return;
    }
    var titleSimulation = $("#title-simulation");
    var previousTitle = titleSimulation.html();
    if (previousTitle.lastIndexOf("***") < 0) {
        titleSimulation.html(previousTitle + " ***");
    }
}

/**
 * Method for updating title area according to current selected burst and its state.
 * @param {String} burstName
 * @param {bool} isReadOnly
 * @param {bool} addPrefix
 */
function fill_burst_name(burstName, isReadOnly, addPrefix) {

    var inputBurstName = $("#input-burst-name-id");
    var titleSimulation = $("#title-simulation");
    var titlePortlets = $("#title-visualizers");

    if (addPrefix && burstName.indexOf('Copy of ') < 0) {
        burstName = "Copy of " + burstName;
    }

    titleSimulation.empty();
    inputBurstName.val(burstName);
    titlePortlets.empty();

    if (isReadOnly) {
        titleSimulation.append("<mark>Review</mark> Simulation core for "+ burstName);
        titlePortlets.append(burstName);
        sessionStoredBurst.name = burstName;
        inputBurstName.parent().parent().removeClass('is-created');
    } else {
        titleSimulation.append("<mark>Create</mark> New simulation core");
        if (burstName != '') {
            titlePortlets.append(burstName);
        } else {
            titlePortlets.append("New simulation");
        }
        inputBurstName.parent().parent().addClass('is-created');
    }
    _toggleLaunchButtons(!isReadOnly, isReadOnly && sessionStoredBurst.isFinished && !sessionStoredBurst.isRange);
    user_edited_title = false;
}

/*
 * Get the data from the simulator and launch a new burst. On success add a new entry in the burst-history.
 * @param launchMode: 'new' 'branch' or 'continue'
 */
function launchNewBurst(launchMode) {

    var newBurstName = document.getElementById('input-burst-name-id').value;
    if (newBurstName.length === 0) {
        newBurstName = "none_undefined";
    }
    displayMessage("You've submitted parameters for simulation launch! Please wait for preprocessing steps...", 'warningMessage');
    var submitableData = getSubmitableData('div-simulator-parameters', false);
    doAjaxCall({
        type: "POST",
        async: true,
        url: '/burst/launch_burst/' + launchMode + '/' + newBurstName,
        data: { 'simulator_parameters' : JSON.stringify(submitableData) },
        traditional: true,
        success: function(r) {
                    loadBurstHistory();
                    var result = $.parseJSON(r);
                    if ('id' in result) {
                        changeBurstHistory(result['id']);
                    }
                    if ('error' in result){
                        displayMessage(result['error'], "errorMessage");
                    }
        } ,
        error: function() {
                    displayMessage("Error when launching simulation. Please check te logs or contact your administrator.", "errorMessage");
        }
    });
}



