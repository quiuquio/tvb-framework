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
Main controller for the updates related to the Project entity.

.. moduleauthor:: Lia Domide <lia.domide@codemart.ro>
"""

from tvb.basic.config.settings import TVBSettings
from tvb.core.code_versions.base_classes import UpdateManager
from tvb.core.entities.file.files_helper import FilesHelper
import tvb.core.project_versions.project_update_scripts as project_versions


class ProjectUpdateManager(UpdateManager):
    """
    This goes through all the scripts that are newer than the version number
    written in the current project metadata xml, and executes them on the project folder.
    """

    def __init__(self, project_path):

        self.project_path = project_path
        self.files_helper = FilesHelper()
        # This assumes that old project metadata file can be parsed by current version.
        self.project_meta = self.files_helper.read_project_metadata(project_path)
        from_version = self.project_meta.get('version', 0)

        super(ProjectUpdateManager, self).__init__(project_versions, from_version, TVBSettings.PROJECT_VERSION)


    def run_all_updates(self):
        """
        Upgrade the project to the latest structure
        Go through all update scripts, from project version up to the current_version in the code
        """
        super(ProjectUpdateManager, self).run_all_updates(project_path=self.project_path)

        # update project version in metadata
        self.project_meta['version'] = self.current_version
        self.files_helper.write_project_metadata_from_dict(self.project_path, self.project_meta)

