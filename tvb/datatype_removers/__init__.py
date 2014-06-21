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
This module contains custom functionality to be executed at remove time on various complex DataTypes.

Factory for mapping DataTypes to Remove handlers is build here.
"""

from tvb.datatype_removers.remover_connectivity import ConnectivityRemover
from tvb.datatype_removers.remover_sensor import SensorRemover
from tvb.datatype_removers.remover_surface import SurfaceRemover
from tvb.datatype_removers.remover_timeseries import TimeseriesRemover
from tvb.datatype_removers.remover_volume import VolumeRemover


REMOVERS_FACTORY = {
    'Connectivity': ConnectivityRemover,
    'CorticalSurface': SurfaceRemover,
    'SkinAir': SurfaceRemover,
    'BrainSkull': SurfaceRemover,
    'SkullSkin': SurfaceRemover,
    'SensorsEEG': SensorRemover,
    'SensorsMEG': SensorRemover,
    'TimeSeriesEEG': TimeseriesRemover,
    'TimeSeriesRegion': TimeseriesRemover,
    'TimeSeriesSurface': TimeseriesRemover,
    'TimeSeriesVolume': TimeseriesRemover,
    'Volume': VolumeRemover
}