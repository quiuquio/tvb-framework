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
.. moduleauthor:: Bogdan Neacsa <bogdan.neacsa@codemart.ro>
"""

import numpy
from tvb.basic.logger.builder import get_logger
from tvb.datatypes.connectivity import Connectivity


### Connectivity related constants
KEY_POS_X = 'pos_x'
KEY_POS_Y = 'pos_y'
KEY_POS_Z = 'pos_z'
KEY_POS_LABEL = 'label'
KEY_AREA = 'area'
KEY_ORIENTATION_AVG = 'average_orientation'
KEY_WEIGHT = 'weight'
KEY_TRACT = 'tract'
CFF_CONNECTIVITY_TITLE = "TVB Connectivity Matrix"

LOGGER = get_logger(__name__)


def _get_coord_xform(darray):
    """
    Extract the Coordinate Transform(s) from a Gifti DataArray.
    Return a Numpy array representing the transform.
    """
    #dspace = da.coordsys.contents.dataspace
    #xformspace = da.coordsys.contents.xformspace
    xform = darray.coordsys.contents.xform
    xform_ar = numpy.array(xform) 
    # reshape the array into a valid transform matrix
    xform_ar.shape = 4, 4          
    return xform_ar                       

#
# GRAPHML <-> Connectivity
#


def networkx2connectivity(network, storage_path):
    """
    Populate Connectivity DataType from NetworkX object.
    This method is deprecated.
    :param network: NetworkX graph
    :param storage_path: File path where to persist Connectivity.
    :return: Connectivity object
    """
    try:
        ## Try with default fields
        return networkx_default_2connectivity(network, storage_path)
    except Exception, exc:

        ## When exception, try fields as from Connectome Mapper Toolkit
        LOGGER.debug(exc)
        return networkx_cmt_2connectivity(network, storage_path)



def networkx_default_2connectivity(net, storage_path):
    """
    Populate Connectivity DataType from NetworkX object, as in the default CFF example.
    This is deprecated.
    """
    weights_matrix, tract_matrix, labels_vector = [], [], []
    positions, areas, orientation = [], [], []
    # Read all nodes
    graph_size = len(net.nodes())
    for node in net.nodes():
        node_data = net.node[node]
        positions.append([node_data[KEY_POS_X], node_data[KEY_POS_Y], node_data[KEY_POS_Z]])
        labels_vector.append(node_data[KEY_POS_LABEL])
        if KEY_AREA in node_data:
            areas.append(node_data[KEY_AREA])
        if KEY_ORIENTATION_AVG in node_data:
            orientation.append(node_data[KEY_ORIENTATION_AVG])
        weights_matrix.append([0.0] * graph_size)
        tract_matrix.append([0.0] * graph_size)
    # Read all edges
    for edge in net.edges():
        start = edge[0]
        end = edge[1]
        weights_matrix[start][end] = net.adj[start][end][KEY_WEIGHT]
        tract_matrix[start][end] = net.adj[start][end][KEY_TRACT]

    result = Connectivity()
    result.storage_path = storage_path
    result.weights = weights_matrix
    result.centres = positions
    result.region_labels = labels_vector
    result.set_metadata({'description': 'Array Columns: labels, X, Y, Z'}, 'centres')
    result.orientations = orientation
    result.areas = areas
    result.tract_lengths = tract_matrix
    return result


#
#   Connectome Mapper Toolkit
#


KEY_CMT_COORDINATES = "dn_position"
KEY_CMT_LABEL = ["dn_name", "dn_label"]

KEY_CMT_REGION = "dn_region"
KEY_CMT_REGION_CORTICAL = "cortical"

KEY_CMT_HEMISPHERE = "dn_hemisphere"
KEY_CMT_HEMISPHERE_RIGHT = "right"

KEY_CMT_WEIGHT = "fa_mean"
KEY_CMT_TRACT = "fiber_length_mean"


def _find_value(node_data, candidate_keys):
    """ find a value in node data using a list of candidate keys"""
    for key in candidate_keys:
        if key in node_data:
            return node_data[key]
    raise ValueError("could not find label")


def networkx_cmt_2connectivity(net, storage_path):
    """
    Populate Connectivity DataType from NetworkX object produced with Connectome Mapper Toolkit.
    """
    weights_matrix, tract_matrix, labels_vector = [], [], []
    positions, cortical, hemisphere = [], [], []

    # Read all nodes
    graph_size = len(net.nodes())

    for node in net.nodes():
        node_data = net.node[node]
        positions.append(list(node_data[KEY_CMT_COORDINATES]))

        label = _find_value(node_data, KEY_CMT_LABEL)
        labels_vector.append(str(label))

        weights_matrix.append([0.0] * graph_size)
        tract_matrix.append([0.0] * graph_size)

        if KEY_CMT_REGION_CORTICAL == node_data[KEY_CMT_REGION]:
            cortical.append(1)
        else:
            cortical.append(0)

        if KEY_CMT_HEMISPHERE_RIGHT == node_data[KEY_CMT_HEMISPHERE]:
            hemisphere.append(True)
        else:
            hemisphere.append(False)


    # Read all edges (and make the matrix square
    for edge in net.edges():
        start = edge[0]
        end = edge[1]
        weights_matrix[start - 1][end - 1] = net.adj[start][end][KEY_CMT_WEIGHT]
        weights_matrix[end - 1][start - 1] = weights_matrix[start - 1][end - 1]
        tract_matrix[start - 1][end - 1] = net.adj[start][end][KEY_CMT_TRACT]
        tract_matrix[end - 1][start - 1] = tract_matrix[start - 1][end - 1]

    result = Connectivity()
    result.storage_path = storage_path
    result.region_labels = labels_vector
    result.centres = positions
    result.set_metadata({'description': 'Array Columns: labels, X, Y, Z'}, 'centres')
    result.hemispheres = hemisphere
    result.cortical = cortical
    result.weights = weights_matrix
    result.tract_lengths = tract_matrix
    return result


