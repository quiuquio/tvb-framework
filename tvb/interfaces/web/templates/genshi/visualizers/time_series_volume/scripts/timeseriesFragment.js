// ====================================    INITIALIZATION CODE START =========================================

var tsFrag = {
    dataTimeSeries: "",                 // Contains the address to query the time series of a specific voxel.
    m: [],                              // Global preview margin sizes
    w: 0,                               // Global preview width
    h: 0,                               // Global preview width
    smallMargin: {},                    // Sortable time series margins
    width: 0,                           // Sortable time series width
    height: 0,                          // Sortable time series height
    tsDataArray: [],                    // Array containing all the time series data
    selectedIndex: 0,                   // Selected time series line index
    relevantSortingFeature: "mean",     // Stores what feature to consider while sorting the time series.
    relevantColoringFeature: "mean",    // Stores what feature to consider while coloring the time series.
    timeLength: 0,                      // The lenght of the data in frames
    samplePeriod: 0,                    // Meta data. The sampling period of the time series
    samplePeriodUnit: "",               // Meta data. The time unit of the sample period
    selectedEntity: [],                 // The selected voxel; [i, j, k].
    line: null,                         // A d3.line() for the global graph.
    sortableline: null,                 // A d3.line() for the sortable graph.
    x: null,                            // A d3.scale() for the x axis
    y: null,                            // A d3.scale() for the y axis
    sortableY: null,                    // Y axis labels for the sortable graph
    xAxisScale:null,                    // X axis labels for the global graph
    brush: null                         // A d3.brush()
};

var tsDataObj = function(params, data){             // this keeps all the data about a specific time series
    this.x = params.x || tsFrag.selectedEntity[0],                      // The X coordinate
    this.y =  params.y || tsFrag.selectedEntity[1],                     // The Y coordinate
    this.z = params.z || tsFrag.selectedEntity[2],                      // The Z coordinate
    this.label = params.label || "["+this.x+","+this.y+","+this.z+"]",  // The string used as a label for this Object
    this.data = params.data || data,                                    // The actual data
    this.max = params.max || d3.max(data),                              // The maximum value on the data
    this.min = params.min || d3.min(data),                              // The minimum value on the data
    this.mean = params.mean || d3.mean(data),                           // The mean values on the data
    this.median = params.median || d3.median(data),                     // The median value on the data
    this.variance = params.variance || variance(data, this.mean),       // The variance of the data
    this.deviation = params.deviation || Math.sqrt(this.variance)       // The std deviation of the data
}

/**
 * Make all the necessary initialisations
 * @param tsDataRequest URLs of the dataset we're working on
 */
function TSF_initVisualizer(tsDataRequest){
    tsFrag.dataAddress = tsDataRequest;

    // take all the necessary data from the time series volume visualizer
    tsFrag.timeLength = tsVol.timeLength;
    tsFrag.samplePeriod = tsVol.samplePeriod;
    tsFrag.samplePeriodUnit = tsVol.samplePeriodUnit;
    tsFrag.dataTimeSeries = tsVol.dataTimeSeries;
    tsFrag.minimumValue = tsVol.minimumValue;
    tsFrag.maximumValue = tsVol.maximumValue;

    // tsFrag own data
    // define dimensions of graph
    tsFrag.m = [30, 80, 30, 80]; // margins
    tsFrag.smallMargin = {top: 0, right: 80, bottom: 0, left: 80};
    tsFrag.width = $('#graph').width() - tsFrag.smallMargin.left - tsFrag.smallMargin.right;
    tsFrag.height = 30 - tsFrag.smallMargin.top - tsFrag.smallMargin.bottom;
    tsFrag.w = $('#graph').width() - tsFrag.m[1] - tsFrag.m[3]; // width
    tsFrag.h = 240 - tsFrag.m[0] - tsFrag.m[2]; // height

    attachUIListeners();
}

/**
 * Update the variables that this fragment shares with other visualizers
 */
function updateTSFragment(){
    if(typeof tsVol !== 'undefined'){
        tsFrag.selectedEntity = tsVol.selectedEntity;
        tsFrag.currentTimePoint = tsVol.currentTimePoint;
    }
    else{
        alert("The Time Series Fragment relies on other visualizers to work");
    }
}

// ====================================    INITIALIZATION CODE END   =========================================
// ====================================    DRAWING FUNCTIONS START ===========================================

/**
 *  Add the selected entity to te time series array if it is not present yet and draw all of the SVG graphs.
 */
function drawGraphs(){
    $('#graph').empty();

    var label = "["+tsFrag.selectedEntity[0]+","+tsFrag.selectedEntity[1]+","+tsFrag.selectedEntity[2]+"]";
    var selectedVoxelIsNotPresent = !tsFrag.tsDataArray.some(function(ts){ return ts.label == this[0]}, [label]);

    if( selectedVoxelIsNotPresent ){
        var tmp = new tsDataObj({}, getPerVoxelTimeSeries(tsFrag.selectedEntity[0], tsFrag.selectedEntity[1], tsFrag.selectedEntity[2]));
        tsFrag.tsDataArray.push(tmp);
        var pvt = {x: tsFrag.selectedEntity[0], y:  tsFrag.selectedEntity[1],z:  tsFrag.selectedEntity[2]};
        sortTsGraphs($("#sortingSelector").val(), tsFrag.relevantSortingFeature, pvt);
    }
    if(tsFrag.tsDataArray.length < 1){
        return;
    }
    drawGobalTimeseries();
    updateBrush();
    drawSortableGraph();


    if($("#mini-container").children().length < 2){
        $("#mini-container").sortable( "disable" );
        d3.selectAll("#mini-container li")
        .classed("pin", true);
    }
}

/**
 * Draws the global graph showing all the selected time series at the same time.
 */
function drawGobalTimeseries(){
    tsFrag.x = d3.scale.linear().domain([0, tsFrag.timeLength]).range([0, tsFrag.w]);
    var x2   = d3.scale.linear().range([0, tsFrag.w]);
    var y2 = d3.scale.linear().range([tsFrag.h, 0]);

    // Prepare the brush for later
    tsFrag.brush = d3.svg.brush()
        .x(x2)
        .on("brush", brush);

    x2.domain(tsFrag.x.domain());

    function brush() {
        tsFrag.x.domain(tsFrag.brush.empty() ? x2.domain() : tsFrag.brush.extent());
        d3.select("#mini-container").selectAll(".line")
        .attr("d", function(d){
            tsFrag.sortableY = d3.scale.linear().domain([d.min, d.max]).range([tsFrag.height, 0]);
            return tsFrag.sortableline(d.data);
        });

       d3.select("#mini-container").selectAll(".x.axis").call(xAxis());
       d3.select(".brusher").selectAll(".x.axis").call(xAxis());
    }

    var localMax = d3.max(tsFrag.tsDataArray, function(array){
      return array.max;
    });
    var localMin = d3.min(tsFrag.tsDataArray, function(array){
      return array.min;
    });
    tsFrag.y = d3.scale.linear().domain([localMin, localMax]).range([tsFrag.h, 0]);

    // create a line function that can convert data[] into x and y points
    tsFrag.line = d3.svg.line()
        //.interpolate("basis") //basis for spline interpolation
        .x(function(d,i){
            return tsFrag.x(i);
        })
        .y(function(d){
            return tsFrag.y(d);
        });

    // Add an SVG element with the desired dimensions and margin.
    var graph = d3.select("#graph").append("svg:svg")
          .attr("width", tsFrag.w + tsFrag.m[1] + tsFrag.m[3])
          .attr("height", tsFrag.h + tsFrag.m[0] + tsFrag.m[2])
          .attr("class", "graph-svg-component global-graph")
        .append("svg:g")
          .attr("transform", "translate(" + tsFrag.m[3] + "," + tsFrag.m[0] + ")");

    var rect = graph.append("rect")
        .attr('w',0)
        .attr('h',0)
        .attr('width', tsFrag.w)
        .attr('height', tsFrag.h)
        .attr('fill', "#ffffff")
        .attr("class", "graph-timeSeries-rect")

    // Add an overlay layer that will listen to most mouse events
    graph.append("rect")
        .attr("class", "overlay")
        .attr("width", tsFrag.w)
        .attr("height", tsFrag.h)
        .attr('fill', "#ffffff")
        .on("mouseover", function(){ focus.style("display", null); })
        .on("mouseout", function(){ focus.style("display", "none"); })
        .on("mousemove", TSF_mousemove);

    // create xAxis
    tsFrag.xAxisScale = d3.scale.linear().domain([0, tsFrag.timeLength*tsFrag.samplePeriod]).range([0, tsFrag.w]);
    var xAxis = function(){
        tsFrag.x.domain(tsFrag.brush.empty() ? x2.domain() : tsFrag.brush.extent());
        tsFrag.xAxisScale = tsFrag.x;
        tsFrag.xAxisScale.domain()[0] *= tsFrag.samplePeriod;
        tsFrag.xAxisScale.domain()[1] *= tsFrag.samplePeriod;
        return d3.svg.axis().scale(tsFrag.xAxisScale).tickSize(-tsFrag.h).tickSubdivide(true);
    }

    // Add the x-axis.
    graph.append("svg:g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + tsFrag.h + ")")
        .call(xAxis());

    // Add info about the time unit as a label
    var timeUnit = tsFrag.samplePeriodUnit=="sec" ? "Seconds" : tsFrag.samplePeriodUnit;
    graph.append("text")
        .attr("class", "x axis")
        .attr("text-anchor", "end")
        .attr("x", tsFrag.w+70)
        //.attr("y", tsFrag.h - 8 )
        .attr("y", tsFrag.h )
        .text("Time in " + timeUnit);

    // create left yAxis
    var yAxisLeft = d3.svg.axis().scale(tsFrag.y).ticks(4).orient("left");
    // Add the y-axis to the left
    graph.append("svg:g")
          .attr("class", "y axis")
          .attr("transform", "translate(-25,0)")
          .call(yAxisLeft);

    graph.append("text")
        .attr("class", "y axis")
        .attr("text-anchor", "end")
        .attr("x", "1em")
        .attr("y", "-1.5em")
        .attr("dy", ".75em")
        .text("Measurements");

    // Draw the time series lines on the main graph. Each one with it's own color
    graph.selectAll('.line')
        .data(tsFrag.tsDataArray)
        .enter()
        .append("path")
            .attr("class", "line")
            //.attr("clip-path", "url(#clip)")
            .attr("d", function(d){return tsFrag.line(d.data);})
            .attr('class', 'line colored-line')
            .attr("style", function(d){return "stroke:" + getGradientColorString(d[tsFrag.relevantColoringFeature], tsFrag.minimumValue, tsFrag.maximumValue);} )
            .on("mouseover", selectLineData);

    // The focus will show the numeric value of a time series on a certain point
    var focus = graph.append("g")
        .attr("class", "focus")
        .style("display", "none");

    focus.append("circle")
        .attr("r", 4.5);

    focus.append("text")
        .attr("x", 9)
        .attr("dy", ".35em")
        .attr("style","background-color: aliceblue");
    var verticalLine = graph.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', 0)
        .attr('y2', tsFrag.h)
        .attr("stroke", "steelblue")
        .attr('class', 'verticalLine');

    // This red line will show what time point we are seeing in the main visualizer.
    var timeVerticalLine = graph.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', 0)
        .attr('y2', tsFrag.h)
        .attr("stroke", "red")
        .attr('class', 'timeVerticalLine')
        .attr("transform", function(){
                var width = $(".graph-timeSeries-rect").attr("width");
                var pos = (tsVol.currentTimePoint*width)/(tsVol.timeLength);
                return "translate(" + pos + ", 0)";
            });

    var circle = graph.append("circle")
        .attr("opacity", 0)
        .attr('r', 2)
        .attr("id", "mouseLineCircle");

    // Add listener so that the red line moves together with the main visualizer slider
    $("#time-position").on("slide change", function(){
        // Move blue line following the mouse
        var wdt = $(".graph-timeSeries-rect").attr("width");
        var xPos = (tsFrag.currentTimePoint*wdt)/(tsFrag.timeLength);

        var selectedLine = d3.select("path.highlight");
        if(selectedLine[0][0] == null){
            selectedLine = d3.select("path.colored-line:nth-of-type(1)")
        }
        var pathLength = selectedLine.node().getTotalLength();
        var X = xPos;
        var beginning = X,
            end = pathLength,
            target;
        while(true){
            target = Math.floor((beginning + end) / 2);
            pos = selectedLine.node().getPointAtLength(target);
            if((target === end || target === beginning) && pos.x !== X){
                break;
            }
            if(pos.x > X){
                end = target;
            }
            else if(pos.x < X){
                beginning = target;
            }
            else break; //position found
        }
    });

    var brusher = d3.select("#graph").append("svg:svg")
        .attr("class", "graph-svg-component global-graph")
        .attr("width", tsFrag.width + tsFrag.smallMargin.left + tsFrag.smallMargin.right)
        .attr("height", tsFrag.height + tsFrag.smallMargin.top + tsFrag.smallMargin.bottom+20)
        .append("g")
            .attr("class", "brusher graph-svg-component")
            .attr("width", tsFrag.width + tsFrag.smallMargin.left + tsFrag.smallMargin.right)
            .attr("height", tsFrag.height + tsFrag.smallMargin.top + tsFrag.smallMargin.bottom)
            .attr("id","brush")
            .attr("transform", "translate(" + tsFrag.smallMargin.left + "," + tsFrag.smallMargin.top + ")")
        //.attr("transform", "translate(" + tsFrag.m[1] + "," + tsFrag.m[1] + ")");
    brusher.append("rect")
        .attr('w',0)
        .attr('h',0)
        .attr("width", tsFrag.width)
        .attr("height", tsFrag.height)
        .attr('fill', "#ffffff")
        .style("stroke", "black")
        .attr("class", "brush-rect")

    /* We draw no lines on the brush selector. */
    // brusher.selectAll('path')
    //     .data(tsFrag.tsDataArray)
    //     .enter()
    //         .append("path")
    //         .attr("class", "line colored-line")
    //         .attr("d", function(d){return tsFrag.line(d.data);});

    // Align brush with other graphs
    brusher.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + (tsFrag.height+3) + ")")
        .call(xAxis());

    // Add y label to brush
    brusher.append("text")
        .attr("class", "y label")
        .attr("text-anchor", "end")
        .attr("y", 6)
        .attr("dy", ".75em")
        .attr("transform", "translate(-5,0)")
        .text("Focus");

    // Add transparent overlay to display selection on brush
    brusher.append("g")
      .attr("class", "x brush")
      .call(tsFrag.brush)
    .selectAll("rect")
      .attr("y", -6)
      .attr("height", tsFrag.height + 6);
}

/**
 * Draws a sortable graph. Each line has the same vertical space as the others but the
 * scaling factor of each line is different. Lines are colored using the selected coloring feature
 * and they can be sorted manually or automatically by choosing one of many features.
 */
function drawSortableGraph(){
    tsFrag.sortableY = tsFrag.y;
    tsFrag.sortableline = d3.svg.line()
        .x(function(d,i){
            return tsFrag.x(i);
        })
        .y(function(d){
            return tsFrag.sortableY(d);
        });
    d3.select("#graph").append("ul")
        .attr("id", "mini-container")
        .attr("class", "sortable");

    // Draw an svg block as a background for each time series
    var svg = d3.select("#mini-container").selectAll("svg")
        .data(tsFrag.tsDataArray)
        .enter()
        .append("li")
        .append("svg")
            .attr("width", tsFrag.width + tsFrag.smallMargin.left + tsFrag.smallMargin.right)
            .attr("height", tsFrag.height + tsFrag.smallMargin.top + tsFrag.smallMargin.bottom)
            .attr("class", "graph-svg-component")
            .attr("style", function(d){
                var bgCol = getGradientColorString(d[tsFrag.relevantColoringFeature], tsFrag.minimumValue, tsFrag.maximumValue);
                return "background-color:" + bgCol;
            })
            .attr("display", "block")
            .on("click", selectLineData)
        .append("g")
            .attr("transform", "translate(" + tsFrag.smallMargin.left + "," + tsFrag.smallMargin.top + ")")
            .attr('height', tsFrag.height);
    // Add an overlay rect to listen to mouse events
    svg.append("rect")
        .attr("class", "graph-timeSeries-rect overlay")
        .attr("width", tsFrag.width)
        .attr("height", tsFrag.height)
        .attr('fill', "#ffffff")
        .on("mouseover", function(){ d3.select(".focus").style("display", null); })
        .on("mouseout", function(){ d3.select(".focus").style("display", "none"); })
        .on("mousemove", TSF_mousemove);

    // Draw the actual lines and set a scaling factor for each one of them.
    svg.append("path")
        .attr("class", "line")
        .attr("d", function(d){ tsFrag.sortableY = d3.scale.linear().domain([d.min, d.max]).range([tsFrag.height, 0]); return tsFrag.sortableline(d.data); })
        .attr('class', 'line colored-line mini')
        .attr("style", function(d){return "stroke:" + getGradientColorString(d[tsFrag.relevantColoringFeature], tsFrag.minimumValue, tsFrag.maximumValue);} )

    svg.append("text")
        .attr("class", "y label")
        .attr("text-anchor", "end")
        .attr("y", 6)
        .attr("dy", ".75em")
        .attr("transform", "translate(-5,0)")
        .text(function(d){return d.label;});

    var xAxis = function(){
        tsFrag.xAxisScale = tsFrag.x;
        tsFrag.xAxisScale.domain()[0] *= tsFrag.samplePeriod;
        tsFrag.xAxisScale.domain()[1] *= tsFrag.samplePeriod;
        return d3.svg.axis().scale(tsFrag.xAxisScale).tickSize(-tsFrag.h).tickSubdivide(true);
    }

    // Add the x-axis.
    svg.append("g")
        .attr("class", "x axis")
        .attr("width", tsFrag.width)
        .attr("height", tsFrag.height)
        .attr('fill', "#ffffff")
        .attr("transform", "translate(0," + tsFrag.height + ")")
        .call(xAxis());

    // Make the svg blocks sortable with jQuery
    // The draging is smoot because of the '<li>' tags on HTML, do not remove them.
    $(function(){
        var originalPosition, destination;
        $( ".sortable" ).sortable({
            items: '> li:not(.pin)', // this is used to avoid dragging UI elements.
            cursor: "move",
            connectWith: '#sortable-delete',
            axis: "y",
            revert: 250,
            start: function(event,ui){
                originalPosition = ui.item.index();
                d3.selectAll("#ts-trash-can")
                    .classed("trash-hidden", false);
                d3.selectAll("#ts-trash-can")
                    .classed("trash-show", true);
            },
            stop: function(event,ui){
                d3.selectAll("#ts-trash-can")
                    .classed("trash-show", false);
                d3.selectAll("#ts-trash-can")
                    .classed("trash-hidden", true);
            },
            update: function(event, ui){
                if(this.id == 'sortable-delete'){
                    // Remove the element dropped on #sortable-delete
                    if(tsFrag.tsDataArray.length > 1){
                        var deleteLabel = ui.item[0].__data__.label;
                        tsFrag.tsDataArray = tsFrag.tsDataArray.filter(function(obj){
                            return obj.label != deleteLabel;
                        })
                        ui.item.remove();
                        tsFrag.selectedIndex = 0;
                    }
                    drawGraphs();
                }else{
                    // move element in the main array too.
                    destination = ui.item.index();
                    move(tsFrag.tsDataArray, originalPosition, destination);
                    // redraw the graph and set the moved element as selected.
                    drawGraphs();
                    selectLineData("", destination);
                    // Change the sorting selector value to manual
                    $("#sortingSelector").val('manual');
                }
            }
        });
      });
}

// ====================================    DRAWING FUNCTIONS END   ===========================================
// ====================================    HELPER FUNCTIONS START  ===========================================

/**
 * Get an array containing the time series for the specified [x,y,z] voxel.
 * Out of bound indexes are checked only on the server side.
 * @params x Integer, the x coordinate.
 * @params y Integer, the y coordinate.
 * @params z Integer, the z coordinate.
 * @returns Array of length <code>tsFra.timeLength</code> with the requested time series values
 */
function getPerVoxelTimeSeries(x,y,z){
    x = "x=" + x;
    y = ";y=" + y;
    z = ";z=" + z;
    var query = tsFrag.dataAddress + x + y + z;
    return HLPR_readJSONfromFile(query);
}

/**
 * Compute the variance of an array. The mean can be pre-computed.
 * Based on the same function from science.js at www.github.com/jasondavies/science.js
 * @params arr {Array} The array containing the time series we want to analyze
 * @params mean {number} Optional. The mean of the array.
 * @returns The variance of the array.
 */
function variance(arr, mean){
    var n = arr.length;
    if(n < 1){
        return NaN;
    }
    if(n === 1){
        return 0;
    }
    mean = mean || d3.mean(arr);
    var i = -1;
    var sum = 0;
    while(++i < n){
        var v = arr[i] - mean;
        sum += v * v;
    }
    return sum / (n - 1);
};

/**
 * Compute the covariance of an array.
 * @params tsA {Array} The first array containing the time series we want to analyze
 * @params tsB {Array} The second array containing the time series we want to analyze
 * @params meanA {number} Optional. The mean of the tsA.
 * @params meanB {number} Optional. The mean of the tsB.
 * @returns The covariance between the two arrays.
 */
function covariance(tsA, tsB, meanA, meanB){
    var n = tsA.length;
    if(n < 1){
        return NaN;
    }
    if(n === 1){
        return 0;
    }
    var i = -1;
    var sum = 0;
    meanA = meanA ||d3.mean(tsA);
    meanB = meanB || d3.mean(tsB);
    while(++i < n){
        var diffA = tsA[i] - meanA;
        var diffB = tsB[i] - meanB;
        sum += diffA * diffB;
    }
    return sum / n;
}

/**
 * Select a graph line and mark it as highlighted
 * @params d Data. We need it here because d3 always passes data as the first parameter.
 * @params i The clicked line index. D3 always passes this variable as second parameter.
 */
function selectLineData(d, i){
    tsFrag.selectedIndex = i;

    //remove the highlight class
    d3.selectAll(".highlight")
        .classed("highlight", false);
    d3.selectAll(".text-highlight")
        .classed("text-highlight", false);

    //add the highlight class
    d3.select("path.colored-line:nth-of-type(" + (i+1) +")")
        .classed("highlight", true);
    d3.select("#graph li:nth-of-type(" + (i+1) +") text")
        .classed("text-highlight", true);
}

/**
 *  Attach event listeners to all UI selectors
 */
function attachUIListeners(){
    // Attach sorting listener to Sorting Selector
    $("#sortingSelector").change(function(e){
        var pvt = {x: tsFrag.selectedEntity[0], y: tsFrag.selectedEntity[1], z: tsFrag.selectedEntity[2]};
        sortTsGraphs(e.currentTarget.value, tsFrag.relevantSortingFeature, pvt);
        // redraw the graph
        drawGraphs();
    });

    // Attach sorting listener to Relevant Feature Selector
    $("#relevantFeatureSelector").change(function(e){
        tsFrag.relevantSortingFeature = e.currentTarget.value;
        var pvt = {x: tsFrag.selectedEntity[0], y: tsFrag.selectedEntity[1], z: tsFrag.selectedEntity[2]};
        sortTsGraphs($("#sortingSelector").val(), tsFrag.relevantSortingFeature, pvt);
        // redraw the graph
        drawGraphs();
    });

    // Attach sorting listener to Relevant Color Selector
    $("#colorBySelector").change(function(e){
        tsFrag.relevantColoringFeature = e.currentTarget.value;
        // redraw the graph
        drawGraphs();
    });

    // Set the proper trash bin dimensions
    $("#ts-trash-can").height($("#sortable-delete").height()+17);
    $("#ts-trash-can").width($("#sortable-delete").width()+17);
}

/**
 * Calback function for the onmousemove event
 */
function TSF_mousemove(){
    var x0 = tsFrag.x.invert(d3.mouse(this)[0]),
        i = Math.floor(x0),
        data = tsFrag.tsDataArray[tsFrag.selectedIndex].data,
        d0 = data[i - 1],
        d1 = data[i],
        d = x0 - d0 > d1 - x0 ? d1 : d0;
    var selectedLine = d3.select("path.colored-line:nth-of-type(" + (tsFrag.selectedIndex+1) +")");

    var focus = d3.select(".focus");

    focus.attr("transform", "translate(" + d3.mouse(this)[0] + "," + tsFrag.y(data[i]) + ")");
    focus.select("text").text(d1);

    //Move blue line following the mouse
    var xPos = d3.mouse(this)[0];
    // the +-3 lets us click the graph and not the line
    var pathLength = selectedLine.node().getTotalLength();

    xPos = xPos > ( pathLength / 2 ) ? Math.min(xPos+3, pathLength) : Math.max(xPos-3, 0);
    d3.select(".verticalLine").attr("transform", function(){
        return "translate(" + xPos + ",0)";
    });

    var X = xPos;
    var beginning = X,
        end = pathLength,
        target;
    while(true){
        target = Math.floor((beginning + end) / 2);
        pos = selectedLine.node().getPointAtLength(target);
        if((target === end || target === beginning) && pos.x !== X){
            break;
        }
        if(pos.x > X) end = target;
        else if(pos.x < X) beginning = target;
        else break; //position found
    }
    var circle = d3.select("#mouseLineCircle");
    circle.attr("opacity", 1)
        .attr("cx", X)
        .attr("cy", pos.y);

    focus.attr("transform", "translate(" + X + "," + pos.y + ")");
}

/*
* Moves element in arr[old_index] to arr[new_index]. It allows for negative indexes so
* moving he last element to the nth position can be written as <code>move(arr, -1, n)</code>
* while moving the nth element to the last position can be <code>move(arr, n, -1)</code>
* @param arr The array to be modified
* @param old_index The index of the element to be moved
* @param new_index The index where to move the element
* @returns Nothig, it modifies arr directly
*/
function move(arr, old_index, new_index){
    while(old_index < 0){
        old_index += arr.length;
    }
    while(new_index < 0){
        new_index += arr.length;
    }
    if(new_index >= arr.length){
        var k = new_index - arr.length;
        while((k--) + 1){
            arr.push(undefined);
        }
    }
    arr.splice(new_index, 0, arr.splice(old_index, 1)[0]);
};

/**
 * Sort the time-series array using different sorting functions
 * @param order    String, can be desc, asc, xyz. The sorting order we want to use.
 * @param by       String, name of the attribute we should consider when sorting.
 * @param pivot    Object with x,y,z coordinates. Used only by "xyz" sort.
 */
function sortTsGraphs(order, by, pivot){
    // manhattan distance helper for xyz sorting.
    function md3d(a, b){
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);
    }
    // sorting from biggest to smallest
    if(order == "descending"){
        tsFrag.tsDataArray.sort(function(a, b){
          return a[by] == b[by] ? 0 : + (a[by] < b[by]) || -1;
        });
    }
    // sorting from smallest to biggest
    else if(order == "ascending"){
        tsFrag.tsDataArray.sort(function(a, b){
          return a[by] == b[by] ? 0 : + (a[by] > b[by]) || -1;
        });
    }
    // sorting based on manhattan distance from the pivot coordinate
    else if(order == "manhattan"){
        pivot = pivot || {x:0,y:0,z:0};
        tsFrag.tsDataArray.sort(function(a, b){
            a = md3d(a, pivot);
            b = md3d(b, pivot);
          return a == b ? 0 : +(a > b) || -1;
        });
    }
    else{
        return;
    }
}
/**
 * Update the brushes based on the current time point
 */
function updateBrush(){
    var bMin = Math.max(0,tsFrag.currentTimePoint-30);
    var bMax = Math.min(tsFrag.currentTimePoint+30,tsFrag.timeLength);
    d3.select('.brush').transition()
      .delay(0)
      .call(tsFrag.brush.extent([bMin, bMax]))
      .call(tsFrag.brush.event);
}

// ====================================    HELPER FUNCTIONS END    ===========================================
