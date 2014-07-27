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
Unit-test for mat_timeseries_importer and mat_parser.

.. moduleauthor:: Mihai Andrei <mihai.andrei@codemart.ro>
"""

import unittest
import os
import tvb_data
from tvb.datatypes.connectivity import Connectivity
from tvb.datatypes.time_series import TimeSeriesRegion
from tvb.core.entities.storage import dao
from tvb.core.entities.file.files_helper import FilesHelper
from tvb.core.services.flow_service import FlowService
from tvb.core.adapters.abcadapter import ABCAdapter
from tvb.tests.framework.core.test_factory import TestFactory
from tvb.tests.framework.datatypes.datatypes_factory import DatatypesFactory
from tvb.tests.framework.core.base_testcase import TransactionalTestCase


class MatTimeSeriesImporterTest(TransactionalTestCase):

    base_pth = os.path.join(os.path.dirname(tvb_data.__file__), 'berlinSubjects', 'QL_20120814')
    bold_path = os.path.join(base_pth, 'QL_BOLD_regiontimecourse.mat')
    connectivity_path = os.path.join(base_pth, 'QL_20120814_Connectivity.zip')

    def setUp(self):
        self.datatypeFactory = DatatypesFactory()
        self.test_project = self.datatypeFactory.get_project()
        self.test_user = self.datatypeFactory.get_user()
        self._import_connectivity()


    def tearDown(self):
        FilesHelper().remove_project_structure(self.test_project.name)


    def _import_connectivity(self):
        group = dao.find_group('tvb.adapters.uploaders.zip_connectivity_importer', 'ZIPConnectivityImporter')
        importer = ABCAdapter.build_adapter(group)

        ### Launch Operation
        FlowService().fire_operation(importer, self.test_user, self.test_project.id,
                                     uploaded=self.connectivity_path, Data_Subject='QL')

        self.connectivity = TestFactory.get_entity(self.test_project, Connectivity())


    def test_import_bold(self):
        ### Retrieve Adapter instance
        group = dao.find_group('tvb.adapters.uploaders.mat_timeseries_importer', 'MatTimeSeriesImporter')
        importer = ABCAdapter.build_adapter(group)

        args = dict(data_file=self.bold_path, dataset_name='QL_20120824_DK_BOLD_timecourse', structure_path='',
                    transpose=False, slice=None, sampling_rate=1000, start_time=0,
                    tstype='region',
                    tstype_parameters_option_region_connectivity=self.connectivity.gid,
                    Data_Subject="QL")

        ### Launch import Operation
        FlowService().fire_operation(importer, self.test_user, self.test_project.id, **args)

        tsr = TestFactory.get_entity(self.test_project, TimeSeriesRegion())

        self.assertEqual((661, 1, 68, 1), tsr.read_data_shape())



def suite():
    """
    Gather all the tests in a test suite.
    """
    test_suite = unittest.TestSuite()
    test_suite.addTest(unittest.makeSuite(MatTimeSeriesImporterTest))
    return test_suite


if __name__ == "__main__":
    #So you can run tests from this package individually.
    TEST_RUNNER = unittest.TextTestRunner()
    TEST_SUITE = suite()
    TEST_RUNNER.run(TEST_SUITE)