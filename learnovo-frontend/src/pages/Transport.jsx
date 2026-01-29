import React, { useState, useEffect } from 'react';
import { Bus, Users, MapPin, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import transportService from '../services/transportService';
import DriversTab from '../components/transport/DriversTab';
import VehiclesTab from '../components/transport/VehiclesTab';
import RoutesTab from '../components/transport/RoutesTab';
import AssignmentsTab from '../components/transport/AssignmentsTab';

const Transport = () => {
    const [activeTab, setActiveTab] = useState('drivers');
    const [stats, setStats] = useState({
        totalDrivers: 0,
        totalVehicles: 0,
        activeRoutes: 0,
        studentsUsingTransport: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const [driversRes, vehiclesRes, routesRes, assignmentsRes] = await Promise.all([
                transportService.getDrivers({ limit: 1 }),
                transportService.getVehicles({ limit: 1 }),
                transportService.getRoutes({ status: 'active', limit: 1 }),
                transportService.getStudentTransportAssignments({ status: 'active', limit: 1 })
            ]);

            setStats({
                totalDrivers: driversRes.pagination?.total || 0,
                totalVehicles: vehiclesRes.pagination?.total || 0,
                activeRoutes: routesRes.pagination?.total || 0,
                studentsUsingTransport: assignmentsRes.pagination?.total || 0
            });
        } catch (error) {
            console.error('Error fetching stats:', error);
            toast.error('Failed to load transport statistics');
        } finally {
            setLoading(false);
        }
    };

    const tabs = [
        { id: 'drivers', label: 'Drivers', icon: UserCheck },
        { id: 'vehicles', label: 'Vehicles', icon: Bus },
        { id: 'routes', label: 'Routes', icon: MapPin },
        { id: 'assignments', label: 'Student Assignments', icon: Users }
    ];

    const statCards = [
        { label: 'Total Drivers', value: stats.totalDrivers, icon: UserCheck, color: 'bg-blue-500' },
        { label: 'Total Vehicles', value: stats.totalVehicles, icon: Bus, color: 'bg-green-500' },
        { label: 'Active Routes', value: stats.activeRoutes, icon: MapPin, color: 'bg-purple-500' },
        { label: 'Students Using Transport', value: stats.studentsUsingTransport, icon: Users, color: 'bg-orange-500' }
    ];

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Transport Management</h1>
                <p className="text-gray-600 mt-1">Manage drivers, vehicles, routes, and student transport assignments</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                {statCards.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <div key={index} className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600">{stat.label}</p>
                                    <p className="text-3xl font-bold text-gray-800 mt-2">
                                        {loading ? '...' : stat.value}
                                    </p>
                                </div>
                                <div className={`${stat.color} p-3 rounded-lg`}>
                                    <Icon className="w-6 h-6 text-white" />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-lg shadow">
                <div className="border-b border-gray-200">
                    <nav className="flex space-x-8 px-6" aria-label="Tabs">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                    flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm
                    ${activeTab === tab.id
                                            ? 'border-primary-500 text-primary-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }
                  `}
                                >
                                    <Icon className="w-5 h-5" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                    {activeTab === 'drivers' && <DriversTab onStatsUpdate={fetchStats} />}
                    {activeTab === 'vehicles' && <VehiclesTab onStatsUpdate={fetchStats} />}
                    {activeTab === 'routes' && <RoutesTab onStatsUpdate={fetchStats} />}
                    {activeTab === 'assignments' && <AssignmentsTab onStatsUpdate={fetchStats} />}
                </div>
            </div>
        </div>
    );
};

export default Transport;

