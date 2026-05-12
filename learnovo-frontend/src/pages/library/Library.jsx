import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, BookOpen, BookCheck, Users, Bookmark, ReceiptText, BarChart3,
  AlertTriangle, Library as LibraryIcon
} from 'lucide-react';
import libraryService from '../../services/libraryService';
import OverviewTab from '../../components/library/tabs/OverviewTab';
import BooksTab from '../../components/library/tabs/BooksTab';
import IssuesTab from '../../components/library/tabs/IssuesTab';
import MembersTab from '../../components/library/tabs/MembersTab';
import ReservationsTab from '../../components/library/tabs/ReservationsTab';
import FinesTab from '../../components/library/tabs/FinesTab';
import ReportsTab from '../../components/library/tabs/ReportsTab';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'books', label: 'Books', icon: BookOpen },
  { id: 'issues', label: 'Issue / Return', icon: BookCheck },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'reservations', label: 'Reservations', icon: Bookmark },
  { id: 'fines', label: 'Fines', icon: ReceiptText },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
];

const Library = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);

  const handleTabChange = (id) => {
    setActiveTab(id);
    const next = new URLSearchParams(searchParams);
    if (id === 'overview') next.delete('tab');
    else next.set('tab', id);
    setSearchParams(next, { replace: true });
  };

  const { data: dashboardRes, isLoading: statsLoading } = useQuery({
    queryKey: ['library-dashboard'],
    queryFn: () => libraryService.getDashboard()
  });
  const stats = dashboardRes?.data?.stats || {};

  const statCards = [
    { label: 'Total Books', value: stats.totalBooks || 0, sub: `${stats.totalCopies || 0} copies`, icon: BookOpen, color: 'bg-primary-500' },
    { label: 'Active Members', value: stats.totalMembers || 0, icon: Users, color: 'bg-blue-500' },
    { label: 'Currently Issued', value: stats.currentlyIssued || 0, sub: `${stats.issuedToday || 0} today`, icon: BookCheck, color: 'bg-indigo-500' },
    { label: 'Overdue', value: stats.overdue || 0, icon: AlertTriangle, color: 'bg-amber-500' },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
          <LibraryIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
          Library Management
        </h1>
        <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Books, issues, members, reservations and fines</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white dark:bg-white/[0.08] dark:border dark:border-white/[0.15] dark:shadow-[0_4px_24px_rgba(0,0,0,0.10)] rounded-2xl shadow-glass p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm text-gray-500 dark:text-[#8E8E93]">{stat.label}</p>
                  <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-2">
                    {statsLoading ? '...' : stat.value}
                  </p>
                  {stat.sub && <p className="text-xs text-gray-400 dark:text-[#636366] mt-1">{stat.sub}</p>}
                </div>
                <div className={`${stat.color} p-3 rounded-xl flex-shrink-0`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs container */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-glass overflow-hidden">
        <div className="border-b border-gray-200 dark:border-[#38383A]">
          <nav className="flex space-x-6 sm:space-x-8 px-4 sm:px-6 overflow-x-auto overflow-y-hidden whitespace-nowrap" aria-label="Tabs">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    isActive
                      ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === 'overview' && <OverviewTab onNavigate={handleTabChange} />}
          {activeTab === 'books' && <BooksTab />}
          {activeTab === 'issues' && <IssuesTab />}
          {activeTab === 'members' && <MembersTab />}
          {activeTab === 'reservations' && <ReservationsTab />}
          {activeTab === 'fines' && <FinesTab />}
          {activeTab === 'reports' && <ReportsTab />}
        </div>
      </div>
    </div>
  );
};

export default Library;
