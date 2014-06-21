# -*- coding: utf-8 -*-
#
#
# TheVirtualBrain-Framework Package. This package holds all Data Management, and 
# Web-UI helpful to run brain-simulations. To use it, you also need do download
# TheVirtualBrain-Scientific Package (for simulators). See content of the
# documentation-folder for more details. See also http://www.thevirtualbrain.org
#
# (c) 2012-2013, Baycrest Centre for Geriatric Care ("Baycrest")
#
# This program is free software; you can redistribute it and/or modify it under 
# the terms of the GNU General Public License version 2 as published by the Free
# Software Foundation. This program is distributed in the hope that it will be
# useful, but WITHOUT ANY WARRANTY; without even the implied warranty of 
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
# License for more details. You should have received a copy of the GNU General 
# Public License along with this program; if not, you can download it here
# http://www.gnu.org/licenses/old-licenses/gpl-2.0
#
#
#   CITATION:
# When using The Virtual Brain for scientific publications, please cite it as follows:
#
#   Paula Sanz Leon, Stuart A. Knock, M. Marmaduke Woodman, Lia Domide,
#   Jochen Mersmann, Anthony R. McIntosh, Viktor Jirsa (2013)
#       The Virtual Brain: a simulator of primate brain network dynamics.
#   Frontiers in Neuroinformatics (7:10. doi: 10.3389/fninf.2013.00010)
#
#
"""
.. moduleauthor:: Lia Domide <lia.domide@codemart.ro>
"""

import os
import sys
import pylab
from abc import ABCMeta, abstractmethod
from tvb.basic.config.settings import TVBSettings as config
from tvb.core.decorators import synchronized
from tvb.core.adapters.abcadapter import ABCSynchronous
from tvb.core.adapters.exceptions import LaunchException
from tvb.core.entities.storage import dao

from threading import Lock
LOCK_CREATE_FIGURE = Lock()


class ABCDisplayer(ABCSynchronous):
    """
    Abstract class, for marking Adapters used for UI display only.
    """
    __metaclass__ = ABCMeta
    KEY_CONTENT_MODULE = "keyContentModule"
    KEY_CONTENT = "mainContent"
    KEY_IS_ADAPTER = "isAdapter"
    PARAM_FIGURE_SIZE = 'figure_size'
    VISUALIZERS_ROOT = ''
    VISUALIZERS_URL_PREFIX = ''
     
     
    def get_output(self):
        return []   


    def generate_preview(self, **kwargs):
        """
        Should be implemented by all visualizers that can be used by portlets.
        """
        raise LaunchException("%s used as Portlet but doesn't implement 'generate_preview'" % self.__class__)


    def _prelaunch(self, operation, uid=None, available_disk_space=0, **kwargs):
        """
        Shortcut in case of visualization calls.
        """
        self.operation_id = operation.id
        self.current_project_id = operation.project.id
        if operation.method_name == self.LAUNCH_METHOD:
            return self.launch(**kwargs), 0
        ## few methods are called from Visualizers directly (e.g. Connectivity Submit).
        return super(ABCDisplayer, self)._prelaunch(operation, **kwargs)
    
    
    def get_required_disk_size(self, **kwargs):
        """
        Visualizers should no occupy any additional disk space.
        """
        return 0


    def build_display_result(self, template, parameters, pages=None):
        """
        Helper method for building the result of the ABCDisplayer.
        :param template : path towards the HTML template to display. It can be absolute path, or relative
        :param parameters : dictionary with parameters for "template"
        :param pages : dictionary of pages to be used with <xi:include>
        """
        module_ref = __import__(self.VISUALIZERS_ROOT, globals(), locals(), ["__init__"])
        relative_path = os.path.dirname(module_ref.__file__)

        ### We still need the relative file path into desktop client
        if os.path.isabs(template):
            parameters[self.KEY_CONTENT_MODULE] = ""
        else:
            content_module = self.VISUALIZERS_ROOT + "." 
            content_module = content_module + template.replace("/", ".")
            parameters[self.KEY_CONTENT_MODULE] = content_module

        if not os.path.isabs(template):
            template = os.path.join(relative_path, template)
        if not os.path.isabs(template):
            template = os.path.join(os.path.dirname(sys.executable), template)
        if pages:
            for key, value in pages.items():
                if value is not None:
                    if not os.path.isabs(value):
                        value = os.path.join(relative_path, value)
                    if not os.path.isabs(value):
                        value = os.path.join(os.path.dirname(sys.executable), value)
                parameters[key] = value
        parameters[self.KEY_CONTENT] = template
        parameters[self.KEY_IS_ADAPTER] = True

        return parameters


    @staticmethod
    def get_one_dimensional_list(list_of_elements, expected_size, error_msg):
        """
        Used for obtaining a list of 'expected_size' number of elements from the
        list 'list_of_elements'. If the list 'list_of_elements' doesn't have 
        sufficient elements then an exception will be thrown.

        list_of_elements - a list of one or two dimensions
        expected_size - the number of elements that should have the returned list
        error_msg - the message that will be used for the thrown exception.
        """
        if len(list_of_elements) > 0 and isinstance(list_of_elements[0], list):
            if len(list_of_elements[0]) < expected_size:
                raise LaunchException(error_msg)
            return list_of_elements[0][:expected_size]
        else:
            if len(list_of_elements) < expected_size:
                raise LaunchException(error_msg)
            return list_of_elements[:expected_size]


    @staticmethod
    def paths2url(datatype_entity, attribute_name, flatten=False, parameter=None):
        """
        Prepare a File System Path for passing into an URL.
        """
        url = ABCDisplayer.VISUALIZERS_URL_PREFIX + datatype_entity.gid + '/' + attribute_name + '/' + str(flatten)

        if parameter is not None:
            url += "?" + str(parameter)
        return url
            
    
    def get_submit_method_url(self, method_name):
        """
        Return a valid form submit link, so that the method passed 
        as parameter will be invoked after submit.
        """
        algo_group = self.get_algo_group()
        url = '/flow/invokeadaptermethod/' + str(algo_group.id) + '/' + method_name
        return url
    
    
    def get_algo_group(self):
        """ Find AlgoGroup by module and class"""
        return dao.find_group(self.__module__, self.__class__.__name__)


    @staticmethod
    def build_template_params_for_subselectable_datatype(sub_selectable):
        """
        creates a template dict with the initial selection to be
        displayed in a time series viewer
        """
        return {'measurePointsSelectionGID': sub_selectable.get_measure_points_selection_gid(),
                'initialSelection': sub_selectable.get_default_selection(),
                'groupedLabels': sub_selectable.get_grouped_space_labels()}



class ABCMPLH5Displayer(ABCDisplayer):
    """
    Abstract class, for Displayer that will want to use MatplotLib graphs.
    """ 
    _ui_name = "MatplotLib Display"
    SHOW_FULL_TOOLBAR = 'show_toolbar'
    
    
    def __init__(self):
        ABCDisplayer.__init__(self)
        self.current_page = 0
        self.total_pages = 1
        self.figure = None
        self.kwargs = {}


    def __del__(self):
        pass

    
    @abstractmethod
    def plot(self, figure, **kwargs):
        """
        Abstract method, in the implementation, you should place calls like:
        figure.plot, figure.gca().set_ylabel()..... .
        """

    
    def generate_preview(self, **kwargs):
        self.is_preview = True
        return self.launch(**kwargs)
    
    
    def launch(self, **kwargs):
        """
        Actual drawing of data inside a new canvas.
        """
        if not hasattr(self, 'is_preview'):
            self.is_preview = False
        self.log.debug("Preparing for a new MPL figure....")

        show_full_toolbar = kwargs.pop(self.SHOW_FULL_TOOLBAR, True)

        if self.PARAM_FIGURE_SIZE in kwargs:
            figsize = kwargs.pop(self.PARAM_FIGURE_SIZE)
            figsize = (figsize[0] / 100, figsize[1] / 120)
        else:
            figsize = (15, 7)

        self.kwargs = kwargs
        self.figure = self._create_new_figure(figsize)
        self.plot(self.figure, **kwargs)
        self.figure.canvas.draw()

        parameters = dict(title=self._ui_name,
                          figureNumber=self.figure.number,
                          showFullToolbar=show_full_toolbar,
                          mplh5ServerURL=config.MPLH5_SERVER_URL)

        return self.build_display_result("mplh5/figure", parameters)


    @synchronized(LOCK_CREATE_FIGURE)
    def _create_new_figure(self, figsize):
        """
        synchronized method to avoid creating the same figure number.
        """
        return pylab.figure(figsize=figsize)

