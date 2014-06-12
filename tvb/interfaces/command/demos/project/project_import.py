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
Demo script for console profile which is showing how a project import can be done from the command line.
Later on, this project will be available from the web-interface.

.. moduleauthor:: Lia Domide <lia.domide@codemart.ro>
"""

import tvb.interfaces.command.prepare
from tvb.core.entities import model
from tvb.core.services.user_service import UserService
from tvb.core.services.import_service import ImportService
from sys import argv



def run_import(project_path):

    ## If we would know a UserID to have as admin, next step would not be necessary.
    ## Make sure at least one user exists in TVB DB:
    user_service = UserService()
    admins = user_service.get_administrators()

    if admins:
        admin = admins[0]
    else:
        ## No Admin user was found, we will create one
        user_service.create_user("admin", "pass", role=model.ROLE_ADMINISTRATOR,
                                 email="info@thevirtualbrain.org", validated=True)
        admin = user_service.get_administrators()[0]

    ## Do the actual import of a project from ZIP:
    import_service = ImportService()
    import_service.import_project_structure(project_path, admin.id)

    print "Project imported successfully. Check the Web UI!"



if __name__ == '__main__':

    if len(argv) < 2:
        PROJECT_PATH = "2014-03-28_14-20_Epilepsy.zip"
    else:
        PROJECT_PATH = str(argv[1])

    print "We will try to import project at path " + PROJECT_PATH

    run_import(PROJECT_PATH)



