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
Change Project structure for TVB version 1.1.1.
In this version the location where ResultFigures are stored has changed.

.. moduleauthor:: Mihai Andrei <mihai.andrei@codemart.ro>
"""

from tvb.basic.config.settings import TVBSettings
from tvb.core.entities.storage import dao
from tvb.core.entities.file.files_helper import FilesHelper
from tvb.core.project_versions.project_update_manager import ProjectUpdateManager


PAGE_SIZE = 20


def _figures_in_project(project_id):
    grouped_figures, _ = dao.get_previews(project_id)
    figures = []

    for fv in grouped_figures.itervalues():
        figures.extend(fv)

    return figures


def update():
    """
    Move images previously stored in TVB operation folders, in a single folder/project.
    """
    projects_count = dao.get_all_projects(is_count=True)

    for page_start in range(0, projects_count, PAGE_SIZE):

        projects_page = dao.get_all_projects(page_start=page_start,
                                             page_end=min(page_start + PAGE_SIZE, projects_count))

        for project in projects_page:
            figures = _figures_in_project(project.id)

            for figure in figures:
                figure.file_path = "%s-%s" % (figure.operation.id, figure.file_path)

            dao.store_entities(figures)

            project_path = FilesHelper().get_project_folder(project)
            update_manager = ProjectUpdateManager(project_path)
            update_manager.run_all_updates()

            project.version = TVBSettings.PROJECT_VERSION
            dao.store_entity(project)


