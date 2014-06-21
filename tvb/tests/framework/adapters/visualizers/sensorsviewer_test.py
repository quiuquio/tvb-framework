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

if __name__ == "__main__":
    from tvb.basic.profile import TvbProfile
    TvbProfile.set_profile(["-profile", TvbProfile.TEST_SQLITE_PROFILE], try_reload=False)

import os
import unittest
import tvb_data.surfaceData as surfaces_dataset
import tvb_data.sensors as sensors_dataset
from tvb.adapters.uploaders.sensors_importer import Sensors_Importer
from tvb.adapters.visualizers.sensors import EegSensorViewer, MEGSensorViewer, InternalSensorViewer
from tvb.core.entities.file.files_helper import FilesHelper
from tvb.datatypes.sensors import SensorsEEG, SensorsMEG, SensorsInternal
from tvb.datatypes.surfaces import EEGCap, EEG_CAP, FACE
from tvb.tests.framework.core.test_factory import TestFactory
from tvb.tests.framework.datatypes.datatypes_factory import DatatypesFactory
from tvb.tests.framework.core.base_testcase import TransactionalTestCase



class SensorViewersTest(TransactionalTestCase):
    """
    Unit-tests for Sensors viewers.
    """

    EXPECTED_KEYS_INTERNAL = {'urlMeasurePoints': None, 'urlMeasurePointsLabels': None, 'noOfMeasurePoints': 103,
                              'minMeasure': 0, 'maxMeasure': 103, 'urlMeasure': None, 'shelfObject': None}

    EXPECTED_KEYS_EEG = EXPECTED_KEYS_INTERNAL.copy()
    EXPECTED_KEYS_EEG.update({'urlVertices': None, 'urlTriangles': None, 'urlLines': None, 'urlNormals': None,
                              'boundaryURL': '', 'urlAlphas': '', 'urlAlphasIndices': '',
                              'noOfMeasurePoints': 62, 'maxMeasure': 62})

    EXPECTED_KEYS_MEG = EXPECTED_KEYS_EEG.copy()
    EXPECTED_KEYS_MEG.update({'noOfMeasurePoints': 151, 'maxMeasure': 151})


    def setUp(self):
        """
        Sets up the environment for running the tests;
        creates a test user, a test project, a connectivity and a surface;
        imports a CFF data-set
        """
        self.datatypeFactory = DatatypesFactory()
        self.test_project = self.datatypeFactory.get_project()
        self.test_user = self.datatypeFactory.get_user()

        ## Import Shelf Face Object
        zip_path = os.path.join(os.path.dirname(surfaces_dataset.__file__), 'face_surface_old.zip')
        TestFactory.import_surface_zip(self.test_user, self.test_project, zip_path, FACE, True)


    def tearDown(self):
        """
        Clean-up tests data
        """
        FilesHelper().remove_project_structure(self.test_project.name)


    def test_launch_EEG(self):
        """
        Check that all required keys are present in output from EegSensorViewer launch.
        """
        ## Import Sensors
        zip_path = os.path.join(os.path.dirname(sensors_dataset.__file__), 'EEG_unit_vectors_BrainProducts_62.txt.bz2')
        TestFactory.import_sensors(self.test_user, self.test_project, zip_path, Sensors_Importer.EEG_SENSORS)
        sensors = TestFactory.get_entity(self.test_project, SensorsEEG())

        ## Import EEGCap
        zip_path = os.path.join(os.path.dirname(surfaces_dataset.__file__), 'eeg_skin_surface.zip')
        TestFactory.import_surface_zip(self.test_user, self.test_project, zip_path, EEG_CAP, True)
        eeg_cap_surface = TestFactory.get_entity(self.test_project, EEGCap())

        viewer = EegSensorViewer()
        viewer.current_project_id = self.test_project.id

        ## Launch with EEG Cap selected
        result = viewer.launch(sensors, eeg_cap_surface)
        self.assert_compliant_dictionary(self.EXPECTED_KEYS_EEG, result)
        for key in ['urlVertices', 'urlTriangles', 'urlLines', 'urlNormals']:
            self.assertIsNotNone(result[key], "Value at key %s should not be None" % key)

        ## Launch without EEG Cap
        result = viewer.launch(sensors)
        self.assert_compliant_dictionary(self.EXPECTED_KEYS_EEG, result)
        for key in ['urlVertices', 'urlTriangles', 'urlLines', 'urlNormals']:
            self.assertTrue(not result[key] or result[key] == "[]",
                            "Value at key %s should be None or empty, but is %s" % (key, result[key]))


    def test_launch_MEG(self):
        """
        Check that all required keys are present in output from MEGSensorViewer launch.
        """

        zip_path = os.path.join(os.path.dirname(sensors_dataset.__file__), 'meg_channels_reg13.txt.bz2')
        TestFactory.import_sensors(self.test_user, self.test_project, zip_path, Sensors_Importer.MEG_SENSORS)
        sensors = TestFactory.get_entity(self.test_project, SensorsMEG())

        viewer = MEGSensorViewer()
        viewer.current_project_id = self.test_project.id

        result = viewer.launch(sensors)
        self.assert_compliant_dictionary(self.EXPECTED_KEYS_MEG, result)


    def test_launch_internal(self):
        """
        Check that all required keys are present in output from InternalSensorViewer launch.
        """
        zip_path = os.path.join(os.path.dirname(sensors_dataset.__file__), 'internal_39.txt.bz2')
        TestFactory.import_sensors(self.test_user, self.test_project, zip_path, Sensors_Importer.INTERNAL_SENSORS)
        sensors = TestFactory.get_entity(self.test_project, SensorsInternal())

        viewer = InternalSensorViewer()
        viewer.current_project_id = self.test_project.id

        result = viewer.launch(sensors)
        self.assert_compliant_dictionary(self.EXPECTED_KEYS_INTERNAL, result)



def suite():
    """
    Gather all the tests in a test suite.
    """
    test_suite = unittest.TestSuite()
    test_suite.addTest(unittest.makeSuite(SensorViewersTest))
    return test_suite



if __name__ == "__main__":
    #So you can run tests from this package individually.
    TEST_RUNNER = unittest.TextTestRunner()
    TEST_SUITE = suite()
    TEST_RUNNER.run(TEST_SUITE)