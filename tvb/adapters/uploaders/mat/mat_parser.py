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
# CITATION:
# When using The Virtual Brain for scientific publications, please cite it as follows:
#
#   Paula Sanz Leon, Stuart A. Knock, M. Marmaduke Woodman, Lia Domide,
#   Jochen Mersmann, Anthony R. McIntosh, Viktor Jirsa (2013)
#       The Virtual Brain: a simulator of primate brain network dynamics.
#   Frontiers in Neuroinformatics (7:10. doi: 10.3389/fninf.2013.00010)
#
#

"""
.. moduleauthor:: Mihai Andrei <mihai.andrei@codemart.ro>
"""
import numpy
import scipy.io


def read_nested_mat_structure(m, structure_path):
    """
    Reads data from a hierarchical structure array.
    If object arrays of shape (1,1) are found they are automatically flattened.
    :param m: A numpy structure array originating from a matlab mat file
    :param structure_path: A dot delimited path of field names: topfield.child.leaf
    :return: The leaf
    """
    structure_path = structure_path.strip()
    nested_fields = structure_path.split('.')

    if not structure_path:
        return m
    if '' in nested_fields:
        raise ValueError("bad path: '%s' " % structure_path)

    try:
        for field_name in nested_fields:
            # unwrap object arrays containers of shape 1, 1
            m = m[field_name]
            if issubclass(m.dtype.type, numpy.object_) and m.shape == (1, 1):
                m = m[0, 0]
    except ValueError as ex:
        raise ValueError("missing field: %s" % ex[0])

    return m


def read_nested_mat_file(data_file, dataset_name, structure_path):
    """
    Reads data from deep structures from a .mat file
    :param data_file: path to the mat file
    :param dataset_name: matlab variable name
    :param structure_path: A dot delimited path of field names: topfield.child.leaf
    :return: the leaf data
    """
    mat = scipy.io.loadmat(data_file)
    try:
        return read_nested_mat_structure(mat[dataset_name], structure_path)
    except KeyError as ex:
        raise KeyError("could not find: %s" % ex[0])