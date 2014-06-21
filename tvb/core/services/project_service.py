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
Service Layer for the Project entity.

.. moduleauthor:: Lia Domide <lia.domide@codemart.ro>
.. moduleauthor:: Bogdan Neacsa <bogdan.neacsa@codemart.ro>
"""

import os
import copy
import json
import formencode
from inspect import stack, getmro

from tvb.core import utils
from tvb.basic.traits.types_mapped import MappedType
from tvb.basic.logger.builder import get_logger
from tvb.basic.filters.chain import FilterChain
from tvb.core.entities.model import DataTypeGroup
from tvb.core.utils import string2date, date2string, timedelta2string
from tvb.core.removers_factory import get_remover
from tvb.core.entities import model
from tvb.core.entities.storage import dao, transactional
from tvb.core.entities.transient.context_overlay import CommonDetails, DataTypeOverlayDetails, OperationOverlayDetails
from tvb.core.entities.transient.filtering import StaticFiltersFactory
from tvb.core.entities.transient.structure_entities import StructureNode, DataTypeMetaData
from tvb.core.entities.file.files_helper import FilesHelper
from tvb.core.entities.file.exceptions import FileStructureException
from tvb.core.services.event_handlers import handle_event
from tvb.core.services.exceptions import StructureException, ProjectServiceException
from tvb.core.services.exceptions import RemoveDataTypeException
from tvb.core.services.user_service import UserService
from tvb.core.adapters.abcadapter import ABCAdapter


def initialize_storage():
    """
    Create Projects storage root folder in case it does not exist.
    """
    try:
        helper = FilesHelper()
        helper.check_created()
    except FileStructureException, excep:
        # Do nothing, because we do not have any UI to display exception
        logger = get_logger("tvb.core.services.initialize_storage")
        logger.error("Could not make sure the root folder exists!")
        logger.exception(excep)


## TODO move this page sizes into User-Settings once we have a UI table to set it.
OPERATIONS_PAGE_SIZE = 20
PROJECTS_PAGE_SIZE = 20
KEY_VALUE = "value"

MONTH_YEAR_FORMAT = "%B %Y"
DAY_MONTH_YEAR_FORMAT = "%d %B %Y"



class ProjectService:
    """
    Services layer for Project entities.
    """


    def __init__(self):
        self.logger = get_logger(__name__)
        self.structure_helper = FilesHelper()


    def store_project(self, current_user, is_create, selected_id, **data):
        """
        We want to create/update a project entity.
        """
        #Validate Unique Name
        new_name = data["name"]
        if len(new_name) < 1:
            raise ProjectServiceException("Invalid project name!")
        projects_no = dao.count_projects_for_name(new_name, selected_id)
        if projects_no > 0:
            err = {'name': 'Please choose another name, this one is used!'}
            raise formencode.Invalid("Duplicate Name Error", {}, None, error_dict=err)
        started_operations = dao.get_operation_numbers(selected_id)[1]
        if started_operations > 0:
            raise ProjectServiceException("A project can not be renamed while operations are still running!")
        if is_create:
            current_proj = model.Project(new_name, current_user.id, data["description"])
            self.structure_helper.get_project_folder(current_proj)
        else:
            try:
                current_proj = dao.get_project_by_id(selected_id)
            except Exception, excep:
                self.logger.error("An error has occurred!")
                self.logger.exception(excep)
                raise ProjectServiceException(str(excep))
            if current_proj.name != new_name:
                self.structure_helper.rename_project_structure(current_proj.name, new_name)
            current_proj.name = new_name
            current_proj.description = data["description"]
        #Commit to make sure we have a valid ID
        current_proj.refresh_update_date()
        self.structure_helper.write_project_metadata(current_proj)
        current_proj = dao.store_entity(current_proj)

        if is_create:
            handle_event(".".join([self.__class__.__name__, stack()[0][3]]), dao.get_system_user(), current_proj)

        #Retrieve, to initialize lazy attributes
        current_proj = dao.get_project_by_id(current_proj.id)
        #Update share settings on current Project entity
        visited_pages = []
        prj_admin = current_proj.administrator.username
        if 'visited_pages' in data and data['visited_pages']:
            visited_pages = data['visited_pages'].split(',')
        for page in visited_pages:
            members = UserService.retrieve_all_users(prj_admin, int(page))[0]
            members = [m.id for m in members]
            dao.delete_members_for_project(current_proj.id, members)
        selected_user_ids = data["users"]
        for u_id in selected_user_ids:
            dao.store_entity(model.User_to_Project(u_id, current_proj.id))
        #Finish operation
        self.logger.debug("Edit/Save OK for project:" + str(current_proj.id) + ' by user:' + current_user.username)
        return current_proj


    def find_project(self, project_id):
        """
        Simply retrieve Project entity from Database.
        """
        try:
            return dao.get_project_by_id(project_id)
        except Exception, excep:
            self.logger.error("Given Project ID was not found in DB!")
            self.logger.exception(excep)
            raise ProjectServiceException(str(excep))


    @staticmethod
    def count_filtered_operations(project_id, filters=None):
        """Pass to DAO counters for filtered operations"""
        return dao.get_filtered_operations(project_id, filters, is_count=True)


    def retrieve_project_full(self, project_id, applied_filters=None, current_page=1):
        """
        Return a Tuple with Project entity and Operations for current Project.
        :param project_id: Current Project Identifier
        :param applied_filters: Filters to apply on Operations
        :param current_page: Number for current page in operations
        """
        selected_project = self.find_project(project_id)
        total_filtered = self.count_filtered_operations(project_id, applied_filters)
        start_idx = OPERATIONS_PAGE_SIZE * (current_page - 1)

        if total_filtered >= start_idx + OPERATIONS_PAGE_SIZE:
            end_idx = OPERATIONS_PAGE_SIZE
        else:
            end_idx = total_filtered - start_idx

        pages_no = total_filtered // OPERATIONS_PAGE_SIZE + (1 if total_filtered % OPERATIONS_PAGE_SIZE else 0)
        total_ops_nr = self.count_filtered_operations(project_id)
        current_ops = dao.get_filtered_operations(project_id, applied_filters, start_idx, end_idx)
        started_ops = 0
        if current_ops is None:
            return selected_project, [], 0
        operations = []
        for one_op in current_ops:
            try:
                result = {}
                if one_op[0] != one_op[1]:
                    result["id"] = str(one_op[0]) + "-" + str(one_op[1])
                else:
                    result["id"] = str(one_op[0])
                burst = dao.get_burst_for_operation_id(one_op[0])
                result["burst_name"] = burst.name if burst else '-'
                result["count"] = one_op[2]
                result["gid"] = one_op[14]
                if one_op[3] is not None and one_op[3]:
                    try:
                        operation_group = dao.get_generic_entity(model.OperationGroup, one_op[3])[0]
                        result["group"] = operation_group.name
                        result["group"] = result["group"].replace("_", " ")
                        result["operation_group_id"] = operation_group.id
                        datatype_group = dao.get_datatypegroup_by_op_group_id(one_op[3])
                        datatype = dao.get_datatype_by_id(datatype_group.id)
                        result["datatype_group_gid"] = datatype.gid
                        result["gid"] = operation_group.gid

                        ## Filter only viewers for DataTypeGroup
                        view_categ = dao.get_visualisers_categories()[0]
                        launcher = self.retrieve_launchers(datatype.gid, include_categories=[view_categ.id]).values()[0]

                        view_groups = []
                        for launcher in launcher.values():
                            url = '/flow/' + str(launcher['category']) + '/' + str(launcher['id'])
                            if launcher['part_of_group']:
                                url = '/flow/prepare_group_launch/' + datatype.gid + '/' + \
                                      str(launcher['category']) + '/' + str(launcher['id'])
                            view_groups.append(dict(name=launcher["displayName"],
                                                    url=url,
                                                    param_name=launcher['children'][0]['param_name'],
                                                    part_of_group=launcher['part_of_group']))
                        result["view_groups"] = view_groups

                    except Exception, excep:
                        self.logger.error(excep)
                        self.logger.warning("Will ignore group on entity:" + str(one_op))
                        result["datatype_group_gid"] = None
                else:
                    result['group'] = None
                    result['datatype_group_gid'] = None
                result["algorithm"] = dao.get_algorithm_by_id(one_op[4])
                result["method"] = one_op[5]
                result["user"] = dao.get_user_by_id(one_op[6])
                if type(one_op[7]) in (str, unicode):
                    result["create"] = string2date(str(one_op[7]))
                else:
                    result["create"] = one_op[7]
                if type(one_op[8]) in (str, unicode):
                    result["start"] = string2date(str(one_op[8]))
                else:
                    result["start"] = one_op[8]
                if type(one_op[9]) in (str, unicode):
                    result["complete"] = string2date(str(one_op[9]))
                else:
                    result["complete"] = one_op[9]

                if result["complete"] is not None and result["start"] is not None:
                    result["duration"] = timedelta2string(result["complete"] - result["start"])
                result["status"] = one_op[10]
                if result["status"] == model.STATUS_STARTED:
                    started_ops += 1
                result["additional"] = one_op[11]
                result["visible"] = True if one_op[12] > 0 else False
                result['operation_tag'] = one_op[13]
                result['figures'] = None
                if not result['group']:
                    datatype_results = dao.get_results_for_operation(result['id'])
                    result['results'] = [dao.get_generic_entity(dt.module + '.' + dt.type,
                                                                dt.gid, 'gid')[0] for dt in datatype_results]
                    operation_figures = dao.get_figures_for_operation(result['id'])

                    # Compute the full path to the figure / image on disk
                    for figure in operation_figures:
                        figures_folder = self.structure_helper.get_images_folder(figure.project.name)
                        figure_full_path = os.path.join(figures_folder, figure.file_path)
                        # Compute the path available from browser
                        figure.figure_path = utils.path2url_part(figure_full_path)

                    result['figures'] = operation_figures
                else:
                    result['results'] = None
                operations.append(result)
            except Exception, excep:
                ## We got an exception when processing one Operation Row. We will continue with the rest of the rows.
                self.logger.error(excep)
                self.logger.exception("Could not prepare operation for display:" + str(one_op))
        return selected_project, total_ops_nr, started_ops, operations, pages_no


    def retrieve_projects_for_user(self, user_id, current_page=1):
        """
        Return a list with all Projects visible for current user.
        """
        start_idx = PROJECTS_PAGE_SIZE * (current_page - 1)
        total = dao.get_projects_for_user(user_id, is_count=True)
        end_idx = (PROJECTS_PAGE_SIZE if total >= start_idx + PROJECTS_PAGE_SIZE else total - start_idx)
        available_projects = dao.get_projects_for_user(user_id, start_idx, end_idx)
        pages_no = total // PROJECTS_PAGE_SIZE + (1 if total % PROJECTS_PAGE_SIZE else 0)
        for prj in available_projects:
            fns, sta, err, canceled = dao.get_operation_numbers(prj.id)
            prj.operations_finished = fns
            prj.operations_started = sta
            prj.operations_error = err
            prj.operations_canceled = canceled
        self.logger.debug("Displaying " + str(len(available_projects)) + " projects in UI for user " + str(user_id))
        return available_projects, pages_no


    @staticmethod
    def get_linkable_projects_for_user(user_id, data_id):
        """
        Find projects with are visible for current user, and in which current datatype hasn't been linked yet.
        """
        return dao.get_linkable_projects_for_user(user_id, data_id)


    @transactional
    def remove_project(self, project_id):
        """
        Remove Project from DB and File Storage.
        """
        try:
            project2delete = dao.get_project_by_id(project_id)
            project_bursts = dao.get_bursts_for_project(project_id)
            for burst in project_bursts:
                dao.remove_entity(burst.__class__, burst.id)
            project_datatypes = dao.get_datatypes_info_for_project(project_id)
            for one_data in project_datatypes:
                self.remove_datatype(project_id, one_data[9], True)
            self.structure_helper.remove_project_structure(project2delete.name)
            name = project2delete.name
            dao.delete_project(project_id)
            self.logger.debug("Deleted project: id=" + str(project_id) + ' name=' + name)

        except RemoveDataTypeException, excep:
            self.logger.exception("Could not execute operation Node Remove!")
            raise ProjectServiceException(str(excep))
        except FileStructureException, excep:
            self.logger.exception("Could not delete because of rights!")
            raise ProjectServiceException(str(excep))
        except Exception, excep:
            self.logger.exception("Given ID does not exist in DB!")
            raise ProjectServiceException(str(excep))


    #----------------- Methods for populating Data-Structure Page ---------------

    @staticmethod
    def get_datatype_in_group(group):
        """
        Return all dataTypes that are the result of the same group of operations.
        """
        return dao.get_datatype_in_group(group)


    @staticmethod
    def get_datatypes_from_datatype_group(datatype_group_id):
        """
        Retrieve all dataType which are part from the given dataType group.
        """
        return dao.get_datatypes_from_datatype_group(datatype_group_id)


    @staticmethod
    def load_operation_by_gid(operation_gid):
        """ Retrieve loaded Operation from DB"""
        return dao.get_operation_by_gid(operation_gid)


    @staticmethod
    def get_operation_group_by_id(operation_group_id):
        """ Loads OperationGroup from DB"""
        return dao.get_operationgroup_by_id(operation_group_id)


    @staticmethod
    def get_operation_group_by_gid(operation_group_gid):
        """ Loads OperationGroup from DB"""
        return dao.get_operationgroup_by_gid(operation_group_gid)


    @staticmethod
    def get_operations_in_group(operation_group):
        """ Return all the operations from an operation group. """
        return dao.get_operations_in_group(operation_group.id)


    @staticmethod
    def is_upload_operation(operation_gid):
        """ Returns True only if the operation with the given GID is an upload operation. """
        return dao.is_upload_operation(operation_gid)


    @staticmethod
    def get_all_operations_for_uploaders(project_id):
        """ Returns all finished upload operations. """
        return dao.get_all_operations_for_uploaders(project_id)

    def set_operation_and_group_visibility(self, entity_gid, is_visible, is_operation_group=False):
        """
        Sets the operation visibility.

        If 'is_operation_group' is True than this method will change the visibility for all
        the operation from the OperationGroup with the GID field equal to 'entity_gid'.
        """
        def set_visibility(op):
            # workaround:
            # 'reload' the operation so that it has the project property set.
            # get_operations_in_group does not eager load it and now we're out of a sqlalchemy session
            # write_operation_metadata requires that property
            op = dao.get_operation_by_id(op.id)
            # end hack
            op.visible = is_visible
            self.structure_helper.write_operation_metadata(op)
            dao.store_entity(op)

        def set_group_descendants_visibility(operation_group_id):
            ops_in_group = dao.get_operations_in_group(operation_group_id)
            for group_op in ops_in_group:
                set_visibility(group_op)

        if is_operation_group:
            op_group_id = dao.get_operationgroup_by_gid(entity_gid).id
            set_group_descendants_visibility(op_group_id)
        else:
            operation = dao.get_operation_by_gid(entity_gid)
            #we assure that if the operation belongs to a group than the visibility will be changed for the entire group
            if operation.fk_operation_group is not None:
                set_group_descendants_visibility(operation.fk_operation_group)
            else:
                set_visibility(operation)


    def get_operation_details(self, operation_gid, is_group):
        """
        :returns: an entity OperationOverlayDetails filled with all information for current operation details.
        """

        if is_group:
            operation_group = self.get_operation_group_by_gid(operation_gid)
            operation = dao.get_operations_in_group(operation_group.id, False, True)
            ## Reload, to make sure all attributes lazy are populated as well.
            operation = dao.get_operation_by_gid(operation.gid)
            no_of_op_in_group = dao.get_operations_in_group(operation_group.id, is_count=True)
            datatype_group = self.get_datatypegroup_by_op_group_id(operation_group.id)
            count_result = dao.count_datatypes_in_group(datatype_group.id)

        else:
            operation = dao.get_operation_by_gid(operation_gid)
            if operation is None:
                return None
            no_of_op_in_group = 1
            count_result = dao.count_resulted_datatypes(operation.id)

        username = dao.get_user_by_id(operation.fk_launched_by).username
        burst = dao.get_burst_for_operation_id(operation.id)
        datatypes_param, all_special_params = ProjectService._review_operation_inputs(operation.gid)

        op_pid = dao.get_operation_process_for_operation(operation.id)
        op_details = OperationOverlayDetails(operation, username, len(datatypes_param),
                                             count_result, burst, no_of_op_in_group, op_pid)

        ## Add all parameter which are set differently by the user on this Operation.
        if all_special_params is not None:
            op_details.add_scientific_fields(all_special_params)
        return op_details


    @staticmethod
    def get_filterable_meta():
        """
        Contains all the attributes by which
        the user can structure the tree of DataTypes
        """
        return DataTypeMetaData.get_filterable_meta()


    def get_project_structure(self, project, visibility_filter, first_level, second_level, filter_value):
        """
        Find through introspection the inside structure for a given Project.
        In case of a problem, will return an empty list.
        """
        datas = dao.get_datatypes_info_for_project(project.id, visibility_filter, filter_value)
        dt_ids = [row[11] for row in datas]
        groups_collapsed_data = []
        full_groups = []
        # No longer make group by operation group at SQL level so we can handle situation where
        # we have link from one datatype in a group but not the whole group
        for entry in datas:
            if entry[0] == model.DataTypeGroup.__name__:
                # Do nothing for groups sice we will get more info for the first datatype we found in each group
                continue
            if entry[14] not in dt_ids:
                # entry[14] = fk_datatype_group - if we are not part of a group just append to data
                groups_collapsed_data.append(entry)
            else:
                if entry[14] not in full_groups:
                    # If we are part of a group just store the first found datatype since we dont need rest
                    full_groups.append(entry[14])
                    groups_collapsed_data.append(entry)
        metadatas = []
        for row in groups_collapsed_data:
            metadatas.append(self.__datatype2metastructure(row, dt_ids))
        return StructureNode.metadata2tree(metadatas, first_level, second_level, project.id, project.name)


    @staticmethod
    def __datatype2metastructure(row, dt_ids):
        """
        Convert a list of data retrieved from DB and create a DataTypeMetaData object.
        """
        data = {}
        is_group = False
        group = None
        if row[7] is not None and row[7] and row[14] in dt_ids:
            is_group = True
            group = dao.get_generic_entity(model.OperationGroup, row[7])
            if group and len(group):
                group = group[0]
            else:
                is_group = False
        datatype_group = None
        if row[14] is not None and row[14] in dt_ids:
            datatype_group = dao.get_datatype_by_id(row[14])
        dt_entity = dao.get_datatype_by_gid(row[9])
        data[DataTypeMetaData.KEY_TITLE] = dt_entity.display_name
        ## All these fields are necessary here for dynamic Tree levels.
        data[DataTypeMetaData.KEY_NODE_TYPE] = datatype_group.type if datatype_group is not None else row[0]
        data[DataTypeMetaData.KEY_STATE] = row[1]
        data[DataTypeMetaData.KEY_SUBJECT] = str(row[2])
        operation_name = CommonDetails.compute_operation_name(row[3], row[4], row[5])
        data[DataTypeMetaData.KEY_OPERATION_TYPE] = operation_name
        data[DataTypeMetaData.KEY_AUTHOR] = row[6]
        data[DataTypeMetaData.KEY_OPERATION_TAG] = group.name if is_group else row[8]
        data[DataTypeMetaData.KEY_OP_GROUP_ID] = group.id if is_group else None
        data[DataTypeMetaData.KEY_GID] = datatype_group.gid if datatype_group is not None else row[9]
        data[DataTypeMetaData.KEY_DATE] = date2string(row[10]) if (row[10] is not None) else ''
        data[DataTypeMetaData.KEY_DATATYPE_ID] = datatype_group.id if datatype_group is not None else row[11]
        data[DataTypeMetaData.KEY_LINK] = row[12]
        data[DataTypeMetaData.KEY_OPERATION_ALGORITHM] = row[5]
        date_string = row[10].strftime(MONTH_YEAR_FORMAT) if row[10] is not None else ""
        data[DataTypeMetaData.KEY_CREATE_DATA_MONTH] = date_string
        date_string = row[10].strftime(DAY_MONTH_YEAR_FORMAT) if row[10] is not None else ""
        data[DataTypeMetaData.KEY_CREATE_DATA_DAY] = date_string
        data[DataTypeMetaData.KEY_BURST] = row[15] if row[15] is not None else '-None-'
        data[DataTypeMetaData.KEY_TAG_1] = row[16] if row[16] else ''
        data[DataTypeMetaData.KEY_TAG_2] = row[17] if row[17] else ''
        data[DataTypeMetaData.KEY_TAG_3] = row[18] if row[18] else ''
        data[DataTypeMetaData.KEY_TAG_4] = row[19] if row[19] else ''
        data[DataTypeMetaData.KEY_TAG_5] = row[20] if row[20] else ''
        data[DataTypeMetaData.KEY_RELEVANCY] = True if row[21] > 0 else False
        invalid = True if row[13] else False
        return DataTypeMetaData(data, invalid)


    @staticmethod
    def get_datatype_details(datatype_gid):
        """
        :returns: an array. First entry in array is an instance of DataTypeOverlayDetails\
            The second one contains all the possible states for the specified dataType.

        """
        meta_atts = DataTypeOverlayDetails()
        states = DataTypeMetaData.STATES
        try:
            datatype_result, parent_burst = dao.get_datatype_details(datatype_gid)
            meta_atts.fill_from_datatype(datatype_result, parent_burst)
            return meta_atts, states, datatype_result
        except Exception:
            ## We ignore exception here (it was logged above, and we want to return no details).
            return meta_atts, states, None


    def _remove_project_node_files(self, project_id, gid, skip_validation=False):
        """
        Delegate removal of a node in the structure of the project.
        In case of a problem will THROW StructureException.
        """
        try:
            project = self.find_project(project_id)
            datatype = dao.get_datatype_by_gid(gid)
            links = dao.get_links_for_datatype(datatype.id)
            if links:
                was_link = False
                for link in links:
                    #This means it's only a link and we need to remove it
                    if link.fk_from_datatype == datatype.id and link.fk_to_project == project.id:
                        dao.remove_link(link)
                        was_link = True
                if not was_link:
                    # Create a clone of the operation
                    new_op = model.Operation(dao.get_system_user().id,
                                             links[0].fk_to_project,
                                             datatype.parent_operation.fk_from_algo,
                                             datatype.parent_operation.parameters,
                                             datatype.parent_operation.meta_data,
                                             datatype.parent_operation.method_name,
                                             datatype.parent_operation.status,
                                             datatype.parent_operation.start_date,
                                             datatype.parent_operation.completion_date,
                                             datatype.parent_operation.fk_operation_group,
                                             datatype.parent_operation.additional_info,
                                             datatype.parent_operation.user_group,
                                             datatype.parent_operation.range_values)
                    new_op = dao.store_entity(new_op)
                    to_project = self.find_project(links[0].fk_to_project).name
                    self.structure_helper.move_datatype(datatype, to_project, str(new_op.id))
                    datatype.set_operation_id(new_op.id)
                    datatype.parent_operation = new_op
                    dao.store_entity(datatype)
                    dao.remove_link(links[0])
            else:
                specific_remover = get_remover(datatype.type)(datatype)
                specific_remover.remove_datatype(skip_validation)
                self.structure_helper.remove_datatype(datatype)

        except RemoveDataTypeException, excep:
            self.logger.error("Could not execute operation Node Remove!")
            self.logger.exception(excep)
            raise excep
        except FileStructureException, excep:
            self.logger.exception(excep)
            raise StructureException("Remove operation failed for unknown reasons.Please contact system administrator.")


    def remove_operation(self, operation_id):
        """
        Remove a given operation
        """
        operation = dao.get_operation_by_id(operation_id)
        if operation is not None:
            datatypes_for_op = dao.get_results_for_operation(operation_id)
            for dt in reversed(datatypes_for_op):
                self.remove_datatype(operation.project.id, dt.gid, False)
            dao.remove_entity(model.Operation, operation.id)
        else:
            self.logger.warning("Attempt to delete operation with id=%s which no longer exists." % operation_id)


    def remove_datatype(self, project_id, datatype_gid, skip_validation=False):
        """
        Method used for removing a dataType. If the given dataType is a DatatypeGroup
        or a dataType from a DataTypeGroup than this method will remove the entire group.
        The operation(s) used for creating the dataType(s) will also be removed also.
        """
        datatype = dao.get_datatype_by_gid(datatype_gid)
        if datatype is None:
            return
        user = dao.get_user_for_datatype(datatype.id)
        freed_space = datatype.disk_size or 0
        is_datatype_group = False
        if dao.is_datatype_group(datatype_gid):
            is_datatype_group = True
            freed_space = dao.get_datatype_group_disk_size(datatype.id)
        elif datatype.fk_datatype_group is not None:
            is_datatype_group = True
            datatype = dao.get_datatype_by_id(datatype.fk_datatype_group)
            freed_space = dao.get_datatype_group_disk_size(datatype.id)

        operations_set = [datatype.fk_from_operation]

        correct = True

        if is_datatype_group:
            data_list = dao.get_datatypes_from_datatype_group(datatype.id)
            for adata in data_list:
                self._remove_project_node_files(project_id, adata.gid, skip_validation)
                if adata.fk_from_operation not in operations_set:
                    operations_set.append(adata.fk_from_operation)

            datatype_group = dao.get_datatype_group_by_gid(datatype.gid)
            dao.remove_datatype(datatype_gid)
            correct = correct and dao.remove_entity(model.OperationGroup, datatype_group.fk_operation_group)

        else:
            self._remove_project_node_files(project_id, datatype.gid, skip_validation)

        ## Remove Operation entity in case no other DataType needs them.
        project = dao.get_project_by_id(project_id)
        for operation_id in operations_set:
            dependent_dt = dao.get_generic_entity(model.DataType, operation_id, "fk_from_operation")
            if len(dependent_dt) > 0:
                ### Do not remove Operation in case DataType still exist referring it.
                continue
            correct = correct and dao.remove_entity(model.Operation, operation_id)
            ## Make sure Operation folder is removed
            self.structure_helper.remove_operation_data(project.name, datatype.fk_from_operation)

        if not correct:
            raise RemoveDataTypeException("Could not remove DataType " + str(datatype_gid))
        else:
            user.used_disk_space = user.used_disk_space - freed_space
            dao.store_entity(user)


    def retrieve_launchers(self, datatype_gid, inspect_group=False, include_categories=None):
        """
        Returns all the available launch-able algorithms from the database.
        Filter the ones accepting as required input a specific DataType.

        :param datatype_gid: GID, to filter algorithms for this particular entity.
        :param inspect_group: TRUE if we are now in the inspection of sub-entities in a DataTypeGroup
        :param include_categories: List of categories to be included in the result.
                When None, all lanchable categories are included
        """
        try:
            all_launch_categ = dao.get_launchable_categories()
            launch_categ = dict((categ.id, categ.displayname) for categ in all_launch_categ
                                if include_categories is None or categ.id in include_categories)

            datatype_instance = dao.get_datatype_by_gid(datatype_gid)
            data_class = datatype_instance.__class__
            all_compatible_classes = [data_class.__name__]
            for one_class in getmro(data_class):
                if issubclass(one_class, MappedType) and one_class.__name__ not in all_compatible_classes:
                    all_compatible_classes.append(one_class.__name__)

            launchable_groups = dao.get_apliable_algo_groups(all_compatible_classes, launch_categ.keys())

            to_remove = []
            for one_group in launchable_groups:
                compatible_algorithms = []
                for one_algo in one_group.children:
                    filter_chain = FilterChain.from_json(one_algo.datatype_filter)
                    if not filter_chain or filter_chain.get_python_filter_equivalent(datatype_instance):
                        compatible_algorithms.append(one_algo)
                if len(compatible_algorithms) > 0:
                    one_group.children = copy.deepcopy(compatible_algorithms)
                else:
                    to_remove.append(one_group)

            for one_group in to_remove:
                launchable_groups.remove(one_group)
                del one_group

            launchers = ProjectService.__prepare_group_result(launchable_groups, launch_categ, inspect_group)

            if data_class.__name__ == model.DataTypeGroup.__name__:
                # If part of a group, update also with specific launchers of the child datatype
                dt_group = dao.get_datatype_group_by_gid(datatype_gid)
                datatypes = dao.get_datatypes_from_datatype_group(dt_group.id)
                if len(datatypes):
                    datatype = datatypes[-1]
                    datatype = dao.get_datatype_by_gid(datatype.gid)

                    views_categ_id = dao.get_visualisers_categories()[0].id
                    categories_for_small_type = [categ.id for categ in all_launch_categ
                                                 if categ.id != views_categ_id and (include_categories is None or
                                                                                    categ.id in include_categories)]
                    if categories_for_small_type is not None:
                        specific_launchers = self.retrieve_launchers(datatype.gid, True, categories_for_small_type)
                        for key in specific_launchers:
                            if key in launchers:
                                launchers[key].update(specific_launchers[key])
                            else:
                                launchers[key] = specific_launchers[key]
            return launchers

        except Exception, excep:
            ProjectService().logger.exception(excep)
            ProjectService().logger.warning("Attempting to filter launcher for group despite exception!")
            return ProjectService.__prepare_group_result([], [], inspect_group)


    @staticmethod
    def __prepare_group_result(launch_groups, launch_categ, inspect_group):
        """Prepare data result format for display."""
        result = dict()
        for group in launch_groups:
            category = launch_categ[group.fk_category]
            if category not in result:
                result[category] = dict()
            result[category][group.id] = {'id': group.id,
                                          'displayName': group.displayname,
                                          'category': group.fk_category,
                                          'algo_param': group.algorithm_param_name,
                                          'part_of_group': inspect_group}
            childs = []
            for one_child in group.children:
                childs.append({'ident': one_child.identifier,
                               'name': one_child.name,
                               'req_data': one_child.required_datatype,
                               'param_name': one_child.parameter_name})
            result[category][group.id]['children'] = childs
        return result


    def update_metadata(self, submit_data):
        """
        Update DataType/ DataTypeGroup metadata
        THROW StructureException when input data is invalid.
        """
        new_data = dict()
        for key in DataTypeOverlayDetails().meta_attributes_list:
            if key in submit_data:
                new_data[key] = submit_data[key]

        if new_data[CommonDetails.CODE_OPERATION_TAG] == '':
            new_data[CommonDetails.CODE_OPERATION_TAG] = None
        try:
            if (CommonDetails.CODE_OPERATION_GROUP_ID in new_data
                    and new_data[CommonDetails.CODE_OPERATION_GROUP_ID]
                    and new_data[CommonDetails.CODE_OPERATION_GROUP_ID] != ''):
                # We need to edit a group
                all_data_in_group = dao.get_datatype_in_group(new_data[CommonDetails.CODE_OPERATION_GROUP_ID])
                if len(all_data_in_group) < 1:
                    raise StructureException("Inconsistent group, can not be updated!")
                datatype_group = dao.get_generic_entity(model.DataTypeGroup, all_data_in_group[0].fk_datatype_group)[0]
                all_data_in_group.append(datatype_group)
                for datatype in all_data_in_group:
                    new_data[CommonDetails.CODE_GID] = datatype.gid
                    self._edit_data(datatype, new_data, True)
            else:
                # Get the required DataType and operation from DB to store changes that will be done in XML.
                gid = new_data[CommonDetails.CODE_GID]
                datatype = dao.get_datatype_by_gid(gid)
                self._edit_data(datatype, new_data)
        except Exception, excep:
            self.logger.exception(excep)
            raise StructureException(str(excep))


    def _edit_data(self, datatype, new_data, from_group=False):
        """
        Private method, used for editing a meta-data XML file and a DataType row
        for a given custom DataType entity with new dictionary of data from UI.
        """
        if isinstance(datatype, MappedType) and not os.path.exists(datatype.get_storage_file_path()):
            if not datatype.invalid:
                datatype.invalid = True
                dao.store_entity(datatype)
            return
        # 1. First update Operation fields:
        #    Update group field if possible
        new_group_name = new_data[CommonDetails.CODE_OPERATION_TAG]
        empty_group_value = (new_group_name is None or new_group_name == "")
        if from_group:
            if empty_group_value:
                raise StructureException("Empty group is not allowed!")

            group = dao.get_generic_entity(model.OperationGroup, new_data[CommonDetails.CODE_OPERATION_GROUP_ID])
            if group and len(group) > 0 and new_group_name != group[0].name:
                group = group[0]
                exists_group = dao.get_generic_entity(model.OperationGroup, new_group_name, 'name')
                if exists_group:
                    raise StructureException("Group '" + new_group_name + "' already exists.")
                group.name = new_group_name
                dao.store_entity(group)
        else:
            operation = dao.get_operation_by_id(datatype.fk_from_operation)
            operation.user_group = new_group_name
            dao.store_entity(operation)

        # 2. Update dateType fields:
        datatype.subject = new_data[DataTypeOverlayDetails.DATA_SUBJECT]
        datatype.state = new_data[DataTypeOverlayDetails.DATA_STATE]
        if DataTypeOverlayDetails.DATA_TAG_1 in new_data:
            datatype.user_tag_1 = new_data[DataTypeOverlayDetails.DATA_TAG_1]
        if DataTypeOverlayDetails.DATA_TAG_2 in new_data:
            datatype.user_tag_2 = new_data[DataTypeOverlayDetails.DATA_TAG_2]
        if DataTypeOverlayDetails.DATA_TAG_3 in new_data:
            datatype.user_tag_3 = new_data[DataTypeOverlayDetails.DATA_TAG_3]
        if DataTypeOverlayDetails.DATA_TAG_4 in new_data:
            datatype.user_tag_4 = new_data[DataTypeOverlayDetails.DATA_TAG_4]
        if DataTypeOverlayDetails.DATA_TAG_5 in new_data:
            datatype.user_tag_5 = new_data[DataTypeOverlayDetails.DATA_TAG_5]

        datatype = dao.store_entity(datatype)
        # 3. Update MetaData in H5 as well.
        datatype.persist_full_metadata()
        # 4. Update the group_name/user_group into the operation meta-data file
        operation = dao.get_operation_by_id(datatype.fk_from_operation)
        self.structure_helper.update_operation_metadata(operation.project.name, new_group_name,
                                                        str(datatype.fk_from_operation), from_group)


    @staticmethod
    def get_datatype_and_datatypegroup_inputs_for_operation(operation_gid, selected_filter):
        """
        Returns the dataTypes that are used as input parameters for the given operation.
        'selected_filter' - is expected to be a visibility filter.

        If any dataType is part of a dataType group then the dataType group will
        be returned instead of that dataType.
        """
        all_datatypes = ProjectService._review_operation_inputs(operation_gid)[0]
        datatype_inputs = []
        for datatype in all_datatypes:
            if selected_filter.display_name == StaticFiltersFactory.RELEVANT_VIEW:
                if datatype.visible:
                    datatype_inputs.append(datatype)
            else:
                datatype_inputs.append(datatype)
        datatypes = []
        datatype_groups = dict()
        for data_type in datatype_inputs:
            if data_type.fk_datatype_group is None:
                datatypes.append(data_type)
            elif data_type.fk_datatype_group not in datatype_groups:
                dt_group = dao.get_datatype_by_id(data_type.fk_datatype_group)
                datatype_groups[data_type.fk_datatype_group] = dt_group

        datatypes.extend([v for _, v in datatype_groups.iteritems()])
        return datatypes


    @staticmethod
    def _review_operation_inputs(operation_gid):
        """
        :returns: A list of DataTypes that are used as input parameters for the specified operation.
                 And a dictionary will all operation parameters different then the default ones.
        """
        operation = dao.get_operation_by_gid(operation_gid)
        parameters = json.loads(operation.parameters)
        adapter = ABCAdapter.build_adapter(operation.algorithm.algo_group)
        return adapter.review_operation_inputs(parameters)


    @staticmethod
    def get_datatypes_inputs_for_operation_group(group_id, selected_filter):
        """
        Returns the dataType inputs for an operation group. If more dataTypes
        are part of the same dataType group then only the dataType group will
        be returned instead of them.
        """
        operations_gids = dao.get_operations_in_group(group_id, only_gids=True)
        op_group_inputs = dict()
        for gid in operations_gids:
            op_inputs = ProjectService.get_datatype_and_datatypegroup_inputs_for_operation(gid[0], selected_filter)
            for datatype in op_inputs:
                op_group_inputs[datatype.id] = datatype
        return op_group_inputs.values()


    @staticmethod
    def get_results_for_operation(operation_id, selected_filter=None):
        """
        Retrieve the DataTypes entities resulted after the execution of the given operation.
        """
        return dao.get_results_for_operation(operation_id, selected_filter)


    @staticmethod
    def get_operations_for_datatype_group(datatype_group_id, visibility_filter, only_in_groups=False):
        """
        Returns all the operations which uses as an input parameter a dataType from the given DataTypeGroup.
        visibility_filter - is a filter used for retrieving all the operations or only the relevant ones.

        If only_in_groups is True than this method will return only the operations that are
        part from an operation group, otherwise it will return only the operations that
        are NOT part of an operation group.
        """
        if visibility_filter.display_name != StaticFiltersFactory.RELEVANT_VIEW:
            return dao.get_operations_for_datatype_group(datatype_group_id, only_relevant=False,
                                                         only_in_groups=only_in_groups)
        return dao.get_operations_for_datatype_group(datatype_group_id, only_in_groups=only_in_groups)


    @staticmethod
    def get_operations_for_datatype(datatype_gid, visibility_filter, only_in_groups=False):
        """
        Returns all the operations which uses as an input parameter the dataType with the specified GID.

        If only_in_groups is True than this method will return only the operations that are part
        from an operation group, otherwise it will return only the operations that are NOT part of an operation group.
        """
        if visibility_filter.display_name != StaticFiltersFactory.RELEVANT_VIEW:
            return dao.get_operations_for_datatype(datatype_gid, only_relevant=False, only_in_groups=only_in_groups)
        return dao.get_operations_for_datatype(datatype_gid, only_in_groups=only_in_groups)


    @staticmethod
    def get_datatype_by_id(datatype_id):
        """Retrieve a DataType DB reference by its id."""
        return dao.get_datatype_by_id(datatype_id)


    @staticmethod
    def get_group_by_op_group_id(opgroup_id):
        """ Returns the DataTypeGroup with the specified id. """
        return dao.get_group_by_op_group_id(opgroup_id)


    @staticmethod
    def get_datatypegroup_by_gid(datatypegroup_gid):
        """ Returns the DataTypeGroup with the specified gid. """
        return dao.get_datatype_group_by_gid(datatypegroup_gid)

    @staticmethod
    def count_datatypes_generated_from(datatype_gid):
        """
        A list with all the datatypes resulted from operations that had as
        input the datatype given by 'datatype_gid'.
        """
        return dao.count_datatypes_generated_from(datatype_gid)


    @staticmethod
    def get_datatypegroup_by_op_group_id(operation_group_id):
        """ Returns the DataTypeGroup with the specified id. """
        return dao.get_datatypegroup_by_op_group_id(operation_group_id)


    @staticmethod
    def set_datatype_visibility(datatype_gid, is_visible):
        """
        Sets the dataType visibility. If the given dataType is a dataType group or it is part of a
        dataType group than this method will set the visibility for each dataType from this group.
        """
        def set_visibility(dt):
            """ set visibility flag, persist in db and h5"""
            dt.visible = is_visible
            dt = dao.store_entity(dt)
            dt.persist_full_metadata()

        def set_group_descendants_visibility(datatype_group_id):
            datatypes_in_group = dao.get_datatypes_from_datatype_group(datatype_group_id)
            for group_dt in datatypes_in_group:
                set_visibility(group_dt)

        datatype = dao.get_datatype_by_gid(datatype_gid)

        if isinstance(datatype, DataTypeGroup):   # datatype is a group
            set_group_descendants_visibility(datatype.id)
        elif datatype.fk_datatype_group is not None:  # datatype is member of a group
            set_group_descendants_visibility(datatype.fk_datatype_group)
            # the datatype to be updated is the parent datatype group
            datatype = dao.get_datatype_by_id(datatype.fk_datatype_group)

        # update the datatype or datatype group.
        set_visibility(datatype)


    @staticmethod
    def is_datatype_group(datatype_gid):
        """ Used to check if the dataType with the specified GID is a DataTypeGroup. """
        return dao.is_datatype_group(datatype_gid)


