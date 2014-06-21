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

from tvb.adapters.uploaders.abcuploader import ABCUploader
from tvb.adapters.uploaders.constants import DATA_NAME_PROJECTION
from tvb.basic.filters.chain import FilterChain
from tvb.basic.logger.builder import get_logger
from tvb.core.adapters.exceptions import LaunchException
from tvb.datatypes.surfaces import CorticalSurface
from tvb.datatypes.connectivity import Connectivity
from tvb.datatypes.sensors_data import SensorsData
from tvb.datatypes.sensors import SensorsEEG
from tvb.datatypes.projections import ProjectionSurfaceEEG, ProjectionRegionEEG
from tvb.datatypes.projections import ProjectionSurfaceMEG, ProjectionRegionMEG



class ProjectionMatrixRegionEEGImporter(ABCUploader):
    """
    Upload ProjectionMatrix Region -> EEG/MEG Sensors from a MAT file.
    """

    _ui_name = "Projection Matrix Regions - EEG/MEG"
    _ui_description = "Upload a Projection Matrix between Connectivity and EEG/MEG Sensors."
    logger = get_logger(__name__)


    def get_upload_input_tree(self):
        """
        Define input parameters for this importer.
        """
        return [{'name': 'projection_file', 'type': 'upload', 'required_type': '.mat',
                 'label': 'Projection matrix file (.mat format)', 'required': True,
                 'description': 'Expected a mat file containing projection matrix values.'},

                {'name': 'dataset_name', 'type': 'str', 'required': True,
                 'label': 'Matlab dataset name', 'default': DATA_NAME_PROJECTION,
                 'description': 'Name of the MATLAB dataset where data is stored'},

                {'name': 'connectivity', 'label': 'Large Scale Connectivity',
                 'type': Connectivity, 'required': True, 'datatype': True,
                 'description': 'The Connectivity Regions used by the uploaded projection matrix.'},

                {'name': 'sensors', 'label': 'Sensors',
                 'type': SensorsData, 'required': True, 'datatype': True,
                 'conditions': FilterChain(fields=[FilterChain.datatype + '.type'], operations=["in"],
                                           values=[['SensorsEEG', 'SensorsMEG']]),
                 'description': 'The Sensors used in for current projection.'}
                ]
              
                             
    def get_output(self):
        return [ProjectionRegionEEG, ProjectionRegionMEG]


    def launch(self, projection_file, dataset_name, connectivity, sensors):
        """
        Creates ProjectionMatrix entity from uploaded data.

        :param projection_file: a mat file containing projection matrix values which map \
                                the connectivity to the sensors; the matrix size should be \
                                `connectivity.number_of_regions` x `sensors.number_of_sensors`

        :raises LaunchException: when no connectivity is specified
        """

        if connectivity is None:
            raise LaunchException("No source connectivity selected."
                                  " Please initiate upload again and select a connectivity.")

        if isinstance(sensors, SensorsEEG):
            projection_matrix = ProjectionRegionEEG(storage_path=self.storage_path)
        else:
            projection_matrix = ProjectionRegionMEG(storage_path=self.storage_path)

        ## Actual full expected shape is no_of_sensors x sources_size
        expected_no = connectivity.number_of_regions

        return self.generic_launch(projection_file, dataset_name, connectivity, sensors, expected_no, projection_matrix)
        
        
    def generic_launch(self, projection_file, dataset_name, sources, sensors, expected_shape, projection_matrix):
        """
        Generic method, to be called also for preparing a Region EEG/MEG Projection import.

        :raises LaunchException: when
                    * no projection_file or sensors are specified
                    * the dataset is invalid
                    * number of sensors is different from the one in dataset
        """
        if projection_file is None:
            raise LaunchException("Please select MATLAB file which contains data to import")

        if sensors is None:
            raise LaunchException("No sensors selected. Please initiate upload again and select one.")
        
        self.logger.debug("Reading projection matrix from uploaded file...")
        eeg_projection_data = self.read_matlab_data(projection_file, dataset_name)
        
        if eeg_projection_data is None or len(eeg_projection_data) == 0:
            raise LaunchException("Invalid (empty) dataset...")
        
        if eeg_projection_data.shape[0] != sensors.number_of_sensors:
            raise LaunchException("Invalid Projection Matrix shape[0]: %d Expected: %d" % (eeg_projection_data.shape[0],
                                                                                           sensors.number_of_sensors))
        
        if eeg_projection_data.shape[1] != expected_shape:
            raise LaunchException("Invalid Projection Matrix shape[1]: %d Expected: %d" % (eeg_projection_data.shape[1],
                                                                                           expected_shape))
        
        self.logger.debug("Creating Projection Matrix instance")
        projection_matrix.sources = sources
        projection_matrix.sensors = sensors
        if eeg_projection_data is not None:
            projection_matrix.projection_data = eeg_projection_data
        return [projection_matrix]

 
 

class ProjectionMatrixSurfaceEEGImporter(ProjectionMatrixRegionEEGImporter):
    """
    Upload ProjectionMatrix Cortical Surface -> EEG/MEG Sensors from a MAT file.
    """

    _ui_name = "Projection Matrix Surface - EEG/MEG"
    _ui_description = "Upload a Projection Matrix between a Brain Cortical Surface and EEG/MEG Sensors."
 
 
    def get_upload_input_tree(self):
        """
        Define input parameters for this importer.
        """
        input_tree = super(ProjectionMatrixSurfaceEEGImporter, self).get_upload_input_tree()
        input_tree[2] = {'name': 'surface', 'label': 'Brain Cortical Surface', 
                         'type': CorticalSurface, 'required': True, 'datatype': True,
                         'description': 'The Brain Surface used by the uploaded projection matrix.'}
        return input_tree
              
                             
    def get_output(self):
        return [ProjectionSurfaceEEG, ProjectionSurfaceMEG]

    
    def launch(self, projection_file, surface, sensors, dataset_name=DATA_NAME_PROJECTION):
        """
        Creates ProjectionMatrix entity from uploaded data.
        """
        if surface is None:
            raise LaunchException("No source selected. Please initiate upload again and select a source.")
        if isinstance(sensors, SensorsEEG):
            projection_matrix = ProjectionSurfaceEEG(storage_path=self.storage_path)
        else:
            projection_matrix = ProjectionSurfaceMEG(storage_path=self.storage_path)
        expected_shape = surface.number_of_vertices
        
        return self.generic_launch(projection_file, dataset_name, surface, sensors, expected_shape, projection_matrix)
   
   
    
    