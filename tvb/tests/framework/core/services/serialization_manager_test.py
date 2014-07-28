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
module docstring
.. moduleauthor:: Mihai Andrei <mihai.andrei@codemart.ro>
"""
import json
import unittest
from tvb.core.entities.model import BurstConfiguration
from tvb.core.services.burst_config_serialization import INTEGRATOR_PARAMETERS, MODEL_PARAMETERS, SerializationManager
from tvb.simulator.integrators import HeunStochastic
from tvb.simulator.models import Hopfield, Generic2dOscillator
from tvb.tests.framework.core.base_testcase import TransactionalTestCase
from tvb.tests.framework.core.test_factory import TestFactory
from tvb.tests.framework.datatypes.datatypes_factory import DatatypesFactory


class SerializationManagerTest(TransactionalTestCase):
    CONF_HOPFIELD_HEUN_STOCH_RANGES = r"""
    {"": {"value": "0.1"},
    "model_parameters_option_Hopfield_noise_parameters_option_Noise_random_stream": {"value": "RandomStream"},
     "model_parameters_option_Hopfield_state_variable_range_parameters_theta": {"value": "[ 0.  1.]"},
     "integrator": {"value": "HeunStochastic"},
     "model_parameters_option_Hopfield_variables_of_interest": {"value": ["x"]},
     "surface": {"value": ""},
     "simulation_length": {"value": "100.0"},
     "monitors_parameters_option_TemporalAverage_period": {"value": "0.9765625"},
     "integrator_parameters_option_HeunStochastic_noise_parameters_option_Additive_nsig": {"value": "[0.00123]"},
     "monitors": {"value": ["TemporalAverage"]},
     "model_parameters_option_Hopfield_noise_parameters_option_Noise_random_stream_parameters_option_RandomStream_init_seed": {"value": "42"},
     "conduction_speed": {"value": "3.0"},
     "model_parameters_option_Hopfield_noise_parameters_option_Noise_ntau": {"value": "0.0"},
     "currentAlgoId": {"value": 64},
     "integrator_parameters_option_HeunStochastic_noise_parameters_option_Multiplicative_random_stream_parameters_option_RandomStream_init_seed": {"value": "42"},
     "integrator_parameters_option_HeunStochastic_noise_parameters_option_Additive_random_stream": {"value": "RandomStream"},
     "connectivity": {"value": "be827732-1655-11e4-ae16-c860002c3492"},
     "model_parameters_option_Hopfield_noise": {"value": "Noise"},
     "range_1": {"value": "model_parameters_option_Hopfield_taux"},
     "model_parameters_option_Hopfield_taux": {"value": "{\"minValue\":0.7,\"maxValue\":1,\"step\":0.1}"},
     "range_2": {"value": "0"},
     "coupling_parameters_option_Linear_b": {"value": "[0.0]"},
     "coupling_parameters_option_Linear_a": {"value": "[0.00390625]"},
     "coupling": {"value": "Linear"},
     "model_parameters_option_Hopfield_state_variable_range_parameters_x": {"value": "[-1.  2.]"},
     "stimulus": {"value": ""},
     "integrator_parameters_option_HeunStochastic_dt": {"value": "0.09765625"},
     "model_parameters_option_Hopfield_dynamic": {"value": "[0]"},
     "integrator_parameters_option_HeunStochastic_noise_parameters_option_Additive_ntau": {"value": "0.0"},
     "model_parameters_option_Hopfield_tauT": {"value": "[5.0]"},
     "integrator_parameters_option_HeunStochastic_noise": {"value": "Additive"},
     "model": {"value": "Hopfield"},
     "integrator_parameters_option_HeunStochastic_noise_parameters_option_Additive_random_stream_parameters_option_RandomStream_init_seed": {"value": "42"}
     }
    """

    def setUp(self):
        _, self.connectivity = DatatypesFactory().create_connectivity()
        self.test_user = TestFactory.create_user(username="test_user")
        self.test_project = TestFactory.create_project(self.test_user, "Test")

        burst_conf = BurstConfiguration(self.test_project.id)
        burst_conf._simulator_configuration = self.CONF_HOPFIELD_HEUN_STOCH_RANGES
        burst_conf.prepare_after_load()
        burst_conf.simulator_configuration['connectivity'] = {'value': self.connectivity.gid}

        self.s_manager = SerializationManager(burst_conf)
        self.empty_manager = SerializationManager(BurstConfiguration(None))


    def test_has_model_pse_ranges(self):
        self.assertTrue(self.s_manager.has_model_pse_ranges())
        self.assertFalse(self.empty_manager.has_model_pse_ranges())


    def test_get_params_dict(self):
        d = self.s_manager._get_params_dict()
        mp = d[MODEL_PARAMETERS]
        ip = d[INTEGRATOR_PARAMETERS]
        # test model param deserialization
        self.assertEqual([5], mp['tauT'].tolist())
        self.assertEqual([{'step': 0.1, 'maxValue': 1, 'minValue': 0.7}], mp['taux'].tolist())
        # test integrator param deserialization
        self.assertEqual(0.09765625, ip['dt'])
        self.assertEqual([ 0.00123], ip['noise_parameters']['nsig'].tolist())


    def test_make_model_and_integrator(self):
        m ,i = self.s_manager.make_model_and_integrator()
        self.assertIsInstance(m, Hopfield)
        self.assertIsInstance(i, HeunStochastic)


    def test_group_parameter_values_by_name(self):
        gp = SerializationManager.group_parameter_values_by_name(
            [{"a": 2.0, 'b': 1.0},
             {"a": 3.0, 'b': 7.0}])
        self.assertEqual({'a': [2.0, 3.0], 'b': [1.0, 7.0]}, gp)


    def test_write_model_parameters(self):
        m_name = Generic2dOscillator.__name__
        m_parms = {'I': 0.0, 'a': 1.75, 'alpha': 1.0, 'b': -10.0, 'beta': 1.0, 'c': 0.0,
               'd': 0.02, 'e': 3.0, 'f': 1.0, 'g': 0.0, 'gamma': 1.0, 'tau': 1.47}
        self.s_manager.write_model_parameters(m_name, [m_parms.copy() for _ in xrange(self.connectivity.number_of_regions)])

        sc = self.s_manager.conf.simulator_configuration

        self.assertEqual(Generic2dOscillator.__name__, sc['model']['value'])

        expected = [1.75] * self.connectivity.number_of_regions
        actual = json.loads(sc['model_parameters_option_Generic2dOscillator_a']['value'])
        self.assertEqual(expected, actual)


    def test_write_noise_parameters(self):
        disp = [{"x":4,"theta":2} for _ in xrange(self.connectivity.number_of_regions)]
        self.s_manager.write_noise_parameters(disp)

        sc = self.s_manager.conf.simulator_configuration
        self.assertEqual(HeunStochastic.__name__, sc['integrator']['value'])
        nodes_nr = self.connectivity.number_of_regions
        expected = [[4] * nodes_nr , [2] * nodes_nr]
        actual = json.loads(sc['integrator_parameters_option_HeunStochastic_noise_parameters_option_Additive_nsig']['value'])
        self.assertEqual(expected, actual)


def suite():
    test_suite = unittest.TestSuite()
    test_suite.addTest(unittest.makeSuite(SerializationManagerTest))
    return test_suite


if __name__ == "__main__":
    #So you can run tests individually.
    TEST_RUNNER = unittest.TextTestRunner()
    TEST_SUITE = suite()
    TEST_RUNNER.run(TEST_SUITE)






