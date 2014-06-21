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
Find a TS in current project (by Subject) and later run an analyzer on it

.. moduleauthor:: Lia Domide <lia.domide@codemart.ro>
"""

import tvb.interfaces.command.prepare
from time import sleep
from tvb.basic.logger.builder import get_logger
from tvb.core.adapters.abcadapter import ABCAdapter
from tvb.core.entities import model
from tvb.core.entities.storage import dao
from tvb.core.entities.transient.structure_entities import DataTypeMetaData
from tvb.core.services.flow_service import FlowService
from tvb.core.services.operation_service import OperationService
from tvb.adapters.analyzers.fourier_adapter import FourierAdapter
from tvb.datatypes.time_series import TimeSeriesRegion
from tvb.datatypes.spectral import FourierSpectrum


LOG = get_logger(__name__)


## Before starting this, we need to have TVB web interface launched at least once (to have a default project, user, etc)
if __name__ == "__main__":

    flow_service = FlowService()
    operation_service = OperationService()

    ## This ID of a project needs to exists in DB, and it can be taken from the WebInterface:
    project = dao.get_project_by_id(1)

    ## Prepare the Adapter
    adapter_instance = ABCAdapter.prepare_adapter(FourierAdapter)

    ## Prepare the input algorithms as if they were coming from web UI submit:
    time_series = dao.get_generic_entity(TimeSeriesRegion, DataTypeMetaData.DEFAULT_SUBJECT, "subject")
    if len(time_series) < 1:
        LOG.error("We could not find a compatible TimeSeries Datatype!")
    launch_args = {"time_series": time_series[0].gid}

    ## launch an operation and have the results stored both in DB and on disk
    launched_operation = flow_service.fire_operation(adapter_instance, project.administrator,
                                                     project.id, **launch_args)[0]

    ## wait for the operation to finish
    while launched_operation.status == model.STATUS_STARTED:
        sleep(5)
        launched_operation = dao.get_operation_by_id(launched_operation.id)

    if launched_operation.status == model.STATUS_FINISHED:
        fourier_spectrum = dao.get_generic_entity(FourierSpectrum, launched_operation.id, "fk_from_operation")[0]
        LOG.info("Fourier Spectrum result is: %s " % fourier_spectrum.summary_info)
        ## print fourier_spectrum.summary_info
    else:
        LOG.warning("Operation ended with problems [%s]: [%s]" % (launched_operation.status,
                                                                  launched_operation.additional_info))


