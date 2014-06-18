// TODO: add legend, labels on axes, color scheme support
var ctx = null;                                                      // the context for drawing on current canvas
var currentQuadrant, quadrants = [];
var minimumValue, maximumValue;                                // minimum and maximum for current data slice
var voxelSize, volumeOrigin;                                         // volumeOrigin is not used for now, as in 2D it
                                                                    // is irrelevant; if needed, use it _setQuadrant
var selectedEntity = [0, 0, 0];                                      // the selected voxel; [i, j, k]
var entitySize = [0, 0, 0];
var quadrantHeight, quadrantWidth;

var currentTimePoint = 0;
var minRate = 33;
var playbackRate = 99;
var playerIntervalID;

var bufferSize = 1;
var bufferL2Size = 1;
var lookAhead = 5;

var data = {};
var bufferL2 = {};

var dataAddress;

var requestQueue = [];

var Quadrant = function (params) {                                  // this keeps all necessary data for drawing
    this.index = params.index || 0;                                  // in a quadrant
    this.axes = params.axes || {x: 0, y: 1};                         // axes represented in current quad; i=0, j=1, k=2
    this.entityWidth = params.entityWidth || 0;                      // width and height of one voxel in current quad
    this.entityHeight = params.entityHeight || 0;
    this.offsetX = params.offsetX || 0;                              // the offset of the drawing relative to the quad
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
    /*robert*/
      //myVar = dataUrls;
    /*robert*/
    console.log(dataUrls, minValue, maxValue, volOrigin, sizeOfVoxel, voxelUnit);
    var canvas = document.getElementById("volumetric-ts-canvas");
    if (!canvas.getContext) {
        displayMessage('You need a browser with canvas capabilities, to see this demo fully!', "errorMessage");
        return;
    }

    volumeOrigin = $.parseJSON(volOrigin)[0];
    voxelSize    = $.parseJSON(sizeOfVoxel);

    canvas.width  = $(canvas).parent().width();                      // fill the screen on width
    canvas.height = canvas.width / 3;                          // three quadrants + some space for labeling
    quadrantHeight = canvas.width / 3;               // quadrants are squares
    quadrantWidth = quadrantHeight

    ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.rect(-2, -2, canvas.width, canvas.height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'black';
    ctx.stroke();

    dataUrls = $.parseJSON(dataUrls);
    dataAddress = dataUrls[0];
    dataSize = dataUrls[1];

    var query = dataAddress+"from_idx="+(0)+";to_idx="+(1);
    data = HLPR_readJSONfromFile(query);

    minimumValue = minValue;
    maximumValue = maxValue;
    timeLength = 1452; //timeLength = data.length-1;

    _setupQuadrants();

    selectedEntity[0] = Math.floor(data[0].length / 2);                 // set the center entity as the selected one
    selectedEntity[1] = Math.floor(data[0][0].length / 2);
    selectedEntity[2] = Math.floor(data[0][0][0].length / 2);

    entitySize[0] = Math.floor(data[0].length);                         // get entities number of voxels
    entitySize[1] = Math.floor(data[0][0].length);
    entitySize[2] = Math.floor(data[0][0][0].length);
    entitySize[3] = Math.floor(data.length);

    _setupBuffersSize();

    //'linear', 'rainbow', 'hotcold', 'TVB', 'sparse', 'light-hotcold', 'light-TVB'
    ColSch_setColorScheme("rainbow", false);

    data = getSliceAtTime(currentTimePoint);
    drawSceneFunctional(currentTimePoint);

    window.setInterval(streamToBuffer, playbackRate);
    window.setInterval(freeBuffer, playbackRate*10);  
}

function testRequest2(fileName, sect) {
    var fileData = null;
    requestQueue.push(sect);
    console.log("requestQueue push:", requestQueue);
    doAjaxCall({
        async:true,
        url:fileName,
        methos:"GET",
        mimeType:"text/plain",
        success:function(r){
            bufferL2[sect] = {};
            parseAsync(r, function(json){
                bufferL2[sect] = json;
                var index = requestQueue.indexOf(sect);
                if (index > -1) {
                    requestQueue.splice(index, 1);
                    console.log("requestQueue pop", requestQueue);
                }   
            });
        }
    });
}

    /****WEB WORKER****/
    // We build a worker from an anonymous function body
    var blobURL = URL.createObjectURL( 
        new Blob([ 
            '(',
            function(){
                // our worker goes inside this functions
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
    var section = Math.floor(currentTimePoint/bufferSize);
    var bufferedElements = Object.keys(bufferL2).length;
    if(bufferedElements > bufferL2Size){
        for(var idx in bufferL2){
            if (idx < (section-bufferL2Size/2)%timeLength || idx > (section+bufferL2Size/2)%timeLength){
                console.log("ELIMINATO:", idx)
                delete bufferL2[idx];
            }
        }
    }
}

function streamToBuffer(){
    var section = Math.floor(currentTimePoint/bufferSize);
    var maxSections = Math.floor(timeLength/bufferSize);
    var query = dataAddress+"from_idx="+currentTimePoint+";to_idx="+(bufferSize+currentTimePoint)%timeLength;
    for(var i = 0; i <= lookAhead; i++){
            var tmp = (section+i)%maxSections;
            if(!bufferL2[tmp] && requestQueue.indexOf(tmp) < 0){
                testRequest2(query, tmp);
            }
        }
}

function getSliceAtTime(t){
    var query = dataAddress+"from_idx="+t+";to_idx="+(bufferSize+t)%timeLength;
    var section = Math.floor(t/bufferSize);
    for(var i in requestQueue){
        if( requestQueue[i] < section ){
            requestQueue.splice(i, 1);
        }
    }   
    if(bufferL2[section]){
        buffer = bufferL2[section];
    }else{
        query = dataAddress+"from_idx="+t+";to_idx="+(bufferSize+t)%timeLength;
        buffer = HLPR_readJSONfromFile(query);
        bufferL2[section] = buffer;
    }
    return buffer[t%bufferSize];
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
    // from the currentTimePoint and increment it
    if(tIndex == null){
        tIndex = currentTimePoint;
        currentTimePoint++;
        currentTimePoint = currentTimePoint%timeLength;
        data = getSliceAtTime(tIndex);
    }
    _setCtxOnQuadrant(0);
    ctx.fillStyle = getGradientColorString(minimumValue, minimumValue, maximumValue);
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    for (j = 0; j < data[0].length; ++j)
        for (i = 0; i < data.length; ++i)
            drawVoxel(i, j, data[i][j][selectedEntity[2]]);
    drawMargin();

    _setCtxOnQuadrant(1);
    for (k = 0; k < data[0][0].length; ++k)
        for (jj = 0; jj < data[0].length; ++jj)
            drawVoxel(k, jj, data[selectedEntity[0]][jj][k]);
    drawMargin();

    _setCtxOnQuadrant(2);
    for (kk = 0; kk < data[0][0].length; ++kk)
        for (ii = 0; ii < data.length; ++ii)
            drawVoxel(kk, ii, data[ii][selectedEntity[1]][kk]);
    drawMargin();
    drawNavigator();
    updateMoviePlayerSlider();  
}

/**
 * Draws the voxel set at (line, col) in the current quadrant, and colors it according to its value.
 * This function now nothing about the time point. 
 */
function drawVoxel(line, col, value) {
    ctx.fillStyle = getGradientColorString(value, minimumValue, maximumValue);
    // col increases horizontally and line vertically, so col represents the X drawing axis, and line the Y
	ctx.fillRect(col * currentQuadrant.entityWidth, line * currentQuadrant.entityHeight,
	                 currentQuadrant.entityWidth+1, currentQuadrant.entityHeight+1);
}

/**
 * Draws the cross-hair on each quadrant, on the <code>selectedEntity</code>
 */
function drawNavigator() {
    ctx.save();
    ctx.beginPath();

    for (var quadIdx = 0; quadIdx < 3; ++quadIdx) {
        _setCtxOnQuadrant(quadIdx);
        var x = selectedEntity[currentQuadrant.axes.x] * currentQuadrant.entityWidth + currentQuadrant.entityWidth / 2;
        var y = selectedEntity[currentQuadrant.axes.y] * currentQuadrant.entityHeight + currentQuadrant.entityHeight / 2;
        drawCrossHair(x, y);
    }
    ctx.strokeStyle = "red";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
}

/**
 * Draws a 20px X 20px cross hair on the <code>currentQuadrant</code>, at the specified x and y
 */
function drawCrossHair(x, y) {
    ctx.moveTo(Math.max(x - 20, 0), y);                              // the horizontal line
    ctx.lineTo(Math.min(x + 20, quadrantWidth), y);
    ctx.moveTo(x, Math.max(y - 20, 0));                              // the vertical line
    ctx.lineTo(x, Math.min(y + 20, quadrantHeight));
}

/**
 * Draws a 5px rectangle around the <code>currentQuadrant</code>
 */
function drawMargin(){
    //_setCtxOnQuadrant(0);
    ctx.beginPath();
    ctx.rect(2.5, 0, quadrantWidth-2, quadrantHeight);
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'black';
    ctx.stroke();
}

// ==================================== DRAWING FUNCTIONS  END  =============================================

// ==================================== PRIVATE FUNCTIONS START =============================================

/**
 * Sets the <code>currentQuadrant</code> and applies transformations on context depending on that
 *
 * @param quadIdx Specifies which of <code>quadrants</code> is selected
 * @private
 */
/* TODO: make it use volumeOrigin; could be like this:
 * <code>ctx.setTransform(1, 0, 0, 1, volumeOrigin[currentQuadrant.axes.x], volumeOrigin[currentQuadrant.axes.y])</code>
 *       if implemented, also change the picking to take it into account
 */
function _setCtxOnQuadrant(quadIdx) {
    currentQuadrant = quadrants[quadIdx];
    ctx.setTransform(1, 0, 0, 1, 0, 0);                              // reset the transformation
    ctx.translate(quadIdx * quadrantWidth + currentQuadrant.offsetX, currentQuadrant.offsetY)
}

/**
 * Rotates the K axis on the data to get a nice, upright view of the brain
 */
function _rotateFunctionalData() {
  for (var t = 0; t < data.length; t++)
    for (var i = 0; i < data[0].length; i++)
        for (var j = 0; j < data[0][0].length; j++)
            data[t][i][j].reverse();
}

/**
 * Returns the number of elements on the given axis
 * @param axis The axis whose length is returned; i=0, j=1, k=2
 * @returns {*}
 * @private
 */
function _getDataSize(axis) {
    switch (axis) {
        case 0:     return data[0].length;
        case 1:     return data[0][0].length;
        case 2:     return data[0][0][0].length;
    }
}

/**
 * Computes the actual dimension of one entity from the specified axes
 * @param xAxis The axis to be represented on X (i=0, j=1, k=2)
 * @param yAxis The axis to be represented on Y (i=0, j=1, k=2)
 * @returns {{width: number, height: number}} Entity width and height
 */
function _getEntityDimensions(xAxis, yAxis) {
    var scaleOnWidth  = quadrantWidth  / (_getDataSize(xAxis) * voxelSize[xAxis]);
    var scaleOnHeight = quadrantHeight / (_getDataSize(yAxis) * voxelSize[yAxis]);
    var scale = Math.min(scaleOnHeight, scaleOnWidth);
    return {width: voxelSize[xAxis] * scale, height: voxelSize[yAxis] * scale}
}

/**
 * Initializes the <code>quadrants</code> with some default axes and sets their properties
 */
function _setupQuadrants() {
    quadrants.push(new Quadrant({ index: 0, axes: {x: 1, y: 0} }));
    quadrants.push(new Quadrant({ index: 1, axes: {x: 1, y: 2} }));
    quadrants.push(new Quadrant({ index: 2, axes: {x: 0, y: 2} }));

    for (var quadIdx = 0; quadIdx < quadrants.length; quadIdx++) {
        var entityDimensions = _getEntityDimensions(quadrants[quadIdx].axes.x, quadrants[quadIdx].axes.y);
        quadrants[quadIdx].entityHeight = entityDimensions.height;
        quadrants[quadIdx].entityWidth  = entityDimensions.width;
        var drawingHeight = _getDataSize(quadrants[quadIdx].axes.y) * quadrants[quadIdx].entityHeight;
        var drawingWidth  = _getDataSize(quadrants[quadIdx].axes.x) * quadrants[quadIdx].entityWidth;
        //quadrants[quadIdx].offsetY = (quadrantHeight - drawingHeight) / 2;
        //quadrants[quadIdx].offsetX = (quadrantWidth  - drawingWidth)  / 2;
        quadrants[quadIdx].offsetY = 0;
        quadrants[quadIdx].offsetX = 0;
    }
}

function _setupBuffersSize() {
    var tpSize = entitySize[0]*entitySize[1]*entitySize[2];
    while(bufferSize*tpSize <= 1000000){ //enough to be able to parse the json smoothly
        bufferSize++;
    }
    while(bufferSize*tpSize*bufferL2Size <= 157286400){ //Very safe measure to avoid crashes. Tested on Chrome.
        bufferL2Size++;
    }
    console.log(bufferSize,bufferL2Size);

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
    var selectedQuad = quadrants[Math.floor(xpos / quadrantWidth)];
    // check if it's inside the quadrant but outside the drawing
    if (ypos < selectedQuad.offsetY || ypos >= quadrantHeight - selectedQuad.offsetY ||
        xpos < quadrantWidth * selectedQuad.index + selectedQuad.offsetX ||
        xpos >= quadrantWidth * (selectedQuad.index + 1) - selectedQuad.offsetX)
        return;
    var selectedEntityOnX = Math.floor((xpos % quadrantWidth) / selectedQuad.entityWidth);
    var selectedEntityOnY = Math.floor((ypos - selectedQuad.offsetY) / selectedQuad.entityHeight);
    selectedEntity[selectedQuad.axes.x] = selectedEntityOnX;
    selectedEntity[selectedQuad.axes.y] = selectedEntityOnY;
    updateSliders();
    drawSceneFunctional(currentTimePoint)
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
        var value = selectedEntity[i];
        var opts = {
                        value: value,
                        min: 0,
                        max: entitySize[i]-1, // yeah.. if we start from zero we need to subtract 1
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
    if(!playerIntervalID)
        playerIntervalID = window.setInterval(drawSceneFunctional, playbackRate);
}

function stopPlayback(){
    window.clearInterval(playerIntervalID);
    playerIntervalID = null;
}

function playNextTimePoint(){
    currentTimePoint++;
    currentTimePoint = currentTimePoint%(timeLength+1)
    drawSceneFunctional(currentTimePoint)
}

function playPreviousTimePoint(){
    if(currentTimePoint === 0)
        currentTimePoint = timeLength+1
    drawSceneFunctional(--currentTimePoint)
}

function seekFirst(){
    currentTimePoint = 0
    drawSceneFunctional(currentTimePoint);
}

function seekEnd(){
    currentTimePoint = timeLength;
    drawSceneFunctional(currentTimePoint-1);
}

// Updates the position and values of the x,y,z navigation sliders when we click the canvas.
function updateSliders(){
    var axArray = ["X", "Y", "Z"];
    var i = 0;
    $( "#sliders > span" ).each(function(){
        $(this).slider("option", "value", selectedEntity[i]); //update the handle
        $('slider-'+axArray[i]+'-value').empty().text( '['+selectedEntity[i]+']' ); //update the label
        i += 1;
    });
}

// Updated the player slider bar while playback is on.
function updateMoviePlayerSlider(){
    $("#time-position > span").each(function(){
        $(this).slider("option", "value", currentTimePoint);
        $('#time-slider-value').empty().text( currentTimePoint+'/'+timeLength );
    })
}

// When the navigation sliders are moved, this redraws the scene accordingly.
function slideMove(event, ui){
    var quadID = ["x-slider", "y-slider", "z-slider"].indexOf(event.target.id)
    var selectedQuad = quadrants[quadID];

    //  Updates the label value on the slider.
    $(event.target.children[3]).empty().text( '['+ui.value+']' );
    //  Setup things to draw the scene pointing to the right voxel and redraw it.
    if(quadID == 1)
        selectedEntity[selectedQuad.axes.x] = ui.value;
    else
        selectedEntity[selectedQuad.axes.y] = ui.value;
    drawSceneFunctional(currentTimePoint);
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
    currentTimePoint = ui.value;
    drawSceneFunctional(currentTimePoint);
}

// ==================================== CALLBACK FUCTIONS END ===============================================
// ==================================== UI RELATED CODE END =================================================