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
.. moduleauthor:: Andrei Mihai <mihai.andrei@codemart.ro>

"""

import json
import numpy
import pylab
from tvb.basic.filters.chain import FilterChain
from tvb.basic.config.settings import TVBSettings
from tvb.core.utils import parse_slice, slice_str
from tvb.datatypes.arrays import MappedArray
from tvb.core.adapters.abcdisplayer import ABCDisplayer


def compute_2d_view(matrix, slice_s):
    """
    Create a 2d view of the matrix using the suggested slice
    If the given slice is invalid or fails to produce a 2d array the default is used
    which selects the first 2 dimensions.
    If the matrix is complex the real part is shown
    :param slice_s: a string representation of a slice
    :return: (a 2d array,  the slice used to make it, is_default_returned)
    """
    default = (slice(None), slice(None)) + tuple(0 for _ in range(matrix.ndim - 2))     # [:,:,0,0,0,0 etc]

    try:
        if slice_s is not None:
            matrix_slice = parse_slice(slice_s)
        else:
            matrix_slice = slice(None)

        m = matrix[matrix_slice]

        if m.ndim > 2:  # the slice did not produce a 2d array, treat as error
            raise ValueError(str(matrix.shape))

    except (IndexError, ValueError):  # if the slice could not be parsed or it failed to produce a 2d array
        matrix_slice = default

    slice_used = slice_str(matrix_slice)
    return matrix[matrix_slice].astype(float), slice_used, matrix_slice == default


def dump_prec(xs, prec=3):
    """ Dump a list of numbers into a string, each at the specified precision. """
    format_str = "%0." + str(prec) + "g"
    return "[" + ",".join(format_str % s for s in xs) + "]"


class MappedArraySVGVisualizerMixin(object):
    """
    To be mixed in a ABCDisplayer
    """
    def get_required_memory_size(self, datatype):
        input_size = datatype.read_data_shape()
        return numpy.prod(input_size) / input_size[0] * 8.0


    def generate_preview(self, datatype, figure_size):
        return self.launch(datatype)


    @staticmethod
    def compute_raw_matrix_params(matrix):
        """
        Serializes matrix data, shape and stride metadata to json
        """
        matrix_data = dump_prec(matrix.flat)
        matrix_shape = json.dumps(matrix.shape)
        matrix_strides = json.dumps([x / matrix.itemsize for x in matrix.strides])

        return dict(matrix_data=matrix_data,
                    matrix_shape=matrix_shape,
                    matrix_strides=matrix_strides)


    def compute_params(self, matrix, viewer_title, given_slice=None):
        """
        Prepare a 2d matrix to display
        :param matrix: input matrix
        :param given_slice: a string representation of a slice. This slice should cut a 2d view from matrix
        If the matrix is not 2d and the slice will not make it 2d then a default slice is used
        """
        matrix2d, slice_used, is_default_slice = compute_2d_view(matrix, given_slice)

        view_pars = self.compute_raw_matrix_params(matrix2d)
        view_pars.update(original_matrix_shape=str(matrix.shape),
                         show_slice_info=given_slice is not None,
                         given_slice=given_slice,
                         slice_used=slice_used,
                         is_default_slice=is_default_slice,
                         viewer_title=viewer_title)
        return view_pars


class MappedArrayMplVisualizer(object):
    @staticmethod
    def compute_parameters(matrix, plot_title):
        figure = pylab.figure(figsize=(7, 8))
        pylab.clf()

        axes = figure.gca()
        img = axes.matshow(matrix)
        axes.set_title(plot_title)
        figure.colorbar(img)
        figure.canvas.draw()
        return dict(mplh5ServerURL=TVBSettings.MPLH5_SERVER_URL, figureNumber=figure.number, showFullToolbar=True)



class MappedArrayVisualizer(MappedArraySVGVisualizerMixin, ABCDisplayer):

    _ui_name = "Matrix Visualizer"

    def get_input_tree(self):
        return [{'name': 'datatype', 'label': 'Array data type',
                 'type': MappedArray, 'required': True,
                 'conditions': FilterChain(fields=[FilterChain.datatype + '._nr_dimensions'],
                                           operations=[">="], values=[2])},
                {'name': 'slice', 'label': 'slice indices in numpy syntax',
                 'type': 'str', 'required': False}]


    def launch(self, datatype, slice=''):
        matrix = datatype.get_data('array_data')
        matrix2d, _, _ = compute_2d_view(matrix, slice)
        title = datatype.display_name + " matrix plot"

        pars = self.compute_params(matrix, title, slice)
        pars.update(MappedArrayMplVisualizer.compute_parameters(matrix2d, title))

        return self.build_display_result("matrix/combined_view", pars)