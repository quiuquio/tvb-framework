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
.. moduleauthor:: Bogdan Neacsa <bogdan.neacsa@codemart.ro>
"""
import tvb_data
import os
import unittest
import shutil
from simplejson import JSONEncoder
import tvb.config as config
from tvb.basic.config.settings import TVBSettings as cfg
from tvb.core.entities import model
from tvb.core.entities.storage import dao
from tvb.core.entities.transient.context_overlay import DataTypeOverlayDetails
from tvb.core.services.exceptions import ProjectServiceException
from tvb.core.services.project_service import ProjectService, PROJECTS_PAGE_SIZE
from tvb.core.services.operation_service import OperationService
from tvb.core.services.flow_service import FlowService
from tvb.core.entities.transient.structure_entities import DataTypeMetaData
from tvb.core.entities.file.files_helper import FilesHelper
from tvb.core.entities.file.xml_metadata_handlers import XMLReader
from tvb.core.adapters.abcadapter import ABCAdapter
from tvb.datatypes.mapped_values import ValueWrapper
from tvb.tests.framework.adapters.storeadapter import StoreAdapter
from tvb.tests.framework.core.base_testcase import TransactionalTestCase
from tvb.tests.framework.core.test_factory import TestFactory, ExtremeTestFactory
from tvb.tests.framework.datatypes import datatypes_factory
from tvb.tests.framework.datatypes.datatype1 import Datatype1

NR_USERS = 20
MAX_PROJ_PER_USER = 8
        

class ProjectServiceTest(TransactionalTestCase):
    """
    This class contains tests for the tvb.core.services.project_service module.
    """    
    
    def setUp(self):
        """
        Reset the database before each test.
        """
        config.EVENTS_FOLDER = ''
        self.project_service = ProjectService()
        self.structure_helper = FilesHelper()
        self.test_user = TestFactory.create_user()
    
    
    def tearDown(self):
        """
        Remove project folders and clean up database.
        """
        created_projects = dao.get_projects_for_user(self.test_user.id)
        for project in created_projects:
            self.structure_helper.remove_project_structure(project.name)
        self.delete_project_folders()
    
    
    def test_create_project_happy_flow(self):
        """
        Standard flow for creating a new project.
        """
        user1 = TestFactory.create_user('test_user1')
        user2 = TestFactory.create_user('test_user2')
        initial_projects = dao.get_projects_for_user(self.test_user.id)
        self.assertEqual(len(initial_projects), 0, "Database reset probably failed!")
        TestFactory.create_project(self.test_user, 'test_project', users=[user1.id, user2.id])
        resulting_projects = dao.get_projects_for_user(self.test_user.id)
        self.assertEqual(len(resulting_projects), 1, "Project with valid data not inserted!")  
        project = resulting_projects[0]
        if project.name == "test_project":
            self.assertEqual(project.description, "description", "Description do no match")
            users_for_project = dao.get_members_of_project(project.id)
            for user in users_for_project:
                self.assertTrue(user.id in [user1.id, user2.id], "Users not stored properly.")
        self.assertTrue(os.path.exists(os.path.join(cfg.TVB_STORAGE, FilesHelper.PROJECTS_FOLDER, "test_project")), 
                        "Folder for project was not created")
   
   
    def test_create_project_empty_name(self):
        """
        Creating a project with an empty name.
        """
        data = dict(name="", description="test_description", users=[])
        initial_projects = dao.get_projects_for_user(self.test_user.id)
        self.assertEqual(len(initial_projects), 0, "Database reset probably failed!")
        self.assertRaises(ProjectServiceException, self.project_service.store_project, 
                          self.test_user, True, None, **data)
   
   
    def test_edit_project_happy_flow(self):
        """
        Standard flow for editing an existing project.
        """
        selected_project = TestFactory.create_project(self.test_user, 'test_proj')
        proj_root = self.structure_helper.get_project_folder(selected_project)
        initial_projects = dao.get_projects_for_user(self.test_user.id)
        self.assertEqual(len(initial_projects), 1, "Database initialization probably failed!")
        
        edited_data = dict(name="test_project", description="test_description", users=[])
        edited_project = self.project_service.store_project(self.test_user, False, selected_project.id, **edited_data)
        self.assertFalse(os.path.exists(proj_root), "Previous folder not deleted")
        proj_root = self.structure_helper.get_project_folder(edited_project)
        self.assertTrue(os.path.exists(proj_root), "New folder not created!")
        self.assertNotEqual(selected_project.name, edited_project.name, "Project was no changed!")  
        
             
    def test_edit_project_unexisting(self):
        """
        Trying to edit an un-existing project.
        """
        selected_project = TestFactory.create_project(self.test_user, 'test_proj')
        self.structure_helper.get_project_folder(selected_project)
        initial_projects = dao.get_projects_for_user(self.test_user.id)
        self.assertEqual(len(initial_projects), 1, "Database initialization probably failed!")
        data = dict(name="test_project", description="test_description", users=[])
        self.assertRaises(ProjectServiceException, self.project_service.store_project,
                          self.test_user, False, 99, **data)

    
    def test_find_project_happy_flow(self):
        """
        Standard flow for finding a project by it's id.
        """
        initial_projects = dao.get_projects_for_user(self.test_user.id)
        self.assertEqual(len(initial_projects), 0, "Database reset probably failed!")
        inserted_project = TestFactory.create_project(self.test_user, 'test_project')
        self.assertTrue(self.project_service.find_project(inserted_project.id) is not None, "Project not found !")
        dao_returned_project = dao.get_project_by_id(inserted_project.id)
        service_returned_project = self.project_service.find_project(inserted_project.id)
        self.assertEqual(dao_returned_project.id, service_returned_project.id,
                         "Data returned from service is different from data returned by DAO.")
        self.assertEqual(dao_returned_project.name, service_returned_project.name, 
                         "Data returned from service is different than  data returned by DAO.")  
        self.assertEqual(dao_returned_project.description, service_returned_project.description,
                         "Data returned from service is different from data returned by DAO.")        
        self.assertEqual(dao_returned_project.members, service_returned_project.members,
                         "Data returned from service is different from data returned by DAO.")
                      
        
    def test_find_project_unexisting(self):
        """
        Searching for an un-existing project.
        """
        data = dict(name="test_project", description="test_description", users=[])
        initial_projects = dao.get_projects_for_user(self.test_user.id)
        self.assertEqual(len(initial_projects), 0, "Database reset probably failed!")
        self.project_service.store_project(self.test_user, True, None, **data)
        self.assertRaises(ProjectServiceException, self.project_service.find_project, 99)  
        
        
    def test_retrieve_projects_for_user(self):
        """
        Test for retrieving the projects for a given user. One page only.
        """
        initial_projects = self.project_service.retrieve_projects_for_user(self.test_user.id)[0]
        self.assertEqual(len(initial_projects), 0, "Database was not reset properly!")
        TestFactory.create_project(self.test_user, 'test_proj')
        TestFactory.create_project(self.test_user, 'test_proj1')
        TestFactory.create_project(self.test_user, 'test_proj2')
        user1 = TestFactory.create_user('another_user')
        TestFactory.create_project(user1, 'test_proj3')
        projects = self.project_service.retrieve_projects_for_user(self.test_user.id)[0]
        self.assertEqual(len(projects), 3, "Projects not retrieved properly!")
        for project in projects:
            self.assertNotEquals(project.name, "test_project3", "This project should not have been retrieved")   
            
            
    def test_retrieve_1project_3usr(self):
        """
        One user as admin, two users as members, getting projects for admin and for any of
        the members should return one.
        """
        member1 = TestFactory.create_user("member1")
        member2 = TestFactory.create_user("member2")
        TestFactory.create_project(self.test_user, 'Testproject', users=[member1.id, member2.id])
        projects = self.project_service.retrieve_projects_for_user(self.test_user.id, 1)[0]
        self.assertEqual(len(projects), 1, "Projects not retrieved properly!")
        projects = self.project_service.retrieve_projects_for_user(member1.id, 1)[0]
        self.assertEqual(len(projects), 1, "Projects not retrieved properly!")
        projects = self.project_service.retrieve_projects_for_user(member2.id, 1)[0]
        self.assertEqual(len(projects), 1, "Projects not retrieved properly!")
        
        
    def test_retrieve_3projects_3usr(self):
        """
        Three users, 3 projects. Structure of db:
        proj1: {admin: user1, members: [user2, user3]}
        proj2: {admin: user2, members: [user1]}
        proj3: {admin: user3, members: [user1, user2]}
        Check valid project returns for all the users.
        """
        member1 = TestFactory.create_user("member1")
        member2 = TestFactory.create_user("member2")
        member3 = TestFactory.create_user("member3")
        TestFactory.create_project(member1, 'TestProject1', users=[member2.id, member3.id])
        TestFactory.create_project(member2, 'TestProject2', users=[member1.id])
        TestFactory.create_project(member3, 'TestProject3', users=[member1.id, member2.id])
        projects = self.project_service.retrieve_projects_for_user(member1.id, 1)[0]
        self.assertEqual(len(projects), 3, "Projects not retrieved properly!")
        projects = self.project_service.retrieve_projects_for_user(member2.id, 1)[0]
        self.assertEqual(len(projects), 3, "Projects not retrieved properly!")
        projects = self.project_service.retrieve_projects_for_user(member3.id, 1)[0]
        self.assertEqual(len(projects), 2, "Projects not retrieved properly!")
        
        
    def test_retrieve_projects_random(self):
        """
        Generate a large number of users/projects, and validate the results.
        """
        ExtremeTestFactory.generate_users(NR_USERS, MAX_PROJ_PER_USER)
        for i in range(NR_USERS):
            current_user = dao.get_user_by_name("gen" + str(i))
            expected_projects = ExtremeTestFactory.VALIDATION_DICT[current_user.id]
            if expected_projects % PROJECTS_PAGE_SIZE == 0:
                expected_pages = expected_projects / PROJECTS_PAGE_SIZE
                exp_proj_per_page = PROJECTS_PAGE_SIZE
            else:
                expected_pages = expected_projects / PROJECTS_PAGE_SIZE + 1
                exp_proj_per_page = expected_projects % PROJECTS_PAGE_SIZE
            if expected_projects == 0:
                expected_pages = 0
                exp_proj_per_page = 0
            projects, pages = self.project_service.retrieve_projects_for_user(current_user.id, expected_pages)
            self.assertEqual(len(projects), exp_proj_per_page, "Projects not retrieved properly! Expected:" +
                             str(exp_proj_per_page) + "but got:" + str(len(projects)))
            self.assertEqual(pages, expected_pages, "Pages not retrieved properly!")
        for folder in os.listdir(cfg.TVB_STORAGE):
            full_path = os.path.join(cfg.TVB_STORAGE, folder)
            if os.path.isdir(full_path) and folder.startswith('Generated'): 
                shutil.rmtree(full_path)
        
            
    def test_retrieve_projects_page2(self):
        """
        Test for retrieving the second page projects for a given user.
        """
        for i in range(PROJECTS_PAGE_SIZE + 3):
            TestFactory.create_project(self.test_user, 'test_proj' + str(i))
        projects, pages = self.project_service.retrieve_projects_for_user(self.test_user.id, 2)
        self.assertEqual(len(projects), (PROJECTS_PAGE_SIZE + 3) % PROJECTS_PAGE_SIZE, "Pagination inproper.")
        self.assertEqual(pages, 2, 'Wrong number of pages retrieved.')
        
        
    def test_retrieve_projects_and_del(self):
        """
        Test for retrieving the second page projects for a given user.
        """
        created_projects = []
        for i in range(PROJECTS_PAGE_SIZE + 1):
            created_projects.append(TestFactory.create_project(self.test_user, 'test_proj' + str(i)))
        projects, pages = self.project_service.retrieve_projects_for_user(self.test_user.id, 2)
        self.assertEqual(len(projects), (PROJECTS_PAGE_SIZE + 1) % PROJECTS_PAGE_SIZE, "Pagination improper.")
        self.assertEqual(pages, (PROJECTS_PAGE_SIZE + 1) / PROJECTS_PAGE_SIZE + 1, 'Wrong number of pages')
        self.project_service.remove_project(created_projects[1].id)
        projects, pages = self.project_service.retrieve_projects_for_user(self.test_user.id, 2)
        self.assertEqual(len(projects), 0, "Pagination improper.")
        self.assertEqual(pages, 1, 'Wrong number of pages retrieved.')
        projects, pages = self.project_service.retrieve_projects_for_user(self.test_user.id, 1)
        self.assertEqual(len(projects), PROJECTS_PAGE_SIZE, "Pagination improper.")
        self.assertEqual(pages, 1, 'Wrong number of pages retrieved.')


    def test_empty_project_has_zero_disk_size(self):
        TestFactory.create_project(self.test_user, 'test_proj')
        projects, pages = self.project_service.retrieve_projects_for_user(self.test_user.id)
        self.assertEqual(0, projects[0].disk_size)
        self.assertEqual('0.0 KiB', projects[0].disk_size_human)


    def test_project_disk_size(self):
        project1 = TestFactory.create_project(self.test_user, 'test_proj1')
        zip_path = os.path.join(os.path.dirname(tvb_data.__file__), 'connectivity', 'connectivity_66.zip')
        TestFactory.import_zip_connectivity(self.test_user, project1, 'testSubject', zip_path)

        project2 = TestFactory.create_project(self.test_user, 'test_proj2')
        TestFactory.import_cff(test_user=self.test_user, test_project=project2)

        projects = self.project_service.retrieve_projects_for_user(self.test_user.id)[0]
        self.assertNotEqual(projects[0].disk_size, projects[1].disk_size, "projects should have different size")

        for project in projects:
            self.assertNotEqual(0, project.disk_size)
            self.assertNotEqual('0.0 KiB', project.disk_size_human)

            prj_folder = self.structure_helper.get_project_folder(project)
            actual_disk_size = self.compute_recursive_h5_disk_usage(prj_folder)[0]

            ratio = float(actual_disk_size) / project.disk_size
            msg = "Real disk usage: %s The one recorded in the db : %s" % (actual_disk_size, project.disk_size)
            self.assertTrue(ratio < 1.4, msg)


    def test_get_linkable_projects(self):
        """
        Test for retrieving the projects for a given user.
        """
        initial_projects = self.project_service.retrieve_projects_for_user(self.test_user.id)[0]
        self.assertEqual(len(initial_projects), 0, "Database was not reset!")
        test_proj = []
        user1 = TestFactory.create_user("another_user")
        for i in range(4):
            test_proj.append(TestFactory.create_project(self.test_user if i < 3 else user1, 'test_proj' + str(i)))

        project_storage = self.structure_helper.get_project_folder(test_proj[0])
        
        entity = dao.store_entity(model.AlgorithmCategory("category"))
        entity = dao.store_entity(model.AlgorithmGroup("module", "classname", entity.id))
        entity = dao.store_entity(model.Algorithm(entity.id, "algo"))
        operation = model.Operation(self.test_user.id, test_proj[0].id, entity.id, "")
        operation = dao.store_entity(operation)   
        project_storage = os.path.join(project_storage, str(operation.id))
        os.makedirs(project_storage)
        datatype = dao.store_entity(model.DataType(module="test_data", subject="subj1", 
                                                   state="test_state", operation_id=operation.id))
        linkable = self.project_service.get_linkable_projects_for_user(self.test_user.id, str(datatype.id))[0]
        self.assertEqual(len(linkable), 2, "Wrong count of link-able projects!")
        proj_names = [project.name for project in linkable]
        self.assertTrue(test_proj[1].name in proj_names)
        self.assertTrue(test_proj[2].name in proj_names)
        self.assertFalse(test_proj[3].name in proj_names)    
    
    
    def test_remove_project_happy_flow(self):
        """
        Standard flow for deleting a project.
        """
        inserted_project = TestFactory.create_project(self.test_user, 'test_proj')
        project_root = self.structure_helper.get_project_folder(inserted_project)
        projects = dao.get_projects_for_user(self.test_user.id)
        self.assertEqual(len(projects), 1, "Initializations failed!") 
        self.assertTrue(os.path.exists(project_root), "Something failed at insert time!")
        self.project_service.remove_project(inserted_project.id)
        projects = dao.get_projects_for_user(self.test_user.id)
        self.assertEqual(len(projects), 0, "Project was not deleted!")  
        self.assertFalse(os.path.exists(project_root), "Root folder not deleted!")  
        
        
    def test_remove_project_wrong_id(self):
        """
        Flow for deleting a project giving an un-existing id.
        """
        TestFactory.create_project(self.test_user, 'test_proj')
        projects = dao.get_projects_for_user(self.test_user.id)
        self.assertEqual(len(projects), 1, "Initializations failed!") 
        self.assertRaises(ProjectServiceException, self.project_service.remove_project, 99)   
    

    @staticmethod
    def _create_value_wrapper(test_user, test_project=None):
        """
        Creates a ValueWrapper dataType, and the associated parent Operation.
        This is also used in ProjectStructureTest.
        """
        if test_project is None:
            test_project = TestFactory.create_project(test_user, 'test_proj')
        operation = TestFactory.create_operation(test_user=test_user, test_project=test_project)
        value_wrapper = ValueWrapper(data_value=5.0, data_name="my_value")
        value_wrapper.type = "ValueWrapper"
        value_wrapper.module = "tvb.datatypes.mapped_values"
        value_wrapper.subject = "John Doe"
        value_wrapper.state = "RAW_STATE"
        value_wrapper.set_operation_id(operation.id)
        adapter_instance = StoreAdapter([value_wrapper])
        OperationService().initiate_prelaunch(operation, adapter_instance, {})
        all_value_wrappers = FlowService().get_available_datatypes(test_project.id,
                                                                   "tvb.datatypes.mapped_values.ValueWrapper")[0]
        if len(all_value_wrappers) != 1:
            raise Exception("Should be only one value wrapper.")
        result_vw = ABCAdapter.load_entity_by_gid(all_value_wrappers[0][2])
        return test_project, result_vw.gid, operation.gid

     
    def __check_meta_data(self, expected_meta_data, new_datatype):
        """Validate Meta-Data"""
        mapp_keys = {DataTypeMetaData.KEY_SUBJECT: "subject", DataTypeMetaData.KEY_STATE: "state"}
        for key, value in expected_meta_data.iteritems():
            if key in mapp_keys:
                self.assertEqual(value, getattr(new_datatype, mapp_keys[key]))
            elif key == DataTypeMetaData.KEY_OPERATION_TAG:
                if DataTypeMetaData.KEY_OP_GROUP_ID in expected_meta_data:
                    ## We have a Group to check
                    op_group = new_datatype.parent_operation.fk_operation_group
                    op_group = dao.get_generic_entity(model.OperationGroup, op_group)[0]
                    self.assertEqual(value, op_group.name)
                else:
                    self.assertEqual(value, new_datatype.parent_operation.user_group) 
    
    
    def test_remove_project_node(self):
        """
        Test removing of a node from a project.
        """
        inserted_project, gid, gid_op = self._create_value_wrapper(self.test_user) 
        project_to_link = model.Project("Link", self.test_user.id, "descript")
        project_to_link = dao.store_entity(project_to_link)
        exact_data = dao.get_datatype_by_gid(gid)
        dao.store_entity(model.Links(exact_data.id, project_to_link.id))
        self.assertTrue(dao.get_datatype_by_gid(gid) is not None, "Initialization problem!")
        
        operation_id = dao.get_generic_entity(model.Operation, gid_op, 'gid')[0].id
        op_folder = self.structure_helper.get_project_folder("test_proj", str(operation_id))
        self.assertTrue(os.path.exists(op_folder))
        sub_files = os.listdir(op_folder)
        self.assertEqual(2, len(sub_files))
        ### Validate that no more files are created than needed.
        
        self.project_service._remove_project_node_files(inserted_project.id, gid)
        sub_files = os.listdir(op_folder)
        self.assertEqual(1, len(sub_files))
        ### Validate that Operation GID_file is still there.
        
        op_folder = self.structure_helper.get_project_folder("Link", str(operation_id + 1)) 
        sub_files = os.listdir(op_folder)
        self.assertEqual(1, len(sub_files)) 
        self.assertTrue(dao.get_datatype_by_gid(gid) is not None, "Data should still be there because of links")
        self.project_service._remove_project_node_files(project_to_link.id, gid)
        self.assertTrue(dao.get_datatype_by_gid(gid) is None)  
        sub_files = os.listdir(op_folder)
        self.assertEqual(0, len(sub_files))
        
        
    def test_update_meta_data_simple(self):
        """
        Test the new update metaData for a simple data that is not part of a group.
        """
        inserted_project, gid, _ = self._create_value_wrapper(self.test_user)
        new_meta_data = {DataTypeOverlayDetails.DATA_SUBJECT: "new subject",
                         DataTypeOverlayDetails.DATA_STATE: "second_state",
                         DataTypeOverlayDetails.CODE_GID: gid,
                         DataTypeOverlayDetails.CODE_OPERATION_TAG: 'new user group'}
        self.project_service.update_metadata(new_meta_data)
        
        new_datatype = dao.get_datatype_by_gid(gid)
        self.__check_meta_data(new_meta_data, new_datatype)
        
        op_path = FilesHelper().get_operation_meta_file_path(inserted_project.name, new_datatype.parent_operation.id)
        op_meta = XMLReader(op_path).read_metadata()
        self.assertEqual(op_meta['user_group'], 'new user group', 'UserGroup not updated!')


    def test_update_meta_data_group(self):
        """
        Test the new update metaData for a group of dataTypes.
        """
        datatypes, group_id = TestFactory.create_group(self.test_user, subject="test-subject-1")

        new_meta_data = {DataTypeOverlayDetails.DATA_SUBJECT: "new subject",
                         DataTypeOverlayDetails.DATA_STATE: "updated_state",
                         DataTypeOverlayDetails.CODE_OPERATION_GROUP_ID: group_id,
                         DataTypeOverlayDetails.CODE_OPERATION_TAG: 'newGroupName'}
        self.project_service.update_metadata(new_meta_data)  
          
        for datatype in datatypes:
            new_datatype = dao.get_datatype_by_id(datatype.id)
            self.assertEqual(group_id, new_datatype.parent_operation.fk_operation_group)
            new_group = dao.get_generic_entity(model.OperationGroup, group_id)[0]
            self.assertEqual(new_group.name, "newGroupName") 
            self.__check_meta_data(new_meta_data, new_datatype)
            
    
    def _create_datatypes(self, dt_factory, nr_of_dts):
        for idx in range(nr_of_dts):
            dt = Datatype1()
            dt.row1 = "value%i" % (idx,)
            dt.row2 = "value%i" % (idx + 1,)
            dt_factory._store_datatype(dt)
            
            
    def test_retrieve_project_full(self):
        """
        Tests full project information is retrieved by method `ProjectService.retrieve_project_full(...)`
        """
        dt_factory = datatypes_factory.DatatypesFactory()
        self._create_datatypes(dt_factory, 3)
        _, ops_nr, _, operations, pages_no = self.project_service.retrieve_project_full(dt_factory.project.id)
        self.assertEqual(ops_nr, 1, "DataType Factory should only use one operation to store all it's datatypes.")
        self.assertEqual(pages_no, 1, "DataType Factory should only use one operation to store all it's datatypes.")
        resulted_dts = operations[0]['results']
        self.assertEqual(len(resulted_dts), 3, "3 datatypes should be created.")
        
        
    def test_get_project_structure(self):
        """
        Tests project structure is as expected and contains all datatypes
        """
        dt_factory = datatypes_factory.DatatypesFactory()
        self._create_datatypes(dt_factory, 3)
        node_json = self.project_service.get_project_structure(dt_factory.project, None,
                                                               'Data_State', 'Data_Subject', None)
        encoder = JSONEncoder()
        encoder.iterencode(node_json)
        # No exceptions were raised so far.
        project_dts = dao.get_datatypes_for_project(dt_factory.project.id)
        for dt in project_dts:
            self.assertTrue(dt.gid in node_json, "Should have all DataTypes present in resulting JSON.")
            
            
def suite():
    """
    Gather all the tests in a test suite.
    """
    test_suite = unittest.TestSuite()
    test_suite.addTest(unittest.makeSuite(ProjectServiceTest))
    return test_suite


if __name__ == "__main__":
    #So you can run tests individually.
    TEST_RUNNER = unittest.TextTestRunner()
    TEST_SUITE = suite()
    TEST_RUNNER.run(TEST_SUITE)
    
    