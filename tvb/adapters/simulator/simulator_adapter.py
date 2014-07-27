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
Adapter that uses the traits module to generate interfaces to the Simulator.
Few supplementary steps are done here:

   * from submitted Monitor/Model... names, build transient entities
   * after UI parameters submit, compose transient Cortex entity to be passed to the Simulator.

.. moduleauthor:: Lia Domide <lia.domide@codemart.ro>
.. moduleauthor:: Stuart A. Knock <Stuart@tvb.invalid>

"""
import numpy
from tvb.simulator.simulator import Simulator
from tvb.simulator.models import Model
from tvb.simulator.monitors import Monitor
from tvb.simulator.integrators import Integrator
from tvb.simulator.coupling import Coupling
from tvb.core.adapters.abcadapter import ABCAsynchronous
from tvb.core.adapters.exceptions import LaunchException
from tvb.basic.traits.parameters_factory import get_traited_subclasses
from tvb.datatypes.equations import HRFKernelEquation
from tvb.datatypes.surfaces import Cortex
from tvb.datatypes.simulation_state import SimulationState
from tvb.datatypes import noise_framework
import tvb.datatypes.time_series as time_series



class SimulatorAdapter(ABCAsynchronous):
    """
    Interface between the Simulator and the Framework.
    """
    _ui_name = "Simulation Core"

    algorithm = None

    available_models = get_traited_subclasses(Model)
    available_monitors = get_traited_subclasses(Monitor)
    available_integrators = get_traited_subclasses(Integrator)
    available_couplings = get_traited_subclasses(Coupling)

    # This is a list with the monitors that actually return multi dimensions for the state variable dimension.
    # We exclude from this for example EEG, MEG or Bold which return 
    HAVE_STATE_VARIABLES = ["GlobalAverage", "SpatialAverage", "Raw", "SubSample", "TemporalAverage"]


    def __init__(self):
        super(SimulatorAdapter, self).__init__()
        self.log.debug("%s: Initialized..." % str(self))


    def get_input_tree(self):
        """
        Return a list of lists describing the interface to the simulator. This
        is used by the GUI to generate the menus and fields necessary for
        defining a simulation.
        """
        sim = Simulator()
        sim.trait.bound = self.INTERFACE_ATTRIBUTES_ONLY
        result = sim.interface[self.INTERFACE_ATTRIBUTES]
        # We should add as hidden the Simulator State attribute.
        result.append({self.KEY_NAME: 'simulation_state', self.KEY_TYPE: SimulationState,
                       self.KEY_LABEL: "Continuation of", self.KEY_REQUIRED: False, self.KEY_UI_HIDE: True})
        return result


    def get_output(self):
        """
        :returns: list of classes for possible results of the Simulator.
        """
        return [time_series.TimeSeries]


    def configure(self, model, model_parameters, integrator, integrator_parameters, connectivity,
                  monitors, monitors_parameters=None, surface=None, surface_parameters=None, stimulus=None,
                  coupling=None, coupling_parameters=None, initial_conditions=None,
                  conduction_speed=None, simulation_length=0, simulation_state=None):
        """
        Make preparations for the adapter launch.
        """
        self.log.debug("available_couplings: %s..." % str(self.available_couplings))
        self.log.debug("coupling: %s..." % str(coupling))
        self.log.debug("coupling_parameters: %s..." % str(coupling_parameters))

        self.log.debug("%s: Initializing Model..." % str(self))
        noise_framework.build_noise(model_parameters)
        model_instance = self.available_models[str(model)](**model_parameters)
        self._validate_model_parameters(model_instance, connectivity, surface)

        self.log.debug("%s: Initializing Integration scheme..." % str(self))
        noise_framework.build_noise(integrator_parameters)
        integr = self.available_integrators[integrator](**integrator_parameters)

        self.log.debug("%s: Instantiating Monitors..." % str(self))
        monitors_list = []
        for monitor_name in monitors:
            if (monitors_parameters is not None) and (str(monitor_name) in monitors_parameters):
                current_monitor_parameters = monitors_parameters[str(monitor_name)]
                HRFKernelEquation.build_equation_from_dict('hrf_kernel', current_monitor_parameters, True)
                monitors_list.append(self.available_monitors[str(monitor_name)](**current_monitor_parameters))
            else:
                ### We have monitors without any UI settable parameter.
                monitors_list.append(self.available_monitors[str(monitor_name)]())

        if len(monitors) < 1:
            raise LaunchException("Can not launch operation without monitors selected !!!")

        self.log.debug("%s: Initializing Coupling..." % str(self))
        coupling_inst = self.available_couplings[str(coupling)](**coupling_parameters)

        self.log.debug("Initializing Cortex...")
        if self._is_surface_simulation(surface, surface_parameters):
            cortex_entity = Cortex(use_storage=False).populate_cortex(surface, surface_parameters)
            if cortex_entity.region_mapping_data.connectivity.number_of_regions != connectivity.number_of_regions:
                raise LaunchException("Incompatible RegionMapping -- Connectivity !!")
            if cortex_entity.region_mapping_data.surface.number_of_vertices != surface.number_of_vertices:
                raise LaunchException("Incompatible RegionMapping -- Surface !!")
            select_loc_conn = cortex_entity.local_connectivity
            if select_loc_conn is not None and select_loc_conn.surface.number_of_vertices != surface.number_of_vertices:
                raise LaunchException("Incompatible LocalConnectivity -- Surface !!")
        else:
            cortex_entity = None

        self.log.debug("%s: Instantiating requested simulator..." % str(self))
        connectivity.configure()
        self.algorithm = Simulator(connectivity=connectivity, coupling=coupling_inst, surface=cortex_entity,
                                   stimulus=stimulus, model=model_instance, integrator=integr,
                                   monitors=monitors_list, initial_conditions=initial_conditions,
                                   conduction_speed=conduction_speed)
        self.simulation_length = simulation_length
        self.log.debug("%s: Initializing storage..." % str(self))
        try:
            self.algorithm.configure()
            if simulation_state is not None:
                simulation_state.fill_into(self.algorithm)
        except ValueError, err:
            raise LaunchException("Failed to configure simulator due to invalid Input Values. It could be because "
                                  "of an incompatibility between different version of TVB code.", err)


    def get_required_memory_size(self, **kwargs):
        """
        Return the required memory to run this algorithm.
        """
        return self.algorithm.memory_requirement()


    def get_required_disk_size(self, **kwargs):
        """
        Return the required disk size this algorithm estimates it will take. (in kB)
        """
        return self.algorithm.storage_requirement(self.simulation_length) / 2 ** 10
    
    
    def get_execution_time_approximation(self, **kwargs):
        """
        Method should approximate based on input arguments, the time it will take for the operation 
        to finish (in seconds).
        """
        # This is just a brute approx so cluster nodes won't kill operation before
        # it's finished. This should be done with a higher grade of sensitivity
        # Magic number connecting simulation length to simulation computation time
        # This number should as big as possible, as long as it is still realistic, to
        magic_number = 6.57e-06     # seconds
        approx_number_of_nodes = 500
        approx_nvar = 15
        approx_modes = 15

        simulation_length = int(float(kwargs['simulation_length']))
        approx_integrator_dt = float(kwargs['integrator_parameters']['dt'])

        if approx_integrator_dt == 0.0:
            approx_integrator_dt = 1.0

        if 'surface' in kwargs and kwargs['surface'] is not None and kwargs['surface'] != '':
            approx_number_of_nodes *= approx_number_of_nodes

        estimation = magic_number * approx_number_of_nodes * approx_nvar * approx_modes * simulation_length \
            / approx_integrator_dt

        return max(int(estimation), 1)


    def launch(self, model, model_parameters, integrator, integrator_parameters, connectivity,
               monitors, monitors_parameters=None, surface=None, surface_parameters=None, stimulus=None,
               coupling=None, coupling_parameters=None, initial_conditions=None,
               conduction_speed=None, simulation_length=0, simulation_state=None):
        """
        Called from the GUI to launch a simulation.
          *: string class name of chosen model, etc...
          *_parameters: dictionary of parameters for chosen model, etc...
          connectivity: tvb.datatypes.connectivity.Connectivity object.
          surface: tvb.datatypes.surfaces.CorticalSurface: or None.
          stimulus: tvb.datatypes.patters.* object
        """
        result_datatypes = dict()
        start_time = self.algorithm.current_step * self.algorithm.integrator.dt

        for monitor in self.algorithm.monitors:
            m_name = monitor.__class__.__name__
            ts = monitor.create_time_series(self.storage_path, connectivity, surface)
            self.log.debug("Monitor %s created the TS %s" % (m_name, ts))
            # Now check if the monitor will return results for each state variable, in which case store
            # the labels for these state variables.
            # todo move these into monitors as well
            if m_name in self.HAVE_STATE_VARIABLES:
                selected_state_vars = [self.algorithm.model.state_variables[idx] for idx in monitor.voi]
                state_variable_dimension_name = ts.labels_ordering[1]
                ts.labels_dimensions[state_variable_dimension_name] = selected_state_vars

            ts.start_time = start_time
            result_datatypes[m_name] = ts

        #### Create Simulator State entity and persist it in DB. H5 file will be empty now.
        if not self._is_group_launch():
            simulation_state = SimulationState(storage_path=self.storage_path)
            self._capture_operation_results([simulation_state])

        ### Run simulation
        self.log.debug("%s: Starting simulation..." % str(self))
        for result in self.algorithm(simulation_length=simulation_length):
            for j, monitor in enumerate(monitors):
                if result[j] is not None:
                    result_datatypes[monitor].write_time_slice([result[j][0]])
                    result_datatypes[monitor].write_data_slice([result[j][1]])

        self.log.debug("%s: Completed simulation, starting to store simulation state " % str(self))
        ### Populate H5 file for simulator state. This step could also be done while running sim, in background.
        if not self._is_group_launch():
            simulation_state.populate_from(self.algorithm)
            self._capture_operation_results([simulation_state])

        self.log.debug("%s: Simulation state persisted, returning results " % str(self))
        final_results = []
        for result in result_datatypes.values():
            result.close_file()
            final_results.append(result)
        self.log.info("%s: Adapter simulation finished!!" % str(self))
        return final_results


    def _validate_model_parameters(self, model_instance, connectivity, surface):
        """
        Checks if the size of the model parameters is set correctly.
        """
        ui_configurable_params = model_instance.ui_configurable_parameters
        for param in ui_configurable_params:
            param_value = eval('model_instance.' + param)
            if isinstance(param_value, numpy.ndarray):
                if len(param_value) == 1 or connectivity is None:
                    continue
                if surface is not None:
                    if (len(param_value) != surface.number_of_vertices
                            and len(param_value) != connectivity.number_of_regions):
                        msg = str(surface.number_of_vertices) + ' or ' + str(connectivity.number_of_regions)
                        msg = self._get_exception_message(param, msg, len(param_value))
                        self.log.error(msg)
                        raise LaunchException(msg)
                elif len(param_value) != connectivity.number_of_regions:
                    msg = self._get_exception_message(param, connectivity.number_of_regions, len(param_value))
                    self.log.error(msg)
                    raise LaunchException(msg)


    @staticmethod
    def _get_exception_message(param_name, expected_size, actual_size):
        """
        Creates the message that will be displayed to the user when the size of a model parameter is incorrect.
        """
        msg = "The length of the parameter '" + param_name + "' is not correct."
        msg += " It is expected to be an array of length " + str(expected_size) + "."
        msg += " It is an array of length " + str(actual_size) + "."
        return msg

    @staticmethod
    def _is_surface_simulation(surface, surface_parameters):
        """
        Is this a surface simulation?
        """
        return surface is not None and surface_parameters is not None

