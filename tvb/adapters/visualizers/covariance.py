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
A displayer for covariance.

.. moduleauthor:: Marmaduke Woodman <mw@eml.cc>

"""

from tvb.adapters.visualizers.matrix_viewer import MappedArrayVisualizer
from tvb.datatypes.graph import Covariance


class CovarianceVisualizer(MappedArrayVisualizer):
    _ui_name = "Covariance Visualizer"

    def get_input_tree(self):
        """Inform caller of the data we need"""
        return [{"name": "datatype", "type": Covariance,
                 "label": "Covariance", "required": True }]


    def launch(self, datatype):
        """Construct data for visualization and launch it."""
        # get data from corr datatype
        matrix = datatype.get_data('array_data')
        pars = self.compute_params(matrix, 'Covariance matrix plot')
        return self.build_display_result("matrix/svg_view", pars)
