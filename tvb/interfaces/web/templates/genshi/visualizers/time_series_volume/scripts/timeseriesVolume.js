// TODO: add legend, labels on axes, color scheme support
var ctx = null;                                                      // the context for drawing on current canvas
var currentQuadrant, quadrants = [];
var minimumValue, maximumValue, data;                                // minimum and maximum for current data slice
var voxelSize, volumeOrigin;                                         // volumeOrigin is not used for now, as in 2D it
                                                                    // is irrelevant; if needed, use it _setQuadrant
var selectedEntity = [0, 0, 0];                                      // the selected voxel; [i, j, k]
var entitySize = [0, 0, 0];
var quadrantHeight, quadrantWidth;

var currentTimePoint = 0;
var minRate = 33;
var playbackRate = 33;
var playerIntervalID;

var Quadrant = function (params) {                                  // this keeps all necessary data for drawing
    this.index = params.index || 0;                                  // in a quadrant
    this.axes = params.axes || {x: 0, y: 1};                         // axes represented in current quad; i=0, j=1, k=2
    this.entityWidth = params.entityWidth || 0;                      // width and height of one voxel in current quad
    this.entityHeight = params.entityHeight || 0;
    this.offsetX = params.offsetX || 0;                              // the offset of the drawing relative to the quad
    this.offsetY = params.offsetY || 0;
};

var dataAddress

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

    var canvas = document.getElementById("volumetric-ts-canvas");
    if (!canvas.getContext) {
        displayMessage('You need a browser with canvas capabilities, to see this demo fully!', "errorMessage");
        return
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

    console.log(dataUrls);
    dataUrls = $.parseJSON(dataUrls);
    console.log(dataUrls);
    console.log(maxValue);
    dataAddress = dataUrls[0];

    //returns the log of y with base x.
    function getBaseLog(x, y) {
    	return Math.log(y) / Math.log(x);
	}

	var bits = Math.ceil(getBaseLog(maxValue));
    data = new ArrayBuffer(bits);
    console.log(data);
    var bufferSize = 50;
    for(var i = 0; i < 3; i++){
    	var query = dataUrls[0]+"from_idx="+(i*bufferSize)+";to_idx="+((1+i)*bufferSize);
    	data[i] = HLPR_readJSONfromFile(query);
    	console.log(data);
    }
    data2 = data;
    data = [];
    data = data.concat(data2[0]);
    /*
    *	CODE FOR WEBWORKERS
    */
    var blobURL = URL.createObjectURL( new Blob([ '(',

	function(){
		var n = 1;
		//returns the log of y with base x.
	    function getBaseLog(x, y) {
	    	return Math.log(y) / Math.log(x);
		}
	    function searchh(){
	    	maxValue = 3235
			var bits = Math.ceil(getBaseLog(maxValue));
			    data = new ArrayBuffer(bits);
			    var bufferSize = 50;
			    for(var i = 0; i < 1; i++){
			    	var query = dataUrls[0]+"from_idx="+(i*bufferSize)+";to_idx="+((1+i)*bufferSize);
			    	data[i] = HLPR_readJSONfromFile(query);
			    	console.log(data);
			    }
		}

		self.addEventListener('message', function(e) {
		  //self.postMessage(e.data);
		  console.log(e.data);
		  function searchh(){
	    	maxValue = 3235
			var bits = Math.ceil(getBaseLog(maxValue));
			    data = new ArrayBuffer(bits);
			    var bufferSize = 50;
			    for(var i = 0; i < 2; i++){
			    	var query = e.data+"from_idx="+(i*bufferSize)+";to_idx="+((1+i)*bufferSize);
			    	data[i] = HLPR_readJSONfromFile(query);
			    	console.log(data);
			    }
			}

			searchh();

		}, false);

		searchh();
	}.toString(),

	')()' ], { type: 'application/javascript' } ) ),

	worker = new Worker( blobURL );
	worker.postMessage(dataUrls);

	// Won't be needing this anymore
	URL.revokeObjectURL( blobURL );

	worker.onmessage = function(e){
		console.log(e.data);
	}

	/*
    *	END OF CODE FOR WEBWORKERS
    */


    /*data = data.concat(data2[1]);
    data = data.concat(data2[2]);
    data = data.concat(data2[3]);
    data = data.concat(data2[4]);
    data = data.concat(data2[5]);
    data = data.concat(data2[6]);
    data = data.concat(data2[7]);
    data = data.concat(data2[8]);
    data = data.concat(data2[9]);
    data = data.concat(data2[10]);
    data = data.concat(data2[11]);
    data = data.concat(data2[12]);
    data = data.concat(data2[13]);
    data = data.concat(data2[14]);
    data = data.concat(data2[15]);
    data = data.concat(data2[16]);
    data = data.concat(data2[17]);
    data = data.concat(data2[18]);
    data = data.concat(data2[19]);*/

    //dataUrls = ["/flow/read_datatype_attribute/acdd50b6-eef9-11e3-a47c-000c29325ec7/get_volume_slice/False?from_idx=0;to_idx=30"] 
    // dataUrls = ["/flow/read_datatype_attribute/acdd50b6-eef9-11e3-a47c-000c29325ec7/get_volume_slice/False?from_idx=0;to_idx=50"];
    // dataUrls.push("/flow/read_datatype_attribute/acdd50b6-eef9-11e3-a47c-000c29325ec7/get_volume_slice/False?from_idx=50;to_idx=100");
    // dataUrls.push("/flow/read_datatype_attribute/acdd50b6-eef9-11e3-a47c-000c29325ec7/get_volume_slice/False?from_idx=100;to_idx=150");
    // dataUrls.push("/flow/read_datatype_attribute/acdd50b6-eef9-11e3-a47c-000c29325ec7/get_volume_slice/False?from_idx=150;to_idx=200");
    // dataUrls.push("/flow/read_datatype_attribute/acdd50b6-eef9-11e3-a47c-000c29325ec7/get_volume_slice/False?from_idx=200;to_idx=250");
    // dataUrls.push("/flow/read_datatype_attribute/acdd50b6-eef9-11e3-a47c-000c29325ec7/get_volume_slice/False?from_idx=300;to_idx=350");
    // dataUrls.push("/flow/read_datatype_attribute/acdd50b6-eef9-11e3-a47c-000c29325ec7/get_volume_slice/False?from_idx=350;to_idx=400");
    // dataUrls.push("/flow/read_datatype_attribute/acdd50b6-eef9-11e3-a47c-000c29325ec7/get_volume_slice/False?from_idx=400;to_idx=450");  
    // console.log(dataUrls);
    // data = HLPR_readJSONfromFile(dataUrls[0]);
    // console.log(data);
    // data2 = HLPR_readJSONfromFile(dataUrls[1]);
    // console.log(data2);
    // data3 = HLPR_readJSONfromFile(dataUrls[2]);
    // console.log(data3);
    // data4 = HLPR_readJSONfromFile(dataUrls[3]);
    // console.log(data4);
    // data5 = HLPR_readJSONfromFile(dataUrls[4]);
    // console.log(data5);
    // data6 = HLPR_readJSONfromFile(dataUrls[5]);
    // console.log(data6);
    // data7 = HLPR_readJSONfromFile(dataUrls[6]);
    // console.log(data7);
    // data8 = HLPR_readJSONfromFile(dataUrls[7]);
    // console.log(data8);

    // data = data.concat(data2);
    // data = data.concat(data3);
    // data = data.concat(data4);
    // data = data.concat(data5);
    // data = data.concat(data6);
    // data = data.concat(data7);
    // data = data.concat(data8);
    // data = data.concat(HLPR_readJSONfromFile(dataUrls[1]));
    // console.log(data);
    // data = data.concat(HLPR_readJSONfromFile(dataUrls[2]));
    // console.log(data);
    // data = data.concat(HLPR_readJSONfromFile(dataUrls[3]));
    // console.log(data);

    // ttt = 1;
    // loadID = window.setInterval(asyncLoad, 3000);
    // function asyncLoad(){
    // 	data = data.concat(HLPR_readJSONfromFile(dataUrls[ttt]));
    // 	console.log(data);
    // 	ttt++;
    // 	if(ttt==dataUrls.length-2){
    // 		window.clearInterval(loadID);
    // 	}
    // }




    //data = data.concat(HLPR_readJSONfromFile(dataUrls[2]));
    //console.log(data);
    //data = data.concat(HLPR_readJSONfromFile(dataUrls[3]));
    //console.log(data)
    //brain = data;
    //data = data[0];                                                  // just the first slice for now

    //_rotateFunctionalData();                                                   // rotate Z axis

    minimumValue = minValue;
    maximumValue = maxValue;
    timeLength = 1450; //timeLength = data.length-1;

    _setupQuadrants();

    selectedEntity[0] = Math.floor(data[0].length / 2);                 // set the center entity as the selected one
    selectedEntity[1] = Math.floor(data[0][0].length / 2);
    selectedEntity[2] = Math.floor(data[0][0][0].length / 2);

    entitySize[0] = Math.floor(data[0].length);                         // get entities number of voxels
    entitySize[1] = Math.floor(data[0][0].length);
    entitySize[2] = Math.floor(data[0][0][0].length);
    entitySize[4] = Math.floor(data.length);

    //'linear', 'rainbow', 'hotcold', 'TVB', 'sparse', 'light-hotcold', 'light-TVB'
    ColSch_setColorScheme("rainbow", false);

    data = getSliceAtTime(currentTimePoint);
    drawSceneFunctional(currentTimePoint);
    //window.setInterval(drawSceneFunctional, 200);
    /*while(++itr){
      drawSceneFunctional(itr%data.length);
    }*/
}


function getSliceAtTime(t){
    	var query = dataAddress+"from_idx="+t+";to_idx="+(1+t);
    	return HLPR_readJSONfromFile(query)[0];
    }

function array_compare(a1, a2) {
 if(a1.length != a2.length) {
  return false;
 }
 for(var i in a1) {
  // Don't forget to check for arrays in our arrays.
  if(a1[i] instanceof Array && a2[i] instanceof Array) {
   if(!array_compare(a1[i], a2[i])) {
    return false;
   }
  }
  else if(a1[i] != a2[i]) {
   return false;
  }
 }
 return true;
}


// ==================================== DRAWING FUNCTIONS START =============================================

/**
 * Draws the current view depending on the selected entity
 */
// TODO: since only two dimensions change at every time, redraw just those quadrants
// NOTE: this is true only when we navigate, not when we play the timeseries
// function drawSceneFunctional(tIndex) {
//     var i, j, k, ii, jj, kk;
    
//     // if we pass no tIndex the function will play
//     // from the currentTimePoint and increment it
//     if(tIndex == null){
//         tIndex = currentTimePoint;
//         currentTimePoint++;
//         currentTimePoint = currentTimePoint%timeLength
//     }
//     _setCtxOnQuadrant(0);
//     ctx.fillStyle = getGradientColorString(minimumValue, minimumValue, maximumValue);
//     ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
//     //console.log(getSliceAtTime(tIndex)[0]);
//     //console.log(data[tIndex]);
//     //console.log(array_compare(getSliceAtTime(tIndex)[0], data[tIndex]));
//     data[tIndex] = getSliceAtTime(tIndex);
//     for (j = 0; j < data[tIndex][0].length; ++j)
//         for (i = 0; i < data[tIndex].length; ++i)
//             drawVoxel(i, j, data[tIndex][i][j][selectedEntity[2]]);
//     drawMargin();

//     _setCtxOnQuadrant(1);
//     for (k = 0; k < data[tIndex][0][0].length; ++k)
//         for (jj = 0; jj < data[tIndex][0].length; ++jj)
//             drawVoxel(k, jj, data[tIndex][selectedEntity[0]][jj][k]);
//     drawMargin();

//     _setCtxOnQuadrant(2);
//     for (kk = 0; kk < data[tIndex][0][0].length; ++kk)
//         for (ii = 0; ii < data[tIndex].length; ++ii)
//             drawVoxel(kk, ii, data[tIndex][ii][selectedEntity[1]][kk]);
//     drawMargin();
//     drawNavigator();
//     updateMoviePlayerSlider();  
// }

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
    //console.log(getSliceAtTime(tIndex)[0]);
    //console.log(data[tIndex]);
    //console.log(array_compare(getSliceAtTime(tIndex)[0], data[tIndex]));
    
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
    /*ctx.fillRect(col * currentQuadrant.entityWidth, line * currentQuadrant.entityHeight,
                 currentQuadrant.entityWidth, currentQuadrant.entityHeight);*/
	ctx.fillRect(col * currentQuadrant.entityWidth, line * currentQuadrant.entityHeight,
	                 currentQuadrant.entityWidth+1, currentQuadrant.entityHeight+1);
//ctx.beginPath();
var x = col * currentQuadrant.entityWidth;
var y = col * currentQuadrant.entityWidth;
// ctx.moveTo(x, y); ctx.lineTo(x+5, y); ctx.lineTo(x+5, y-5); ctx.lineTo(x, y-5);ctx.fill();
// ctx.lineWidth = 1; ctx.strokeStyle = ctx.fillStyle; ctx.closePath(); ctx.stroke();
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
    if(currentTimePoint == 0)
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
        //$(this).slider("option", "value", currentTimePoint);
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