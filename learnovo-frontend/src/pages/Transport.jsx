import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bus, Users, MapPin, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import transportService from '../services/transportService';
import DriversTab from '../components/transport/DriversTab';
import VehiclesTab from '../components/transport/VehiclesTab';
import RoutesTab from '../components/transport/RoutesTab';
import AssignmentsTab from '../components/transport/AssignmentsTab';

const Transport = () => {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('drivers');

    const { data: stats = { totalDrivers: 0, totalVehicles: 0, activeRoutes: 0, studentsUsingTransport: 0 }, isLoading: loading } = useQuery({
        queryKey: ['transport-stats'],
        queryFn: async () => {
            const [driversRes, vehiclesRes, routesRes, assignmentsRes] = await Promise.all([
                transportService.getDrivers({ limit: 1 }),
                transportService.getVehicles({ limit: 1 }),
                transportService.getRoutes({ status: 'active', limit: 1 }),
                transportService.getStudentTransportAssignments({ status: 'active', limit: 1 })
            ]);

            return {
                totalDrivers: driversRes.pagination?.total || 0,
                totalVehicles: vehiclesRes.pagination?.total || 0,
                activeRoutes: routesRes.pagination?.total || 0,
                studentsUsingTransport: assignmentsRes.pagination?.total || 0
            };
        },
    });

    const invalidateStats = () => {
        queryClient.invalidateQueries({ queryKey: ['transport-stats'] });
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
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Transport Management</h1>
                <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Manage drivers, vehicles, routes, and student transport assignments</p>
            </div>

            {/* Stats Cards — simulated glass */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {statCards.map((stat, index) => {
                    const Icon = stat.icon;
                    return (
                        <div key={index} className="bg-white dark:bg-white/[0.08] dark:border dark:border-white/[0.15] dark:shadow-[0_4px_24px_rgba(0,0,0,0.10)] rounded-2xl shadow-glass p-4 sm:p-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-500 dark:text-[#8E8E93]">{stat.label}</p>
                                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                                        {loading ? '...' : stat.value}
                                    </p>
                                </div>
                                <div className={`${stat.color} p-3 rounded-xl`}>
                                    <Icon className="w-6 h-6 text-white" />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Tabs */}
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass overflow-hidden">
                <div className="border-b border-gray-200 dark:border-[#38383A]">
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
                                            : 'border-transparent text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white hover:border-gray-300'
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
                    {activeTab === 'drivers' && <DriversTab onStatsUpdate={invalidateStats} />}
                    {activeTab === 'vehicles' && <VehiclesTab onStatsUpdate={invalidateStats} />}
                    {activeTab === 'routes' && <RoutesTab onStatsUpdate={invalidateStats} />}
                    {activeTab === 'assignments' && <AssignmentsTab onStatsUpdate={invalidateStats} />}
                </div>
            </div>
        </div>
    );
};

export default Transport;

