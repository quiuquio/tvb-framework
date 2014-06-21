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

/**
 * This file is the main connectivity script.
 */

/**
 * The selection component
 */
var SEL_selector;

/**
 * A mapping from node indices as stored in GVAR_interestAreaNodeIndexes
 * to node id's, as interpreted by the server and used by the selection component.
 * Why: Server identifies a node as an index in the datatype arrays.
 *      Those are not ordered by hemisphere, GVAR_interestAreaNodeIndexes is.
 */
var GVAR_nodeIdxToNodeId;

/**
 * map from node indices to node id's. See doc of GVAR_nodeIdxToNodeId.
 */
function GFUN_mapNodesIndicesToIds(indices){
    var ids = [];
    for(var i=0; i < indices.length; i++){
        var idx = indices[i];
        var id = GVAR_nodeIdxToNodeId[idx];
        if (id != null){
            ids.push(id);
        }else{
            // assert: this should never happen
            displayMessage("Could not map node index " + idx + "to an id.", "errorMessage");
        }
    }
    return ids;
}

/**
 * map from node id's to node indices. See doc of GVAR_nodeIdxToNodeId.
 */
function GFUN_mapNodeIdsToIndices(ids){
    var indices = [];
    for(var i=0; i < ids.length; i++){
        var id = ids[i];
        var idx = GVAR_nodeIdxToNodeId.indexOf(id);

        if (idx !== -1){
            indices.push(idx);
        }else{ // assert: this should never happen
            displayMessage("Could not map node id " + id + "to an index.", "errorMessage");
        }
    }
    return indices;
}

/**
 * Function called when Connectivity Page is loaded and ready for initialization.
 */
function GFUN_initializeConnectivityFull() {
    //Set the mouse listeners for the 3d visualizers: Top DIV, WebGL-edges (div & canvas), WebGL-3D (div & canvas).
    $('#monitorDiv').mousewheel(function(event, delta) { return _customMouseWheelEvent(delta); });
    $('#canvasDiv').mousewheel(function(event, delta) { return _customMouseWheelEvent(delta); });
    $('#GLcanvas').mousewheel(function(event, delta) { return _customMouseWheelEvent(delta); });

    //Draw any additional elements like color picking and hide all tabs but the default one
    ColSch_initColorSchemeParams(GVAR_interestAreaVariables[GVAR_selectedAreaType]['min_val'],
                                 GVAR_interestAreaVariables[GVAR_selectedAreaType]['max_val'], _onColorSchemeChanged);
    drawSimpleColorPicker('nodeColorSelector');
    SEL_createOperationsTable();

    $('#leftSideDefaultSelectedTabId').click();   // enable only the first tab so others don't get exported
    $('#rightSideDefaultSelectedTabId').click();
}

/**
 * When the selection in the selection component has changed update the connectivity viewer parts
 * @private
 */
function _GFUN_onSelectionComponentChange(value){
    var node_ids = [];
    for(var i=0; i < value.length; i++){
        node_ids.push( parseInt(value[i], 10) );
    }
    GVAR_interestAreaNodeIndexes = GFUN_mapNodeIdsToIndices(node_ids);
    refreshTableInterestArea(); //notify matrix display
    GFUNC_updateLeftSideVisualization();
}

/**
 * Update selection component from GVAR_interestAreaNodeIndexes
 */
function GFUN_updateSelectionComponent(){
    SEL_selector.val(GFUN_mapNodesIndicesToIds(GVAR_interestAreaNodeIndexes));
}

/**
 * Initialize selection component used by the connectivity view
 */
function GFUN_initSelectionComponent(selectionGID, hemisphereOrderUrl){
    GVAR_nodeIdxToNodeId = HLPR_readJSONfromFile(hemisphereOrderUrl);
    SEL_selector = TVBUI.regionSelector("#channelSelector", {filterGid: selectionGID});
    TVBUI.quickSelector(SEL_selector, "#selection-text-area", "#loadSelectionFromTextBtn");
    SEL_selector.change(_GFUN_onSelectionComponentChange);

    //sync region filter with initial selection
    var selection = SEL_selector.val();
    var node_ids = [];

    for(var i=0; i < selection.length; i++){
        node_ids.push( parseInt(selection[i], 10) );
    }
    GVAR_interestAreaNodeIndexes = GFUN_mapNodeIdsToIndices(node_ids);
    refreshTableInterestArea();
}

function _onColorSchemeChanged(){
    MATRIX_colorTable();
    if(SELECTED_TAB === CONNECTIVITY_TAB){
        ConnPlotUpdateColors();
    }else if(SELECTED_TAB === CONNECTIVITY_SPACE_TIME_TAB){
        ConnStepPlotInitColorBuffers();
    }
}

function _customMouseWheelEvent(delta) {
    GL_handleMouseWeel(delta);
    GFUNC_updateLeftSideVisualization();
    return false; // prevent default
}

/*
 * -----------------------------------------------------------------------------------------------------
 * -------------The following part of the file contains variables and functions-------------------------
 * -------------related to the connectivity matrix weights and connectivity matrix----------------------
 * -----------------------------------------------------------------------------------------------------
 */
// Used to keep track of the displayed edges. If the value from a certain position (e.g. i, j) from this matrix is 1 than
// between the nodes i and j an edge is drawn in the corresponding 3D visualier 
var GVAR_connectivityMatrix = [];

function GFUNC_storeMinMax(minWeights, minNonZeroWeights, maxWeights, minTracts, minNonZeroTracts, maxTracts) {
    GVAR_interestAreaVariables[1].min_non_zero = parseFloat(minNonZeroWeights);
    GVAR_interestAreaVariables[2].min_non_zero = parseFloat(minNonZeroTracts);
    GVAR_interestAreaVariables[1].min_val = parseFloat(minWeights);
    GVAR_interestAreaVariables[2].min_val = parseFloat(minTracts);
    GVAR_interestAreaVariables[1].max_val = parseFloat(maxWeights);
    GVAR_interestAreaVariables[2].max_val = parseFloat(maxTracts);
}

/**
 * Populate the GVAR_connectivityMatrix with values equal to zero.
 *
 * @param lengthOfConnectivityMatrix the number of rows/columns that has to have the connectivityMatrix.
 */
function GFUNC_initConnectivityMatrix(lengthOfConnectivityMatrix) {
    //todo-io: check if we can do this init in other places
    for (var i = 0; i < lengthOfConnectivityMatrix; i++) {
        var row = [];
        for (var j = 0; j < lengthOfConnectivityMatrix; j++) {
            row.push(0);
        }
        GVAR_connectivityMatrix.push(row);
    }
}


function GFUNC_recomputeMinMaxW() {
    var matrix = GVAR_interestAreaVariables[GVAR_selectedAreaType];
    matrix.max_val = -Infinity;
    matrix.min_val = Infinity;
    matrix.min_non_zero = Infinity;

    for (var i=0; i<matrix.values.length;i++) {
        for (var j=0; j<matrix.values[i].length; j++) {
            var value = matrix.values[i][j];
            if (value < matrix.min_val) {
                matrix.min_val = value;
            }
            if (value > matrix.max_val) {
                matrix.max_val = value;
            }
            if(value != 0 && value < matrix.min_non_zero){
                matrix.min_non_zero = value;
            }
        }
    }
}

function GFUNC_initTractsAndWeights(fileWeights, fileTracts) {
    GVAR_interestAreaVariables[1].values = HLPR_readJSONfromFile(fileWeights);
    GVAR_interestAreaVariables[2].values = HLPR_readJSONfromFile(fileTracts);
}


/*
 * --------------------------------------------------------------------------------------------------------
 * -----------------------The next part handles the context menu update -----------------------------------
 * --------------------------------------------------------------------------------------------------------
 */
function GFUNC_updateContextMenu(selectedNodeIndex, selectedNodeLabel, isAnyComingInLinesChecked, isAnyComingOutLinesChecked) {
    /*
     * When clicking on a new node from the connectivity 3D visualization, create a specific context menu depending on
     * conditions like (was a node selected, is the node part of interest area, are the lines already drawn)
     */
    //todo-mh: jquery toggle will simplify these
    if (selectedNodeIndex == -1) {
        $('#nodeNameId').text("Please select a node...");
        $("#addNodeToInterestAreaItemId").hide();
        $("#stimulusItemId").hide();
        $("#removeNodeFromInterestAreaItemId").hide();
        $("#drawComingOutLinesForSelectedNodeItemId").hide();
        $("#removeComingOutLinesForSelectedNodeItemId").hide();
        $("#drawComingInLinesForSelectedNodeItemId").hide();
        $("#removeComingInLinesForSelectedNodeItemId").hide();
        $("#setCurrentColorForNodeItemId").hide();
    } else {
        $('#nodeNameId').text("Node: " + selectedNodeLabel);
        $('#selectedNodeIndex').val(selectedNodeIndex);

        $("#stimulusItemId").show();

        if (GFUNC_isNodeAddedToInterestArea(selectedNodeIndex)) {
            $("#addNodeToInterestAreaItemId").hide();
            $("#removeNodeFromInterestAreaItemId").show();
        } else {
            $("#addNodeToInterestAreaItemId").show();
            $("#removeNodeFromInterestAreaItemId").hide();
        }

        if (isAnyComingOutLinesChecked) {
            $("#removeComingOutLinesForSelectedNodeItemId").show();
            $("#drawComingOutLinesForSelectedNodeItemId").hide();
        } else {
            $("#removeComingOutLinesForSelectedNodeItemId").hide();
            $("#drawComingOutLinesForSelectedNodeItemId").show();
        }
        if (isAnyComingInLinesChecked) {
            $("#removeComingInLinesForSelectedNodeItemId").show();
            $("#drawComingInLinesForSelectedNodeItemId").hide();
        } else {
            $("#removeComingInLinesForSelectedNodeItemId").hide();
            $("#drawComingInLinesForSelectedNodeItemId").show();
        }

        $("#setCurrentColorForNodeItemId").show();
    }
}

/**
 * jQuery's contextMenu plugin behaves differently on different browsers so here we patch it to
 * make it work; replaced <code>x=e.pageX, y=e.pageY</code> with <code>x=e.clientX, y=e.clientY</code>
 */
function patchContextMenu() {
    $.contextMenu.show = function(t,e) {
        var cmenu=this, x=e.clientX, y=e.clientY;
        cmenu.target = t; // Preserve the object that triggered this context menu so menu item click methods can see it
        if (cmenu.beforeShow()!==false) {
            // If the menu content is a function, call it to populate the menu each time it is displayed
            if (cmenu.menuFunction) {
                if (cmenu.menu) { $(cmenu.menu).remove(); }
                cmenu.menu = cmenu.createMenu(cmenu.menuFunction(cmenu,t),cmenu);
                cmenu.menu.css({display:'none'});
                $(cmenu.appendTo).append(cmenu.menu);
            }
            var $c = cmenu.menu;
            x+=cmenu.offsetX; y+=cmenu.offsetY;
            var pos = cmenu.getPosition(x,y,cmenu,e); // Extracted to method for extensibility
            cmenu.showShadow(pos.x,pos.y,e);
            // Resize the iframe if needed
            if (cmenu.useIframe) {
                $c.find('iframe').css({width:$c.width()+cmenu.shadowOffsetX+cmenu.shadowWidthAdjust,height:$c.height()+cmenu.shadowOffsetY+cmenu.shadowHeightAdjust});
            }
            $c.css( {top:pos.y+"px", left:pos.x+"px", position:"fixed",zIndex:9999} )[cmenu.showTransition](cmenu.showSpeed,((cmenu.showCallback)?function(){cmenu.showCallback.call(cmenu);}:null));
            cmenu.shown=true;
            $(document).one('click',null,function(){cmenu.hide()}); // Handle a single click to the document to hide the menu
        }
    };
}

/*
 * Functions that initialize the points and labels data and variables to hold these are
 * defined below.
 */
// contains the points read from the file 'position.txt' file (the points for the connectivity matrix);
// each element of this array represents an array of 3 elements (the X, Y, Z coordinates of the point).
var GVAR_positionsPoints;
// contains the labels for the points from the connectivity matrix.
var GVAR_pointsLabels = [];
// The intereset area under which this connectivity was saved.
var GVAR_baseSelection = '';

function GVAR_initPointsAndLabels(filePositions, urlLabels) {
    var pointsAndLabels = HLPR_readPointsAndLabels(filePositions, urlLabels);
    GVAR_positionsPoints = pointsAndLabels[0];
    GVAR_pointsLabels = pointsAndLabels[1];
    GVAR_additionalXTranslationStep = -pointsAndLabels[2];
    GVAR_additionalYTranslationStep = -pointsAndLabels[3];
}

/*
 * ----------------------------------------------------------------------------------------------------------
 * ----- Code which allows a user to draw with a different color all the nodes with a positive weight -------
 * ----------------------------------------------------------------------------------------------------------
 */
var GVAR_connectivityNodesWithPositiveWeight = [];

function GFUNC_removeNodeFromNodesWithPositiveWeight(selectedNodeIndex) {
    if (GFUNC_isIndexInNodesWithPositiveWeight(selectedNodeIndex)) {
        var elemIdx = $.inArray(selectedNodeIndex, GVAR_connectivityNodesWithPositiveWeight);
        GVAR_connectivityNodesWithPositiveWeight.splice(elemIdx, 1);
    }
}

function GFUNC_addNodeToNodesWithPositiveWeight(selectedNodeIndex) {
    if (!GFUNC_isIndexInNodesWithPositiveWeight(selectedNodeIndex)) {
        GVAR_connectivityNodesWithPositiveWeight.push(selectedNodeIndex);
    }
}

/**
 * @return {boolean}
 */
function GFUNC_isIndexInNodesWithPositiveWeight(nodeIndex) {
    var elemIdx = $.inArray(nodeIndex, GVAR_connectivityNodesWithPositiveWeight);
    return elemIdx !== -1;
}

/*
 * ------------------------------------------------------------------------------------------------
 * ----- Method related to handling the interest area of nodes are in the following section -------
 * ------------------------------------------------------------------------------------------------
 */
var GVAR_interestAreaNodeIndexes = [];

function GFUNC_removeNodeFromInterestArea(selectedNodeIndex) {
    if (GFUNC_isNodeAddedToInterestArea(selectedNodeIndex)) {
          var elemIdx = $.inArray(selectedNodeIndex, GVAR_interestAreaNodeIndexes);
        GVAR_interestAreaNodeIndexes.splice(elemIdx,1);
    }
}

function GFUNC_addNodeToInterestArea(selectedNodeIndex) {
    if (!GFUNC_isNodeAddedToInterestArea(selectedNodeIndex)) {
        GVAR_interestAreaNodeIndexes.push(selectedNodeIndex);
    }
}

/**
 * @return {boolean}
 */
function GFUNC_isNodeAddedToInterestArea(nodeIndex) {
    var elemIdx = $.inArray(nodeIndex, GVAR_interestAreaNodeIndexes);
    return elemIdx !== -1;
}

function GFUNC_toggleNodeInInterestArea(nodeIndex){
    if (GFUNC_isNodeAddedToInterestArea(nodeIndex)) {
        GFUNC_removeNodeFromInterestArea(nodeIndex);
    } else {
        GFUNC_addNodeToInterestArea(nodeIndex);
    }
}
/*
 * ------------------------------------------------------------------------------------------------
 * ------ Global functions related to selection handling, like saving loading etc. ----------------
 * ------------------------------------------------------------------------------------------------
 */
/**
 * @deprecated
 */
function GFUNC_doSelectionSave() {
    var selectionName = $("#currentSelectionName").val();
    var connectivityGid = $("#connectivityGid").val();

    if (selectionName.length > 0) {
        doAjaxCall({
            type: "POST",
            url: '/flow/store_measure_points_selection/' + selectionName,
            data: {"selection": JSON.stringify(GVAR_interestAreaNodeIndexes),
                   "datatype_gid": connectivityGid},
            success: function(r) {
                var response = $.parseJSON(r);
                if (response[0]) {
                    SEL_populateAvailableSelections();
                    displayMessage(response[1], "infoMessage");
                    var selectionDropdown = document.getElementById('availableSelectionsList');
                    for (var i = 0; i < selectionDropdown.options.length; i++) {
                        if (selectionDropdown.options[i].text == selectionName) {
                            selectionDropdown.selectedIndex = i;
                            break;
                        }
                    }
                } else {
                    displayMessage(response[1], "errorMessage");
                }
            } ,
            error: function() {
                displayMessage("Selection was not saved properly.", "errorMessage");
            }
        });
    } else {
        displayMessage("Selection name must not be empty.", "errorMessage");
    }
}

/**
 * @deprecated
 */
function GFUNC_refreshWithNewSelection(selectComp) {
    var selectedOption = selectComp.options[selectComp.selectedIndex];
    var selectionNodes = selectedOption.value.replace('{', '').replace('}', '').split(',');
    for (var i = 0; i < NO_POSITIONS; i++) {
        GFUNC_removeNodeFromInterestArea(i);
    }
    for (var ii = 0; ii < selectionNodes.length; ii++) {
        var idx = GVAR_pointsLabels.indexOf(selectionNodes[ii]);
        if (idx >= 0) {
            GFUNC_addNodeToInterestArea(idx);
        }
    }
    if (selectComp.selectedIndex == 0) {
        //TODO: this could be done differently in case the 'New selection' value is not at first index
        //However in current generation of select component this will always be the case
        document.getElementById('currentSelectionName').value = '';
    } else {
        document.getElementById('currentSelectionName').value = selectedOption.text;
    }
    refreshTableInterestArea();
    GFUNC_refreshOnContextChange();
    SEL_refreshSelectionTable();
}

/**
 * Methods to add/remove the entire connectivity matrix to the interest area.
 * @deprecated
 */
function GFUNC_addAllMatrixToInterestArea() {
    for (var i = 0; i < NO_POSITIONS; i++) {
        if (!GFUNC_isNodeAddedToInterestArea(i)) {
            GFUNC_addNodeToInterestArea(i);
        }
    }
    refreshTableInterestArea();
    GFUNC_refreshOnContextChange();
    SEL_refreshSelectionTable();
}

/**
 * @deprecated
 */
function GFUNC_removeAllMatrixFromInterestArea() {
    for (var i = 0; i < NO_POSITIONS; i++) {
        if (GFUNC_isNodeAddedToInterestArea(i)) {
            GFUNC_removeNodeFromInterestArea(i);
        }
    }
    refreshTableInterestArea();
    GFUNC_refreshOnContextChange();
    SEL_refreshSelectionTable();
}
/*
 * --------------------------------------------------------------------------------------------------
 * -------------Only functions related to changing the tabs are below this point.--------------------
 * --------------------------------------------------------------------------------------------------
 */

/*
 * -------------------------------Right side tab functions below------------------------------------
 */
var GVAR_selectedAreaType = 1;

// contains the data for the two possible visualization tables (weights and tracts)

var GVAR_interestAreaVariables = {
    1 : {'prefix': 'w', 'values':[],
         'min_val':0,
         'max_val':0,
         'legend_div_id': 'weights-legend'},
    2 : {'prefix': 't', 'values':[],
         'min_val':0,
         'max_val':0,
         'legend_div_id': 'tracts-legend'}
};

function hideRightSideTabs(selectedHref) {
    $(".matrix-switcher li").each(function (){
        $(this).removeClass('active');
    });
    selectedHref.parentElement.className = 'active';
    $(".matrix-viewer").each(function () {
        $(this).hide();
    });
}

function showWeightsTable() {
    $("#div-matrix-weights").show();
    GVAR_selectedAreaType = 1;
    refreshTableInterestArea();
    MATRIX_colorTable();
}

function showTractsTable() {
    $("#div-matrix-tracts").show();
    GVAR_selectedAreaType = 2;
    refreshTableInterestArea();
    MATRIX_colorTable();
}


/*
 * ------------------------------Left side tab functions below------------------------------------
 */
var CONNECTIVITY_TAB = 1;
var CONNECTIVITY_2D_TAB = 2;
var CONNECTIVITY_SPACE_TIME_TAB = 4;
var SELECTED_TAB = CONNECTIVITY_TAB;

function GFUNC_updateLeftSideVisualization() {
    if (SELECTED_TAB === CONNECTIVITY_TAB) {
         drawScene();
    }
    if (SELECTED_TAB === CONNECTIVITY_2D_TAB) {
        C2D_displaySelectedPoints();
    }
    if (SELECTED_TAB === CONNECTIVITY_SPACE_TIME_TAB) {
        drawSceneSpaceTime();
    }
}
/**
 * @deprecated
 */
function GFUNC_refreshOnContextChange() {
     GFUNC_updateLeftSideVisualization();
     var selection_button = $("#save-selection-button");
     selection_button.unbind('click');
     selection_button.bind('click', function() {GFUNC_doSelectionSave()});
     selection_button.removeClass('action-idle');
}

function hideLeftSideTabs(selectedHref) {
    $(".view-switcher li").each(function () {
        $(this).removeClass('active');
    });
    selectedHref.parentElement.className = 'active';
    $(".monitor-container").each(function () {
        $(this).hide();
        $(this).find('canvas').each(function () {
            if (this.drawForImageExport) {           // remove redrawing method such that only current view is exported
                this.drawForImageExport = null;
            }
        });
    });
}

/**
 * Subscribes the gl canvases to resize events
 */
function GFUNC_bind_gl_resize_handler(){
    var timeoutForResizing;

    function resizeHandler(){
        var activeCanvasId;
        if(SELECTED_TAB === CONNECTIVITY_TAB){
            activeCanvasId = CONNECTIVITY_CANVAS_ID;
        }
        if(SELECTED_TAB === CONNECTIVITY_SPACE_TIME_TAB){
            activeCanvasId = CONNECTIVITY_SPACE_TIME_CANVAS_ID;
        }
        // Only update size info on the active gl canvas & context.
        // The inactive ones will do this on init.
        updateGLCanvasSize(activeCanvasId);
        // Because the connectivity 3d views redraw only on mouse move we explicitly redraw
        GFUNC_updateLeftSideVisualization();
    }

    $(window).resize(function(){
        // as resize might be called with high frequency we throttle the event
        // resize events constantly cancel the handler and reschedule
        clearTimeout(timeoutForResizing);
        timeoutForResizing = setTimeout(resizeHandler, 250);
    });
}

function startConnectivity() {
    SELECTED_TAB = CONNECTIVITY_TAB;
    $("#monitor-3Dedges-id").show();
    document.getElementById(CONNECTIVITY_CANVAS_ID).redrawFunctionRef = drawScene;         // interface-like function used in HiRes image exporting
    connectivity_initCanvas();
    connectivity_startGL(false);
    GFUNC_bind_gl_resize_handler();
    // Sync size to parent. While the other tabs had been active the window may have resized.
    updateGLCanvasSize(CONNECTIVITY_CANVAS_ID);
    drawScene();
}

function start2DConnectivity(idx) {
    $("#monitor-2D-id").show().find('canvas').each(function() {
        // interface-like methods needed for exporting HiRes images
        this.drawForImageExport = __resizeCanvasBeforeExport;
        this.afterImageExport   = __restoreCanvasAfterExport;
    });
    if (idx == 0) {
        C2D_selectedView = 'left';
        C2D_shouldRefreshNodes = true;
    }
    if (idx == 1) {
        C2D_selectedView = 'both';
        C2D_shouldRefreshNodes = true;
    }
    if (idx == 2) {
        C2D_selectedView = 'right';
        C2D_shouldRefreshNodes = true;
    }
    C2D_displaySelectedPoints();
    SELECTED_TAB = CONNECTIVITY_2D_TAB;
}

function startMPLH5ConnectivityView() {
    $("#monitor-mplh5").show();
    initMPLH5CanvasForExportAsImage(mplh5_figureNo)
}

function startSpaceTimeConnectivity() {
    SELECTED_TAB = CONNECTIVITY_SPACE_TIME_TAB;
    $("#monitor-plot-id").show();
    document.getElementById(CONNECTIVITY_SPACE_TIME_CANVAS_ID).redrawFunctionRef = drawSceneSpaceTime;   // interface-like function used in HiRes image exporting
    connectivitySpaceTime_startGL();
    GFUNC_bind_gl_resize_handler();
    // Sync size to parent. While the other tabs had been active the window might have resized.
    updateGLCanvasSize(CONNECTIVITY_SPACE_TIME_CANVAS_ID);
    drawSceneSpaceTime();
}

