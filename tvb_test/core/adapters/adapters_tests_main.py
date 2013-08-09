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
Created on Jul 21, 2011

.. moduleauthor:: Bogdan Neacsa <bogdan.neacsa@codemart.ro>
"""

import unittest
from tvb_test.core.adapters import xmlreader_test
from tvb_test.core.adapters import introspector_test
from tvb_test.core.adapters import adapters_memory_usage_tests
from tvb_test.core.adapters import abcadapter_test

def suite():
    """
        Gather all the tests in a test suite.
    """
    test_suite = unittest.TestSuite()
    test_suite.addTest(introspector_test.suite())
    test_suite.addTest(xmlreader_test.suite())
    test_suite.addTest(adapters_memory_usage_tests.suite())
    test_suite.addTest(abcadapter_test.suite())
    return test_suite


if __name__ == "__main__":
    #So you can run tests from this package individually.
    TEST_RUNNER = unittest.TextTestRunner()
    TEST_SUITE = suite()
    TEST_RUNNER.run (TEST_SUITE)
