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

Demo script for console profile which is showing how a project export can be done from the command line.
After running this script, you should have a message in the console telling where the exported ZIP is placed.

.. moduleauthor:: Lia Domide <lia.domide@codemart.ro>

"""

import tvb.interfaces.command.prepare
from tvb.core.services.project_service import ProjectService
from tvb.adapters.exporters.export_manager import ExportManager
from sys import argv


def run_export(project_id):

    s = ProjectService()
    mng = ExportManager()

    project = s.find_project(project_id)
    export_file = mng.export_project(project)
    print ("Check the exported file: %s" % export_file)


if __name__ == '__main__':

    if len(argv) < 2:
        print "You should specify a project ID to be exported!"

    print "We will try to export project with ID: " + str(argv[1])

    run_export(argv[0])