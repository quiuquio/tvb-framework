var startColorRGB = [192, 192, 192];
var endColorRGB = [255, 0, 0];
var nodeColorRGB = [255, 255, 255];
var normalizedStartColorRGB = normalizeColorArray(startColorRGB);   // keep the normalized version to avoid
var normalizedEndColorRGB = [1, 0, 0];                              // function calls on every color computation
var normalizedNodeColorRGB = [1, 1, 1];
var GVAR_colorScheme = "linear"                                     // the color scheme to be used for current drawing

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
 * Factory function which returns a color for the given point in interval (min, max),
 * according to the current <code>GVAR_colorScheme</code>
 *
 * @param pointValue The value whose corresponding color is returned
 *
 * NOTE: The following condition should be true: <code> min <= pointValue <= max </code>
 */
function getGradientColor(pointValue, min, max) {
    if (min == max)         // the interval is empty, so start color is the only possible one
        return [normalizedStartColorRGB[0], normalizedStartColorRGB[1], normalizedStartColorRGB[2]]
    var result = [];
    if (GVAR_colorScheme == "linear")                // default is "linear"
        result =  getLinearGradientColor(pointValue, min, max)
    else if (GVAR_colorScheme == "clowny")
        result = getClownyColor(pointValue, min, max)
    return result
}

/**
 * Factory function which computes the colors for a whole array of values in interval (min, max)
 * according to the current <code>GVAR_colorScheme</code>
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
    if (GVAR_colorScheme == "linear")
        for (var i = 0; i < values.length; ++i) {
            color = getLinearGradientColor(values[i], min, max)
            color.push(1)                               // add the alpha value
            if (outputArray)
                outputArray.set(color, i * 4)
            else
                result.concat(color)
        }
    else if (GVAR_colorScheme == "clowny")
        for (var i = 0; i < values.length; ++i) {
            color = getClownyColor(values[i], min, max)
            color.push(1)                               // add the alpha value
            if (outputArray)
                outputArray.set(color, i * 4)
            else
                result.concat(color)
        }

    return result;
}

function getLinearGradientColor(pointValue, min, max) {
    var normalizedValue = (pointValue - min) / (max - min)
    var r = normalizedStartColorRGB[0] + normalizedValue * (normalizedEndColorRGB[0] - normalizedStartColorRGB[0])
    var g = normalizedStartColorRGB[1] + normalizedValue * (normalizedEndColorRGB[1] - normalizedStartColorRGB[1])
    var b = normalizedStartColorRGB[2] + normalizedValue * (normalizedEndColorRGB[2] - normalizedStartColorRGB[2])

    return [normalizeValue(r), normalizeValue(g), normalizeValue(b)]
}

function getClownyColor(pointValue, min, max) {
    var normalizedValue = (pointValue - min) / (max - min)
    var r = normalizedStartColorRGB[0] + normalizedValue * (normalizedEndColorRGB[0] - normalizedStartColorRGB[0])
    var g = normalizedStartColorRGB[1] + (normalizedValue * 1000 - Math.round(normalizedValue * 1000)) *
                                         (normalizedEndColorRGB[1] - normalizedStartColorRGB[1])
    var b = normalizedStartColorRGB[2] + (normalizedValue * 1000000 - Math.round(normalizedValue * 1000000)) *
                                         (normalizedEndColorRGB[2] - normalizedStartColorRGB[2])

    return [normalizeValue(r), normalizeValue(g), normalizeValue(b)]
}

// ================================= COLOR SCHEME FUNCTIONS  END  =================================

