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
 * http://www.gnu.org/licenses/old-licenses/gpl-2.
 *
 *   CITATION:
 * When using The Virtual Brain for scientific publications, please cite it as follows:
 *
 *   Paula Sanz Leon, Stuart A. Knock, M. Marmaduke Woodman, Lia Domide,
 *   Jochen Mersmann, Anthony R. McIntosh, Viktor Jirsa (2013)
 *       The Virtual Brain: a simulator of primate brain network dynamics.
 *   Frontiers in Neuroinformatics (7:10. doi: 10.3389/fninf.2013.00010)
 *
 * .. moduleauthor:: Mihai Andrei <mihai.andrei@codemart.ro>
 **/

var TVBUI = TVBUI || {};

/**
 * depends on jquery and displayMessage
 * exports the RegionSelectComponent constructor
 * @module
 */
(function($, displayMessage, TVBUI){
"use strict";
/**
 * @constructor
 * @param dom selector or dom node
 * @param settings selectors for sub-components. see defaults
 */
function RegionSelectComponent(dom, settings){
    var $dom = $(dom);
    var self = this;
    settings = $.extend({}, self.defaults, settings);
    self.$dom = $dom;
    self.settings = settings;
    self._selectedValues = [];
    self._selectedIndices = [];
    self._namedSelections = [];
    self._allValues = [];
    self._labels = [];
    // save dom variables, set up listeners
    self._boxes = $dom.find(settings.boxesSelector);
    self._textBox = $dom.find(settings.textboxSelector);
    self._dropDown = $dom.find('select');
    self._dropDownOptions = self._dropDown.find('option');

    self._boxes.change(function(){self._onchange(this);});
    self._dropDown.change(function(){
        self._set_val(JSON.parse(this.value));
        self.$dom.trigger("selectionChange", [self._selectedValues.slice()]);
    });
    $dom.find(settings.checkSelector).click(function(){ self.checkAll();} );
    $dom.find(settings.uncheckSelector).click(function(){ self.clearAll();} );
    $dom.find(settings.saveSelectionButtonSelector).click(function(){ self._onNewSelection(); });

    $dom.find(settings.applySelector).click(function(){
        self.$dom.trigger("selectionApplied", [self._selectedValues.slice()]);
    });
    this.dom2model();
}

RegionSelectComponent.prototype.defaults = {
    applySelector: '.action-view',
    checkSelector: '.action-all-on',
    uncheckSelector: '.action-all-off',
    boxesSelector: 'input[type=checkbox]',
    textboxSelector : 'input[type=text]',
    saveSelectionButtonSelector : '.action-store'
};

/**
 * Subscribe a function to the selection change event 
 */
RegionSelectComponent.prototype.change = function(fn){
    this.$dom.on("selectionChange", function(_event, arg){ fn(arg); });
};

/**
 * Unbind all event handlers
 */
RegionSelectComponent.prototype.destroy = function(){
    this._boxes.off();
    this._dropDown.off();
    this.$dom.find(this.settings.checkSelector).off();
    this.$dom.find(this.settings.uncheckSelector).off();
    this.$dom.find(this.settings.saveSelectionButtonSelector).off();
    this.$dom.find(this.settings.applySelector).off();
    this.$dom.off("selectionChange");
};

/**
 * Updates the model from dom values
 * @private
 */
RegionSelectComponent.prototype.dom2model = function(){
    var self = this;
    self._allValues = [];
    self._selectedValues = [];
    self._selectedIndices = [];
    self._namedSelections = [];

    this._boxes.each(function(idx, el){
        self._allValues.push(el.value);
        // assumes the parent element is the label
        self._labels.push($(this).parent().text().trim());
        if(el.checked){
            self._selectedValues.push(el.value);
            self._selectedIndices.push(idx);
        }
    });
    this._dropDownOptions.each(function(i, el){
        if(i != 0){
            var $el = $(el);
            self._namedSelections.push([$el.text(), $el.val()]);
        }
    });
};

RegionSelectComponent.prototype._updateDecoration = function(el){
    // here we assume dom structure
    $(el).parent().toggleClass("selected", el.checked);
};

/**
 * Updates the dom from the selection model
 * @private
 */
RegionSelectComponent.prototype.selectedValues2dom = function(){
    var self = this;
    this._boxes.each(function(_, el){
        var idx = self._selectedValues.indexOf(el.value);
        el.checked = idx != -1;
        self._updateDecoration(el);
    });
    self._dropDownOptions = self._dropDown.find('option');
};

/**
 * Handler for save selection dom event
 * @private
 */
RegionSelectComponent.prototype._onNewSelection = function(){
    var self = this;
    var name = $.trim(self._textBox.val());
    if (name != ""){
        // add to model
        self._namedSelections.push([name, self._selectedValues.slice()]);
        self._textBox.val('');
        // do not update the selection box. let a event listener decide
        self.$dom.trigger("newSelection", [name, self._selectedValues.slice()]);
    }else{
		displayMessage("Selection name must not be empty.", "errorMessage");
	}
};

/**
 * Handler for checkbox change dom event
 * @private
 */
RegionSelectComponent.prototype._onchange = function(el){
    this.dom2model();
    this._dropDown.val("[]");
    this._updateDecoration(el);
    this.$dom.trigger("selectionChange", [this._selectedValues.slice()]);
};

/**
 * Sets the selection without triggering events
 * @private
 */
RegionSelectComponent.prototype._set_val = function(arg){
    this._selectedValues = [];
    this._selectedIndices =[];
    for(var i=0; i < arg.length; i++){
        // convert vals to string (as in dom)
        var val = arg[i].toString();
        // filter bad values
        var idx = this._allValues.indexOf(val);
        if( idx != -1){
            this._selectedValues.push(val);
            this._selectedIndices.push(idx);
        }else{
            console.warn("bad selection" + val);
        }
    }
    this.selectedValues2dom();
}

/**
 * Gets the selected values if no argument is given
 * Sets the selected values if an array of values is given as argument
 */
RegionSelectComponent.prototype.val = function(arg){
    if(arg == null){
        return this._selectedValues.slice();
    }else{
        this._set_val(arg);
        this._dropDown.val("[]");
        this.$dom.trigger("selectionChange", [this._selectedValues.slice()]);
    }
};

/**
 * Return the selected indices
 * @returns {Array}
 */
RegionSelectComponent.prototype.selectedIndices = function(){
    return this._selectedIndices.slice();
};

RegionSelectComponent.prototype.clearAll = function(){
    this.val([]);
};

RegionSelectComponent.prototype.checkAll = function(){
    this.val(this._allValues);
};

// exports
TVBUI.RegionSelectComponent = RegionSelectComponent;

})($, displayMessage, TVBUI);  //depends

/**
 * @module
 */
(function($, displayMessage, doAjaxCall, TVBUI){
"use strict";
/**
 * Creates a selection component which saves selections on the server
 */
TVBUI.regionSelector = function(dom, settings){
    var filterGid = settings.filterGid;
    var component =  new TVBUI.RegionSelectComponent(dom, settings);

    function getSelections() {
        doAjaxCall({type: "POST",
            async: false,
            url: '/flow/get_available_selections',
            data: {'datatype_gid': filterGid},
            success: function(r) {
                component._dropDown.empty().append(r);
                component._dropDown.val('[' + component._selectedValues.join(', ')     + ']');
            } ,
            error: function(r) {
                displayMessage("Error while retrieving available selections.", "errorMessage");
            }
        });
    }

    getSelections();

    component.$dom.on("newSelection", function(_ev, name, selection){
        doAjaxCall({  	type: "POST",
            url: '/flow/store_measure_points_selection/' + name,
            data: {'selection': JSON.stringify(selection),
                   'datatype_gid': filterGid},
            success: function(r) {
                var response = $.parseJSON(r);
                if (response[0]) {
                    getSelections();
                    displayMessage(response[1], "infoMessage");
                } else {
                    displayMessage(response[1], "errorMessage");
                }
            },
            error: function() {
                displayMessage("Selection was not saved properly.", "errorMessage");
            }
        });
    });
    return component;
};

})($, displayMessage, doAjaxCall, TVBUI); // depends


