// TODO: add legend, labels on axes, color scheme support
var TsVol = { 
    ctx: null,                  // the context for drawing on current canvas
    currentQuadrant: 0,         // the quadrant we're in
    quadrants: [],              // the quadrants array
    minimumValue: null,         // minimum value of the dataset
    maximumValue: null,         // maximum value of the dataset
    voxelSize: null,
    volumeOrigin: null,         // volumeOrigin is not used for now                                                       // is irrelevant; if needed, use it _setQuadrant
    selectedEntity: [0, 0, 0],  // the selected voxel; [i, j, k]
    entitySize: [0, 0, 0],
    quadrantHeight: null,
    quadrantWidth: null,
    currentTimePoint: 0,
    playbackRate: 99,           // This is a not acurate lower limit for playback speed.
    playerIntervalID: null,     // ID from the player's setInterval().
    bufferSize: 1,              // How many time points do we load each time?
    bufferL2Size: 1,            // How many sets of buffers can we keep at the same time?
    lookAhead: 5,               // How many sets of buffers should be loaded ahead of us each time?
    data: {},                   // The actual data to be drawn to canvas
    bufferL2: {},               // Cotains all data loaded and preloaded, limited by memory
    dataAddress: "",            // Used to contain the python URL for each time point.
    requestQueue: []            // Used to avoid requesting a time point set while we are waiting for it.
};

var Quadrant = function (params) {                // this keeps all necessary data for drawing
    this.index = params.index || 0;                // in a quadrant
    this.axes = params.axes || {x: 0, y: 1};       // axes represented in current quad; i=0, j=1, k=2
    this.entityWidth = params.entityWidth || 0;    // width and height of one voxel in current quad
    this.entityHeight = params.entityHeight || 0;
    this.offsetX = params.offsetX || 0;            // the offset of the drawing relative to the quad
    this.offsetY = params.offsetY || 0;
};

/**
 * Make all the necessary initialisations and draws the default view, with the center voxel selected
 * @param dataUrls  Urls containing data slices from server
 * @param minValue  The minimum value for all the slices
 * @param maxValue  The maximum value for all the slices
 * @param volOrigin The origin of the rendering; irrelevant in 2D, for now
 * @param sizeOfVoxel   How the voxel is sized on each axis; [xScale, yScale, zScale]
 * @param voxelUnit The unit used for this rendering ("mm", "cm" etc)
 */
function startVisualiser(dataUrls, minValue, maxValue, volOrigin, sizeOfVoxel, voxelUnit) {
    var canvas = document.getElementById("volumetric-ts-canvas");
    if (!canvas.getContext) {
        displayMessage('You need a browser with canvas capabilities, to see this demo fully!', "errorMessage");
        return;
    }

    TsVol.volumeOrigin = $.parseJSON(volOrigin)[0];
    TsVol.voxelSize    = $.parseJSON(sizeOfVoxel);

    canvas.width  = $(canvas).parent().width();            // fill the screen on width
    canvas.height = canvas.width / 3;                      // three quadrants + some space for labeling
    TsVol.quadrantHeight = canvas.width / 3;               // quadrants are squares
    TsVol.quadrantWidth = TsVol.quadrantHeight

    TsVol.ctx = canvas.getContext("2d");
    TsVol.ctx.beginPath();
    TsVol.ctx.rect(-2, -2, canvas.width, canvas.height);
    TsVol.ctx.lineWidth = 2;
    TsVol.ctx.strokeStyle = 'black';
    TsVol.ctx.stroke();

    dataUrls = $.parseJSON(dataUrls);
    TsVol.dataAddress = dataUrls[0];
    dataSize = dataUrls[1];

    var query = TsVol.dataAddress+"from_idx="+(0)+";to_idx="+(1);
    TsVol.data = HLPR_readJSONfromFile(query);

    TsVol.minimumValue = minValue;
    TsVol.maximumValue = maxValue;
    timeLength = 1452; //timeLength = TsVol.data.length-1;

    _setupQuadrants();

    TsVol.selectedEntity[0] = Math.floor(TsVol.data[0].length / 2);       // set the center entity as the selected one
    TsVol.selectedEntity[1] = Math.floor(TsVol.data[0][0].length / 2);
    TsVol.selectedEntity[2] = Math.floor(TsVol.data[0][0][0].length / 2);

    TsVol.entitySize[0] = Math.floor(TsVol.data[0].length);           // get entities number of voxels
    TsVol.entitySize[1] = Math.floor(TsVol.data[0][0].length);
    TsVol.entitySize[2] = Math.floor(TsVol.data[0][0][0].length);
    TsVol.entitySize[3] = Math.floor(TsVol.data.length);              // get entities number of time points

    _setupBuffersSize();

    //'linear', 'rainbow', 'hotcold', 'TVB', 'sparse', 'light-hotcold', 'light-TVB'
    ColSch_setColorScheme("rainbow", false);

    TsVol.data = getSliceAtTime(TsVol.currentTimePoint);
    drawSceneFunctional(TsVol.currentTimePoint);

    window.setInterval(streamToBuffer, TsVol.playbackRate);
    window.setInterval(freeBuffer, TsVol.playbackRate*10);  
}

function asyncRequest(fileName, sect) {
    var fileData = null;
    TsVol.requestQueue.push(sect);
    console.log("TsVol.requestQueue push:", TsVol.requestQueue);
    doAjaxCall({
        async:true,
        url:fileName,
        methos:"GET",
        mimeType:"text/plain",
        success:function(r){
            TsVol.bufferL2[sect] = {};
            parseAsync(r, function(json){
                TsVol.bufferL2[sect] = json;
                var index = TsVol.requestQueue.indexOf(sect);
                if (index > -1) {
                    TsVol.requestQueue.splice(index, 1);
                    console.log("TsVol.requestQueue pop", TsVol.requestQueue);
                }   
            });
        }
    });
}

    /****WEB WORKER****/
    // We build a worker from an anonymous function body
    // TODO: Create a nice inline worker-wrapper function
    // that returns a blob.
    var blobURL = URL.createObjectURL( 
        new Blob([ 
            '(',
            // our worker goes inside this function
            function(){
                self.addEventListener( 'message', function (e){
                    var data = e.data;
                    var json = JSON.parse( data );
                    self.postMessage( json );
                    self.close();
                }, false );
            }.toString(),
            ')()' ], 
        { type: 'application/javascript' } 
        ) 
    );
    /****END OF WEB WORKER****/

function parseAsync(data, callback){
    var worker;
    var json;
    if( window.Worker ){
        worker = new Worker( blobURL );
        worker.addEventListener( 'message', function (e){
            json = e.data;
            callback( json );
        }, false);
        worker.postMessage( data );
        return;
    }
    else{
        json = JSON.parse( data );
        callback( json );
    }
}

function freeBuffer(){
    var section = Math.floor(TsVol.currentTimePoint/TsVol.bufferSize);
    var bufferedElements = Object.keys(TsVol.bufferL2).length;
    if(bufferedElements > TsVol.bufferL2Size){
        for(var idx in TsVol.bufferL2){
            if (idx < (section-TsVol.bufferL2Size/2)%timeLength || idx > (section+TsVol.bufferL2Size/2)%timeLength){
                //console.log("erase:", idx)
                delete TsVol.bufferL2[idx];
            }
        }
    }
}

function streamToBuffer(){
    var section = Math.floor(TsVol.currentTimePoint/TsVol.bufferSize);
    var maxSections = Math.floor(timeLength/TsVol.bufferSize);
    var from = "from_idx="+TsVol.currentTimePoint;
    var to = ";to_idx="+(TsVol.bufferSize+TsVol.currentTimePoint)%timeLength;
    var query = TsVol.dataAddress+from+to;
    for(var i = 0; i <= TsVol.lookAhead; i++){
            var tmp = (section+i)%maxSections;
            if(!TsVol.bufferL2[tmp] && TsVol.requestQueue.indexOf(tmp) < 0){
                asyncRequest(query, tmp);
            }
        }
}

function getSliceAtTime(t){
    var buffer;
    var from = "from_idx="+t;
    var to = ";to_idx="+(TsVol.bufferSize+t)%timeLength;
    var query = TsVol.dataAddress+from+to;
    var section = Math.floor(t/TsVol.bufferSize);
    for(var i in TsVol.requestQueue){
        if( TsVol.requestQueue[i] < section ){
            TsVol.requestQueue.splice(i, 1);
        }
    }   
    if(TsVol.bufferL2[section]){
        buffer = TsVol.bufferL2[section];
    }else{
        buffer = HLPR_readJSONfromFile(query);
        TsVol.bufferL2[section] = buffer;
    }
    return buffer[t%TsVol.bufferSize];
}


// ==================================== DRAWING FUNCTIONS START =============================================

/**
 * Draws the current view depending on the selected entity
 */
// TODO: since only two dimensions change at every time, redraw just those quadrants
// NOTE: this is true only when we navigate, not when we play the timeseries
function drawSceneFunctional(tIndex) {
    var i, j, k, ii, jj, kk;
    
    // if we pass no tIndex the function will play
    // from the TsVol.currentTimePoint and increment it
    if(tIndex == null){
        tIndex = TsVol.currentTimePoint;
        TsVol.currentTimePoint++;
        TsVol.currentTimePoint = TsVol.currentTimePoint%timeLength;
        TsVol.data = getSliceAtTime(tIndex);
    }
    _setCtxOnQuadrant(0);
    TsVol.ctx.fillStyle = getGradientColorString(TsVol.minimumValue, TsVol.minimumValue, TsVol.maximumValue);
    TsVol.ctx.fillRect(0, 0, TsVol.ctx.canvas.width, TsVol.ctx.canvas.height);
    
    for (j = 0; j < TsVol.data[0].length; ++j)
        for (i = 0; i < TsVol.data.length; ++i)
            drawVoxel(i, j, TsVol.data[i][j][TsVol.selectedEntity[2]]);
    drawMargin();

    _setCtxOnQuadrant(1);
    for (k = 0; k < TsVol.data[0][0].length; ++k)
        for (jj = 0; jj < TsVol.data[0].length; ++jj)
            drawVoxel(k, jj, TsVol.data[TsVol.selectedEntity[0]][jj][k]);
    drawMargin();

    _setCtxOnQuadrant(2);
    for (kk = 0; kk < TsVol.data[0][0].length; ++kk)
        for (ii = 0; ii < TsVol.data.length; ++ii)
            drawVoxel(kk, ii, TsVol.data[ii][TsVol.selectedEntity[1]][kk]);
    drawMargin();
    drawNavigator();
    updateMoviePlayerSlider();  
}

/**
 * Draws the voxel set at (line, col) in the current quadrant, and colors it according to its value.
 * This function now nothing about the time point. 
 */
function drawVoxel(line, col, value) {
    TsVol.ctx.fillStyle = getGradientColorString(value, TsVol.minimumValue, TsVol.maximumValue);
    // col increases horizontally and line vertically, so col represents the X drawing axis, and line the Y
	TsVol.ctx.fillRect(col * TsVol.currentQuadrant.entityWidth, line * TsVol.currentQuadrant.entityHeight,
	                 TsVol.currentQuadrant.entityWidth+1, TsVol.currentQuadrant.entityHeight+1);
}

/**
 * Draws the cross-hair on each quadrant, on the <code>TsVol.selectedEntity</code>
 */
function drawNavigator() {
    TsVol.ctx.save();
    TsVol.ctx.beginPath();

    for (var quadIdx = 0; quadIdx < 3; ++quadIdx) {
        _setCtxOnQuadrant(quadIdx);
        var x = TsVol.selectedEntity[TsVol.currentQuadrant.axes.x] * TsVol.currentQuadrant.entityWidth + TsVol.currentQuadrant.entityWidth / 2;
        var y = TsVol.selectedEntity[TsVol.currentQuadrant.axes.y] * TsVol.currentQuadrant.entityHeight + TsVol.currentQuadrant.entityHeight / 2;
        drawCrossHair(x, y);
    }
    TsVol.ctx.strokeStyle = "red";
    TsVol.ctx.lineWidth = 3;
    TsVol.ctx.stroke();
    TsVol.ctx.restore();
}

/**
 * Draws a 20px X 20px cross hair on the <code>TsVol.currentQuadrant</code>, at the specified x and y
 */
function drawCrossHair(x, y) {
    TsVol.ctx.moveTo(Math.max(x - 20, 0), y);                              // the horizontal line
    TsVol.ctx.lineTo(Math.min(x + 20, TsVol.quadrantWidth), y);
    TsVol.ctx.moveTo(x, Math.max(y - 20, 0));                              // the vertical line
    TsVol.ctx.lineTo(x, Math.min(y + 20, TsVol.quadrantHeight));
}

/**
 * Draws a 5px rectangle around the <code>TsVol.currentQuadrant</code>
 */
function drawMargin(){
    //_setCtxOnQuadrant(0);
    TsVol.ctx.beginPath();
    TsVol.ctx.rect(2.5, 0, TsVol.quadrantWidth-2, TsVol.quadrantHeight);
    TsVol.ctx.lineWidth = 5;
    TsVol.ctx.strokeStyle = 'black';
    TsVol.ctx.stroke();
}

// ==================================== DRAWING FUNCTIONS  END  =============================================

// ==================================== PRIVATE FUNCTIONS START =============================================

/**
 * Sets the <code>TsVol.currentQuadrant</code> and applies transformations on context depending on that
 *
 * @param quadIdx Specifies which of <code>quadrants</code> is selected
 * @private
 */
/* TODO: make it use volumeOrigin; could be like this:
 * <code>TsVol.ctx.setTransform(1, 0, 0, 1, volumeOrigin[TsVol.currentQuadrant.axes.x], volumeOrigin[TsVol.currentQuadrant.axes.y])</code>
 *       if implemented, also change the picking to take it into account
 */
function _setCtxOnQuadrant(quadIdx) {
    TsVol.currentQuadrant = TsVol.quadrants[quadIdx];
    TsVol.ctx.setTransform(1, 0, 0, 1, 0, 0);                              // reset the transformation
    TsVol.ctx.translate(quadIdx * TsVol.quadrantWidth + TsVol.currentQuadrant.offsetX, TsVol.currentQuadrant.offsetY)
}

/**
 * Returns the number of elements on the given axis
 * @param axis The axis whose length is returned; i=0, j=1, k=2
 * @returns {*}
 * @private
 */
function _getDataSize(axis) {
    switch (axis) {
        case 0:     return TsVol.data[0].length;
        case 1:     return TsVol.data[0][0].length;
        case 2:     return TsVol.data[0][0][0].length;
    }
}

/**
 * Computes the actual dimension of one entity from the specified axes
 * @param xAxis The axis to be represented on X (i=0, j=1, k=2)
 * @param yAxis The axis to be represented on Y (i=0, j=1, k=2)
 * @returns {{width: number, height: number}} Entity width and height
 */
function _getEntityDimensions(xAxis, yAxis) {
    var scaleOnWidth  = TsVol.quadrantWidth  / (_getDataSize(xAxis) * TsVol.voxelSize[xAxis]);
    var scaleOnHeight = TsVol.quadrantHeight / (_getDataSize(yAxis) * TsVol.voxelSize[yAxis]);
    var scale = Math.min(scaleOnHeight, scaleOnWidth);
    return {width: TsVol.voxelSize[xAxis] * scale, height: TsVol.voxelSize[yAxis] * scale}
}

/**
 * Initializes the <code>TsVol.quadrants</code> with some default axes and sets their properties
 */
function _setupQuadrants() {
    TsVol.quadrants.push(new Quadrant({ index: 0, axes: {x: 1, y: 0} }));
    TsVol.quadrants.push(new Quadrant({ index: 1, axes: {x: 1, y: 2} }));
    TsVol.quadrants.push(new Quadrant({ index: 2, axes: {x: 0, y: 2} }));

    for (var quadIdx = 0; quadIdx < TsVol.quadrants.length; quadIdx++) {
        var entityDimensions = _getEntityDimensions(TsVol.quadrants[quadIdx].axes.x, TsVol.quadrants[quadIdx].axes.y);
        TsVol.quadrants[quadIdx].entityHeight = entityDimensions.height;
        TsVol.quadrants[quadIdx].entityWidth  = entityDimensions.width;
        var drawingHeight = _getDataSize(TsVol.quadrants[quadIdx].axes.y) * TsVol.quadrants[quadIdx].entityHeight;
        var drawingWidth  = _getDataSize(TsVol.quadrants[quadIdx].axes.x) * TsVol.quadrants[quadIdx].entityWidth;
        //TsVol.quadrants[quadIdx].offsetY = (TsVol.quadrantHeight - drawingHeight) / 2;
        //TsVol.quadrants[quadIdx].offsetX = (TsVol.quadrantWidth  - drawingWidth)  / 2;
        TsVol.quadrants[quadIdx].offsetY = 0;
        TsVol.quadrants[quadIdx].offsetX = 0;
    }
}

function _setupBuffersSize() {
    var tpSize = TsVol.entitySize[0]*TsVol.entitySize[1]*TsVol.entitySize[2];
    //enough to be avoid waisting bandwidth and to parse the json smoothly
    while(TsVol.bufferSize*tpSize <= 1000000){ 
        TsVol.bufferSize++;
    }
    //Very safe measure to avoid crashes. Tested on Chrome.
    while(TsVol.bufferSize*tpSize*TsVol.bufferL2Size <= 157286400){ 
        TsVol.bufferL2Size++;
    }
    console.log(TsVol.bufferSize,TsVol.bufferL2Size);
}

// ==================================== PRIVATE FUNCTIONS  END  =============================================

// ==================================== PICKING RELATED CODE START ==========================================

function customMouseDown() {
    this.mouseDown = true;                                           // `this` is the canvas
}

function customMouseUp() {
    this.mouseDown = false;
}

/**
 * Implements picking and redraws the scene. Updates sliders too.
 */
function customMouseMove(e) {
    if (!this.mouseDown){
        return;
    }
    //fix for Firefox
    var xpos = e.pageX-$('#volumetric-ts-canvas').offset().left;
    var ypos = e.pageY-$('#volumetric-ts-canvas').offset().top;
    var selectedQuad = TsVol.quadrants[Math.floor(xpos / TsVol.quadrantWidth)];
    // check if it's inside the quadrant but outside the drawing
    if (ypos < selectedQuad.offsetY || ypos >= TsVol.quadrantHeight - selectedQuad.offsetY ||
        xpos < TsVol.quadrantWidth * selectedQuad.index + selectedQuad.offsetX ||
        xpos >= TsVol.quadrantWidth * (sele
            ctedQuad.index + 1) - selectedQuad.offsetX)
        return;
    var selectedEntityOnX = Math.floor((xpos % TsVol.quadrantWidth) / selectedQuad.entityWidth);
    var selectedEntityOnY = Math.floor((ypos - selectedQuad.offsetY) / selectedQuad.entityHeight);
    TsVol.selectedEntity[selectedQuad.axes.x] = selectedEntityOnX;
    TsVol.selectedEntity[selectedQuad.axes.y] = selectedEntityOnY;
    updateSliders();
    drawSceneFunctional(TsVol.currentTimePoint)
}

// ==================================== PICKING RELATED CODE  END  ==========================================

// ==================================== UI RELATED CODE START ===============================================
/**
 * Functions that calls all the setup functions for the main UI of the time series volume visualizer.
*/
function startUserInterface(){
    startButtomSet();
    startPositionSliders();
    startMovieSlider();
}

/**
 * Function that creates all the buttons for playing, stoping and seeking time points.
*/
function startButtomSet(){
	// we setup every buttom
    var container = $('#buttons')
    var first = $('<button id="first">').button({icons:{primary:"ui-icon-seek-first"}});
    var prev = $('<button id="prev">').button({icons:{primary:"ui-icon-seek-prev"}});
    var playButton = $('<button id="play">').button({icons:{primary:"ui-icon-play"}});
    var stopButton = $('<button id="stop">').button({icons:{primary:"ui-icon-stop"}});
    var next = $('<button id="next">').button({icons:{primary:"ui-icon-seek-next"}});
    var end = $('<button id="end">').button({icons:{primary:"ui-icon-seek-end"}});

    // put the buttoms on an array for easier manipulation
    buttonsArray = [first, prev, playButton, stopButton, next, end];

    //we attach event listeners to buttoms as needed
    playButton.click(playBack);
    stopButton.click(stopPlayback);
    prev.click(playPreviousTimePoint);
    next.click(playNextTimePoint);
    first.click(seekFirst);
    end.click(seekEnd);

    // we setup the DOM element that will contain the buttoms 
    container.buttonset();

    // add every buttom to the container and refresh it afterwards
    buttonsArray.forEach(function(entry){
        container.append(entry)
    });
    container.buttonset('refresh');
}

/**
 * Code for the navigation slider. Creates the x,y,z sliders and adds labels
*/
function startPositionSliders(){
    var i = 0;
    var axArray = ["X", "Y", "Z"];
    // We loop trough every slider
    $( "#sliders > span" ).each(function(){
        var value = TsVol.selectedEntity[i];
        var opts = {
                        value: value,
                        min: 0,
                        max: TsVol.entitySize[i]-1, // yeah.. if we start from zero we need to subtract 1
                        animate: true,
                        orientation: "horizontal",
                        change: slideMove, // call this function *after* the slide is moved OR the value changes
                        slide: slideMove  //  we use this to keep it smooth.   
                    }
        $(this).slider(opts).each(function(){
            // The starting time point. Supposing it is always ZERO.
            var el = $('<label class="min-coord">'+opts.min+'</label>');
            $(this).append(el);
            // The name of the slider
            el = $('<label class="axis-name">'+axArray[i]+' Axis'+'</label>');        
            $(this).append(el);
            // The current value of the slider
            el = $('<label class="slider-value" id="slider-'+axArray[i]+'-value">['+value+']</label>');    
            $(this).append(el);
            // The maximum value for the slider
            el = $('<label class="max-coord">'+opts.max+'</label>');
            $(this).append(el);
            i++; // let's do the same on the next slider now..
        })
    });
}

/**
 * Code for "movie player" slider. Creates the slider and adds labels
*/
function startMovieSlider(){
	    $("#time-position > span").each(function(){
        var value = 0;
        var opts = {
                        value: value,
                        min: 0,
                        max: timeLength,
                        animate: true,
                        orientation: "horizontal",
                        range: "min",
                        stop: moviePlayerMoveEnd,
                        slide: moviePlayerMove   
                    };
        $(this).slider(opts).each(function(){
            // The starting point. Supposing it is always ZERO.
            var el = $('<label id="time-slider-min">'+opts.min+'</label>');
            $(this).append(el);
            // The actual time point we are seeing
            el = $('<label id="time-slider-value">'+value+'/'+timeLength+'</label>');
            $(this).append(el);
        });
    });
}

// ==================================== CALLBACK FUCTIONS START ===============================================

function playBack(){
    if(!TsVol.playerIntervalID)
        TsVol.playerIntervalID = window.setInterval(drawSceneFunctional, TsVol.playbackRate);
}

function stopPlayback(){
    window.clearInterval(TsVol.playerIntervalID);
    TsVol.playerIntervalID = null;
}

function playNextTimePoint(){
    TsVol.currentTimePoint++;
    TsVol.currentTimePoint = TsVol.currentTimePoint%(timeLength+1)
    drawSceneFunctional(TsVol.currentTimePoint)
}

function playPreviousTimePoint(){
    if(TsVol.currentTimePoint === 0)
        TsVol.currentTimePoint = timeLength+1
    drawSceneFunctional(--TsVol.currentTimePoint)
}

function seekFirst(){
    TsVol.currentTimePoint = 0
    drawSceneFunctional(TsVol.currentTimePoint);
}

function seekEnd(){
    TsVol.currentTimePoint = timeLength;
    drawSceneFunctional(TsVol.currentTimePoint-1);
}

// Updates the position and values of the x,y,z navigation sliders when we click the canvas.
function updateSliders(){
    var axArray = ["X", "Y", "Z"];
    var i = 0;
    $( "#sliders > span" ).each(function(){
        $(this).slider("option", "value", TsVol.selectedEntity[i]); //update the handle
        $('slider-'+axArray[i]+'-value').empty().text( '['+TsVol.selectedEntity[i]+']' ); //update the label
        i += 1;
    });
}

// Updated the player slider bar while playback is on.
function updateMoviePlayerSlider(){
    $("#time-position > span").each(function(){
        $(this).slider("option", "value", TsVol.currentTimePoint);
        $('#time-slider-value').empty().text( TsVol.currentTimePoint+'/'+timeLength );
    })
}

// When the navigation sliders are moved, this redraws the scene accordingly.
function slideMove(event, ui){
    var quadID = ["x-slider", "y-slider", "z-slider"].indexOf(event.target.id)
    var selectedQuad = TsVol.quadrants[quadID];

    //  Updates the label value on the slider.
    $(event.target.children[3]).empty().text( '['+ui.value+']' );
    //  Setup things to draw the scene pointing to the right voxel and redraw it.
    if(quadID == 1)
        TsVol.selectedEntity[selectedQuad.axes.x] = ui.value;
    else
        TsVol.selectedEntity[selectedQuad.axes.y] = ui.value;
    drawSceneFunctional(TsVol.currentTimePoint);
}

// Updates the value at the end of the player bar when we move the handle.
function moviePlayerMove(event, ui){
    $("#time-position > span").each(function(){
        $('#time-slider-value').empty().text( ui.value+'/'+timeLength );
    })
}

/*
* Redraws the scene at the selected timepoint at the end of a slide action.
* Calling this during the the whole slide showed to be too expensive.
* Thus, the new timepoint is drawn only when the user releases the click from the handler
*/
function moviePlayerMoveEnd(event, ui){
    TsVol.currentTimePoint = ui.value;
    drawSceneFunctional(TsVol.currentTimePoint);
}

// ==================================== CALLBACK FUCTIONS END ===============================================
// ==================================== UI RELATED CODE END =================================================