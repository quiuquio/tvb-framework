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
.. moduleauthor:: Bogdan Neacsa <bogdan.neacsa@codemart.ro>
.. moduleauthor:: Yann Gordon <yann@invalid.tvb>
"""

import os
import sys
import signal
import Queue
import threading
from subprocess import Popen, PIPE
from tvb.basic.profile import TvbProfile as tvb_profile
from tvb.basic.config.settings import TVBSettings as config
from tvb.basic.logger.builder import get_logger
from tvb.core.utils import parse_json_parameters
from tvb.core.entities import model
from tvb.core.entities.storage import dao
from tvb.core.services.workflow_service import WorkflowService


LOGGER = get_logger(__name__)

CURRENT_ACTIVE_THREADS = []

LOCKS_QUEUE = Queue.Queue(0)
for i in range(config.MAX_THREADS_NUMBER):
    LOCKS_QUEUE.put(1)



class OperationExecutor(threading.Thread):
    """
    Thread in charge for starting an operation, used both on cluster and with stand-alone installations.
    """


    def __init__(self, op_id):
        threading.Thread.__init__(self)
        self.operation_id = op_id
        self._stop = threading.Event()


    def run(self):
        """
        Get the required data from the operation queue and launch the operation.
        """
        #Try to get a spot to launch own operation.
        LOCKS_QUEUE.get(True)
        operation_id = self.operation_id
        run_params = [config().get_python_path(), '-m', 'tvb.core.operation_async_launcher', str(operation_id)]

        if tvb_profile.CURRENT_SELECTED_PROFILE is not None:
            run_params.extend([tvb_profile.SUBPARAM_PROFILE, tvb_profile.CURRENT_SELECTED_PROFILE])

        # In the exceptional case where the user pressed stop while the Thread startup is done,
        # We should no longer launch the operation.
        if self.stopped() is False:

            env = os.environ.copy()
            env['PYTHONPATH'] = os.pathsep.join(sys.path)
            # anything that was already in $PYTHONPATH should have been reproduced in sys.path

            launched_process = Popen(run_params, stdout=PIPE, stderr=PIPE, env=env)

            LOGGER.debug("Storing pid=%s for operation id=%s launched on local machine." % (operation_id,
                                                                                            launched_process.pid))
            op_ident = model.OperationProcessIdentifier(operation_id, pid=launched_process.pid)
            dao.store_entity(op_ident)

            if self.stopped():
                # In the exceptional case where the user pressed stop while the Thread startup is done.
                # and stop_operation is concurrently asking about OperationProcessIdentity.
                self.stop_pid(launched_process.pid)

            subprocess_result = launched_process.communicate()
            LOGGER.info("Finished with launch of operation %s" % operation_id)
            returned = launched_process.wait()

            if returned != 0 and not self.stopped():
                # Process did not end as expected. (e.g. Segmentation fault)
                operation = dao.get_operation_by_id(self.operation_id)
                LOGGER.error("Operation suffered fatal failure! Exit code: %s Exit message: %s" % (returned,
                                                                                                   subprocess_result))

                operation.mark_complete(model.STATUS_ERROR,
                                        "Operation failed unexpectedly! Please check the log files.")
                dao.store_entity(operation)

                burst_entity = dao.get_burst_for_operation_id(self.operation_id)
                if burst_entity:
                    message = "Error in operation process! Possibly segmentation fault."
                    WorkflowService().mark_burst_finished(burst_entity, error=True, error_message=message)

            del launched_process

        #Give back empty spot now that you finished your operation
        CURRENT_ACTIVE_THREADS.remove(self)
        LOCKS_QUEUE.put(1)


    def stop(self):
        """ Mark current thread for stop"""
        self._stop.set()


    def stopped(self):
        """Check if current thread was marked for stop."""
        return self._stop.isSet()


    @staticmethod
    def stop_pid(pid):
        """
        Stop a process specified by PID.
        :returns: True when specified Process was stopped in here, \
                  False in case of exception(e.g. process stopped in advance).
        """
        if sys.platform == 'win32':
            try:
                import ctypes

                handle = ctypes.windll.kernel32.OpenProcess(1, False, int(pid))
                ctypes.windll.kernel32.TerminateProcess(handle, -1)
                ctypes.windll.kernel32.CloseHandle(handle)
            except OSError, _:
                return False
        else:
            try:
                os.kill(int(pid), signal.SIGKILL)
            except OSError, _:
                return False

        return True



class StandAloneClient(object):
    """
    Instead of communicating with a back-end cluster, fire locally a new thread.
    """


    @staticmethod
    def execute(operation_id, user_name_label, adapter_instance):
        """Start asynchronous operation locally"""
        thread = OperationExecutor(operation_id)
        CURRENT_ACTIVE_THREADS.append(thread)
        thread.start()


    @staticmethod
    def stop_operation(operation_id):
        """
        Stop a thread for a given operation id
        """
        operation = dao.get_operation_by_id(operation_id)
        if not operation or operation.status != model.STATUS_STARTED:
            LOGGER.warning("Operation already stopped or not found is given to stop job: %s" % operation_id)
            return True

        LOGGER.debug("Stopping operation: %s" % str(operation_id))

        ## Set the thread stop flag to true
        for thread in CURRENT_ACTIVE_THREADS:
            if int(thread.operation_id) == operation_id:
                thread.stop()
                LOGGER.debug("Found running thread for operation: %d" % operation_id)

        ## Kill Thread
        stopped = True
        operation_process = dao.get_operation_process_for_operation(operation_id)
        if operation_process is not None:
            ## Now try to kill the operation if it exists
            stopped = OperationExecutor.stop_pid(operation_process.pid)
            if not stopped:
                LOGGER.debug("Operation %d was probably killed from it's specific thread." % operation_id)
            else:
                LOGGER.debug("Stopped OperationExecutor process for %d" % operation_id)

        ## Mark operation as canceled in DB.
        operation.mark_cancelled()
        dao.store_entity(operation)
        return stopped



class ClusterSchedulerClient(object):
    """
    Simple class, to mimic the same behavior we are expecting from StandAloneClient, but firing behind
    the cluster job scheduling process..
    """


    @staticmethod
    def _run_cluster_job(operation_identifier, user_name_label, adapter_instance):
        """
        Threaded Popen
        It is the function called by the ClusterSchedulerClient in a Thread.
        This function starts a new process.
        """
        # Load operation so we can estimate the execution time
        operation = dao.get_operation_by_id(operation_identifier)
        kwargs = parse_json_parameters(operation.parameters)
        kwargs = adapter_instance.prepare_ui_inputs(kwargs)
        time_estimate = int(adapter_instance.get_execution_time_approximation(**kwargs))
        hours = int(time_estimate / 3600)
        minutes = (int(time_estimate) % 3600) / 60
        seconds = int(time_estimate) % 60
        # Anything lower than 5 hours just use default walltime
        if hours < 5:
            walltime = "05:00:00"
        else:
            if hours < 10:
                hours = "0%d" % hours
            else:
                hours = str(hours)
            walltime = "%s:%s:%s" % (hours, str(minutes), str(seconds))

        call_arg = config.CLUSTER_SCHEDULE_COMMAND % (walltime, operation_identifier, user_name_label)
        LOGGER.info(call_arg)
        process_ = Popen([call_arg], stdout=PIPE, shell=True)
        job_id = process_.stdout.read().replace('\n', '').split('OAR_JOB_ID=')[-1]
        LOGGER.debug("Got jobIdentifier = %s for CLUSTER operationID = %s" % (operation_identifier, job_id))
        operation_identifier = model.OperationProcessIdentifier(operation_identifier, job_id=job_id)
        dao.store_entity(operation_identifier)


    @staticmethod
    def execute(operation_id, user_name_label, adapter_instance):
        """Call the correct system command to submit a job to the cluster."""
        thread = threading.Thread(target=ClusterSchedulerClient._run_cluster_job,
                                  kwargs={'operation_identifier': operation_id,
                                          'user_name_label': user_name_label,
                                          'adapter_instance': adapter_instance})
        thread.start()


    @staticmethod
    def stop_operation(operation_id):
        """
        Stop a thread for a given operation id
        """
        operation = dao.get_operation_by_id(operation_id)
        if not operation or operation.status != model.STATUS_STARTED:
            LOGGER.warning("Operation already stopped or not found is given to stop job: %s" % operation_id)
            return True

        operation_process = dao.get_operation_process_for_operation(operation_id)
        result = 0
        ## Try to kill only if operation job process is not None
        if operation_process is not None:
            stop_command = config.CLUSTER_STOP_COMMAND % operation_process.job_id
            LOGGER.info("Stopping cluster operation: %s" % stop_command)
            result = os.system(stop_command)
            if result != 0:
                LOGGER.error("Stopping cluster operation was unsuccessful. "
                             "Try following with 'oarstat' for job ID: %s" % operation_process.job_id)

        operation.mark_cancelled()
        dao.store_entity(operation)

        return result == 0



if config.DEPLOY_CLUSTER:
    #Return an entity capable to submit jobs to the cluster.
    BACKEND_CLIENT = ClusterSchedulerClient()
else:
    #Return a thread launcher.
    BACKEND_CLIENT = StandAloneClient()

