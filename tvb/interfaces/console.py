"""
tvb.console
-----------

Provides convenient access to framework from the console. 

"""

## Select the profile with storage enabled, but without web interface:
from tvb.basic.profile import TvbProfile as tvb_profile
tvb_profile.set_profile(["-profile", "CONSOLE_PROFILE"], try_reload=False)

from tvb.core.traits import db_events
from tvb.core.entities.model import AlgorithmGroup, Algorithm
from tvb.core.entities.storage import dao
from tvb.core.services.flow_service import FlowService
from tvb.core.services.operation_service import OperationService

# Hook DB events (like prepare json attributes on traited DataTypes):
db_events.attach_db_events()


# Take from Lia's example. How to provide more functionality in
# a convenient way for the console user?
"""
    flow_service = FlowService()
    operation_service = OperationService()

    ## This ID of a project needs to exists in Db, and it can be taken from the WebInterface:
    project = dao.get_project_by_id(1)

    ## This is our new added Importer:
    adapter_instance = FooDataImporter()
    ## We need to store a reference towards the new algorithms also in DB:
    # First select the category of uploaders:
    upload_category = dao.get_uploader_categories()[0]
    # check if the algorithm has been added in DB already
    my_group = dao.find_group(FooDataImporter.__module__, FooDataImporter.__name__)
    if my_group is None:
        # not stored in DB previously, we will store it now:
        my_group = AlgorithmGroup(FooDataImporter.__module__, FooDataImporter.__name__, upload_category.id)
        my_group = dao.store_entity(my_group)
        dao.store_entity(Algorithm(my_group.id, "", "FooName"))

    adapter_instance.algorithm_group = my_group

    ## Prepare the input algorithms as if they were coming from web UI submit:
    #launch_args = {"array_data": "[1, 2, 3, 4, 5]"}
    launch_args = {"array_data" : "demo_array.txt"}

    ## launch an operation and have the results sotored both in DB and on disk
    launched_operations = flow_service.fire_operation(adapter_instance,
                                                      project.administrator,
                                                      project.id,
                                                      **launch_args)
"""
