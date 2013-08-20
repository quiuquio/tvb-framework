var startColorRGB = [192, 192, 192];
var endColorRGB = [255, 0, 0];
var nodeColorRGB = [255, 255, 255];
var normalizedStartColorRGB = normalizeColorArray(startColorRGB);   // keep the normalized version to avoid
var normalizedEndColorRGB = [1, 0, 0];                              // function calls on every color computation
var normalizedNodeColorRGB = [1, 1, 1];
var _colorScheme = "linear"                                     // the color scheme to be used for current drawing
var _linearGradientStart = 0, _linearGradientEnd = 1                // dummy values; real ones will be on initialisation
var _sparseColorNo = 10

function drawSimpleColorPicker(divId, refreshFunction) {
    $('#' + divId).ColorPicker({
        color: '#ffffff',
        onShow: function (colpkr) {
            $(colpkr).fadeIn(500);
            return false;
        },
        onHide: function (colpkr) {
            $(colpkr).fadeOut(500);
            return false;
        },
        onChange: function (hsb, hex, rgb) {
            $('#' + divId + ' div').css('backgroundColor', '#' + hex);
            nodeColorRGB = [parseInt(rgb.r), parseInt(rgb.g), parseInt(rgb.b)];
            normalizedNodeColorRGB = normalizeColorArray(nodeColorRGB);
            if (refreshFunction) {
                 refreshFunction();
            }
        }
    });	
    $('#' + divId + ' div').css('backgroundColor', '#ffffff');
}


function getNewNodeColor() {
	return nodeColorRGB;
}

/**
 * @param startColorComponentId id of the container in which will be drawn the color picker for the start color
 * @param endColorComponentId id of the container in which will be drawn the color picker for the end color
 */
function drawColorPickerComponent(startColorComponentId, endColorComponentId, refreshFunction) {
	start_color_css = 'rgb(' + startColorRGB[0] + ',' + startColorRGB[1] + ',' + startColorRGB[2] + ')'
	end_color_css = 'rgb(' + endColorRGB[0] + ',' + endColorRGB[1] + ',' + endColorRGB[2] + ')'
    $('#' + startColorComponentId).ColorPicker({
        color: start_color_css,
        onShow: function (colpkr) {
            $(colpkr).fadeIn(500);
            return false;
        },
        onHide: function (colpkr) {
            $(colpkr).fadeOut(500);
            return false;
        },
        onChange: function (hsb, hex, rgb) {
            $('#' + startColorComponentId + ' div').css('backgroundColor', '#' + hex);
            startColorRGB = [parseInt(rgb.r), parseInt(rgb.g), parseInt(rgb.b)];
            normalizedStartColorRGB = normalizeColorArray(startColorRGB);
            if (refreshFunction) {
                 refreshFunction();
            }
        }
    });

    $('#' + endColorComponentId).ColorPicker({
        color: end_color_css,
        onShow: function (colpkr) {
            $(colpkr).fadeIn(500);
            return false;
        },
        onHide: function (colpkr) {
            $(colpkr).fadeOut(500);
            return false;
        },
        onChange: function (hsb, hex, rgb) {
            $('#' + endColorComponentId + ' div').css('backgroundColor', '#' + hex);
            endColorRGB = [parseInt(rgb.r), parseInt(rgb.g), parseInt(rgb.b)];
            normalizedEndColorRGB = normalizeColorArray(endColorRGB);
            if (refreshFunction) {
                refreshFunction();
            }
        }
    });

    $('#' + startColorComponentId + ' div').css('backgroundColor', start_color_css);
    $('#' + endColorComponentId + ' div').css('backgroundColor', end_color_css);
}

function getGradientColorString(pointValue, min, max) {
    rgb_values = getGradientColor(pointValue, min, max);
    return "rgb("+Math.round(rgb_values[0]*255)+","+ Math.round(rgb_values[1]*255)+","+ Math.round(rgb_values[2]*255)+")";
}

function getStartColor() {
	return startColorRGB;
}

function getEndColor() {
	return endColorRGB;
}

function normalizeColor(color) {
    return color / 255.0;
}

/**
 * Returns a copy of the given array, with all the colors normalized, i.e. from (0, 255) to (0, 1)
 * @param colorArray The colors to normalize
 */
function normalizeColorArray(colorArray) {
    var normalizedColorArray = []
    for (var i = 0; i < colorArray.length; ++i)
        normalizedColorArray[i] = colorArray[i] / 255.0
    return normalizedColorArray
}

function normalizeValue(value) {
    if (value > 1) {
        return 1;
    } else if (value < 0) {
        return 0;
    }

    return value;
}

// ================================= COLOR SCHEME FUNCTIONS START =================================

/**
 * Sets the current color scheme to the given one
 * @param scheme The color scheme to use; currently supported: 'linear', 'rainbow', 'hotcold', 'TVB', 'sparse'
 */
function ColSch_setColorScheme(scheme) {
    $(".colorSchemeSettings").hide()
    $("#" + scheme + "ColSchFieldSet").show()
    _colorScheme = scheme
    ColSch_initColorSchemeParams()
    LEG_updateLegendColors()
}

/**
 * Updates the parameters for the linear gradient start and end and resets the legend
 * @private
 */
function _updateLinearParams(event, ui) {
    _linearGradientStart = ui.values[0]
    _linearGradientEnd   = ui.values[1]
    LEG_updateLegendColors()
}

/**
 * Initialises the settings needed by the current color scheme
 */
function ColSch_initColorSchemeParams() {
    if (_colorScheme == "linear") {
        $("#rangerForLinearColSch").slider({
            range: true, min: legendMin, max: legendMax, step: 0.001,
            values: [legendMin, legendMax],
            slide: function(event, ui) {             // update the UI
                    event.target.parentElement.previousElementSibling.innerHTML = ui.values[0].toFixed(3)
                    event.target.parentElement.nextElementSibling.innerHTML     = ui.values[1].toFixed(3)
            },
            change: _updateLinearParams
        })
        $("#sliderMinValue").html(legendMin.toFixed(3))
        $("#sliderMaxValue").html(legendMax.toFixed(3))
        _linearGradientStart = legendMin
        _linearGradientEnd   = legendMax
    }
    else if (_colorScheme == "sparse") {
        $("#sliderForSparseColSch").slider({
            min: 2, max: SPARSE_COLORS.length, step: 1, values: [_sparseColorNo],
            slide: function (event, ui) { $("#ColSch_colorNo").html(ui.value) },
            change: function (event, ui) {
                _sparseColorNo = ui.value
                LEG_updateLegendColors()
            }
        })
        $("#ColSch_colorNo").html(_sparseColorNo)
    }
}

/**
 * Factory function which returns a color for the given point in interval (min, max),
 * according to the current <code>_colorScheme</code>
 *
 * @param pointValue The value whose corresponding color is returned
 *
 * NOTE: The following condition should be true: <code> min <= pointValue <= max </code>
 */
function getGradientColor(pointValue, min, max) {
    if (min == max)         // the interval is empty, so start color is the only possible one
        return [normalizedStartColorRGB[0], normalizedStartColorRGB[1], normalizedStartColorRGB[2]]
    var result = [];
    if (_colorScheme == "linear")                // default is "linear"
        result =  getLinearGradientColor(pointValue, min, max)
    else if (_colorScheme == "rainbow")
        result = getRainbowColor(pointValue, min, max)
    else if (_colorScheme == "hotcold")
        result = getHotColdColor(pointValue, min, max)
    else if (_colorScheme == "TVB")
        result = getTvbColor(pointValue, min, max)
    else if (_colorScheme == "sparse")
        result = getSparseColor(pointValue, min, max)
    return result
}

/**
 * Factory function which computes the colors for a whole array of values in interval (min, max)
 * according to the current <code>_colorScheme</code>
 *
 * @param {Array} values The values for which the colors are generated;
 *                       Condition: min <= values[i] <= max (for every values[i])
 * @param {Float32Array} outputArray If specified, this is filled with the computed
 *                     Condition: outputArray.length = 4 * values.length (RGBA colors)
 * @returns {Array} If <code>outputArray</code> was not specified, a normal array is returned;
 *                  The empty array is returned otherwise
 */
function getGradientColorArray(values, min, max, outputArray) {
    var result = [], color = []
    for (var i = 0; i < values.length; ++i) {
        color = getGradientColor(values[i], min, max)
        color.push(1)                               // add the alpha value
        if (outputArray)
            outputArray.set(color, i * 4)
        else
            result.concat(color)
    }

    return result;
}

/**
 * Returns an [r, g, b] color in a linear transition from <code>startColorRGB</code> to <code>endColorRGB</code>
 * If <code>pointValue</code> lays outside (_linearGradientStart, _linearGradientEnd) interval, the opposite color
 * to the closes end is returned
 */
function getLinearGradientColor(pointValue, min, max) {
    var normalizedValue = (pointValue - min) / (max - min)
    if (pointValue < _linearGradientStart)                 // clamp to selected range
        return [1 - normalizedStartColorRGB[0], 1 - normalizedStartColorRGB[1], 1 - normalizedStartColorRGB[2]]
    if (pointValue > _linearGradientEnd)
        return [1 - normalizedEndColorRGB[0], 1 - normalizedEndColorRGB[1], 1 - normalizedEndColorRGB[2]]

    var r = normalizedStartColorRGB[0] + normalizedValue * (normalizedEndColorRGB[0] - normalizedStartColorRGB[0])
    var g = normalizedStartColorRGB[1] + normalizedValue * (normalizedEndColorRGB[1] - normalizedStartColorRGB[1])
    var b = normalizedStartColorRGB[2] + normalizedValue * (normalizedEndColorRGB[2] - normalizedStartColorRGB[2])

    return [normalizeValue(r), normalizeValue(g), normalizeValue(b)]
}

/**
 * Returns an [r, g, b] color in the rainbow color scheme
 */
function getRainbowColor(pointValue, min, max) {
    var normalizedValue = 4 * (pointValue - min) / (max - min)
    var r = Math.min(normalizedValue - 1.5, - normalizedValue + 4.5)
    var g = Math.min(normalizedValue - 0.5, - normalizedValue + 3.5)
    var b = Math.min(normalizedValue + 0.5, - normalizedValue + 2.5)

    return [normalizeValue(r), normalizeValue(g), normalizeValue(b)]
}

/**
 * Returns an [r, g, b] color from a smooth transition: icy blue to hot red
 */
function getHotColdColor(pointValue, min, max) {
    var normalizedValue = (pointValue - min) / (max - min)
    var r = 4 * (normalizedValue - 0.25)
    var g = 4 * Math.abs(normalizedValue - 0.5) - 1
    var b = 4 * (0.75 - normalizedValue)

    return [normalizeValue(r), normalizeValue(g), normalizeValue(b)]
}

TVB_BRANDING_COLORS = [
    [76, 85, 94],
    [97, 124, 139],
    [63, 23, 46],
    [79, 23, 100],
    [146, 84, 151],
    [87, 180, 59],
    [32, 118, 53],
    [23, 57, 66],
    [29, 96, 88],
    [46, 153, 151],
    [138, 190, 234],
    [79, 169, 230],
    [45, 135, 171],
    [37, 101, 170],
    [229, 130, 33],
    [205, 67, 34],
    [182, 4, 49]
]

/**
 * Returns an [r, g, b] color from TVB_BRANDING_COLORS
 * Resulting color scheme is segmented among these colors
 */
function getTvbColor(pointValue, min, max) {
    var intervalLength = Math.abs(max - min) / TVB_BRANDING_COLORS.length
    var selectedInterval = Math.floor((pointValue - min) / intervalLength)
    return normalizeColorArray(TVB_BRANDING_COLORS[selectedInterval])
}

SPARSE_COLORS = [
0xFFC0CB, /* Pink */
0xCD5C5C, /* IndianRed */
0xFF0000, /* Red */
0x8B0000, /* DarkRed */
0xFF4500, /* OrangeRed */
0xFFA500, /* Orange */
0xFFFF00, /* Yellow */
0xADFF2F, /* GreenYellow */
0x32CD32, /* LimeGreen */
0x008000, /* Green */
0x8FBC8F, /* DarkSeaGreen */
0xE0FFFF, /* LightCyan */
0x00FFFF, /* Cyan */
0x008B8B, /* DarkCyan */
0x0000FF, /* Blue */
0x000080, /* Navy */
0xFF00FF, /* Magenta */
0x9400D3, /* DarkViolet */
0x4B0082, /* Indigo */
0xF0E68C, /* Khaki */
0xBDB76B, /* DarkKhaki */
0x808000, /* Olive */
0xBC8F8F, /* RosyBrown */
0xB8860B, /* DarkGoldenrod */
0xD2691E, /* Chocolate */
0xDEB887, /* BurlyWood */
0x8B4513  /* SaddleBrown */
]

/**
 * Returns an [r, g, b] color the first <code>_sparseColorNo</code> colors in SPARSE COLORS
 * Resulting color scheme is segmented among these colors
 */
function getSparseColor(pointValue, min, max) {
    var normalizedValue = (pointValue - min) / (max - min)
    var selectedInterval = Math.floor(normalizedValue * _sparseColorNo)
    var color = SPARSE_COLORS[selectedInterval]
    var r = color >> (4 * 4)                // discard green and blue, i.e. four hex positions
    var g = (color & 0xFF00) >> (2 * 4)     // sample green and discard blue, i.e. 2 hex positions
    var b = color & 0xFF                    // only take the blue

    return [normalizeColor(r), normalizeColor(g), normalizeColor(b)]
}

// ================================= COLOR SCHEME FUNCTIONS  END  =================================

