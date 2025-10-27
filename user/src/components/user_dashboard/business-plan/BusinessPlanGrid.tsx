'use client';

import React, { useState, useMemo } from 'react';
import { BusinessPlan, PlanStatus, PlanTemplate } from '@/mockData/businessPlanMockData';
import BusinessPlanCard from './BusinessPlanCard';
import { Plus, Search, Filter, BarChart3, TrendingUp, Clock, Users } from 'lucide-react';

interface BusinessPlanGridProps {
  plans: BusinessPlan[];
  onPlanEdit: (plan: BusinessPlan) => void;
  onPlanView: (plan: BusinessPlan) => void;
  onPlanShare: (plan: BusinessPlan) => void;
  onPlanDelete: (plan: BusinessPlan) => void;
  onPlanDuplicate: (plan: BusinessPlan) => void;
  onCreateNew: () => void;
}

export default function BusinessPlanGrid({
  plans,
  onPlanEdit,
  onPlanView,
  onPlanShare,
  onPlanDelete,
  onPlanDuplicate,
  onCreateNew
}: BusinessPlanGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<PlanStatus | 'all'>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<PlanTemplate | 'all'>('all');
  const [sortBy, setSortBy] = useState<'title' | 'date' | 'progress' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter and sort plans
  const filteredAndSortedPlans = useMemo(() => {
    let filtered = plans.filter(plan => {
      const matchesSearch = plan.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         plan.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         plan.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = selectedStatus === 'all' || plan.status === selectedStatus;
      const matchesTemplate = selectedTemplate === 'all' || plan.template === selectedTemplate;

      return matchesSearch && matchesStatus && matchesTemplate;
    });

    // Sort plans
    return filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'date':
          aValue = a.modifiedDate.getTime();
          bValue = b.modifiedDate.getTime();
          break;
        case 'progress':
          aValue = a.progress;
          bValue = b.progress;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [plans, searchQuery, selectedStatus, selectedTemplate, sortBy, sortOrder]);

  const handleSort = (field: 'title' | 'date' | 'progress' | 'status') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const stats = {
    total: plans.length,
    completed: plans.filter(plan => plan.status === PlanStatus.COMPLETED).length,
    inProgress: plans.filter(plan => plan.status === PlanStatus.IN_PROGRESS).length,
    shared: plans.filter(plan => plan.shareStatus === 'shared').length,
    averageProgress: Math.round(plans.reduce((sum, plan) => sum + plan.progress, 0) / plans.length)
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#778da9] mb-1">Total Plans</p>
              <p className="text-2xl font-bold text-[#1b263b]">{stats.total}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-[#150578]" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#778da9] mb-1">Completed</p>
              <p className="text-2xl font-bold text-[#63d51d]">{stats.completed}</p>
            </div>
            <svg className="w-8 h-8 text-[#63d51d]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#778da9] mb-1">In Progress</p>
              <p className="text-2xl font-bold text-[#ff8600]">{stats.inProgress}</p>
            </div>
            <Clock className="w-8 h-8 text-[#ff8600]" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#778da9] mb-1">Shared</p>
              <p className="text-2xl font-bold text-[#150578]">{stats.shared}</p>
            </div>
            <Users className="w-8 h-8 text-[#150578]" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#778da9] mb-1">Avg Progress</p>
              <p className="text-2xl font-bold text-[#63d51d]">{stats.averageProgress}%</p>
            </div>
            <TrendingUp className="w-8 h-8 text-[#63d51d]" />
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex-1 flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#778da9] w-4 h-4" />
            <input
              type="text"
              placeholder="Search business plans..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as PlanStatus | 'all')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value={PlanStatus.DRAFT}>Draft</option>
            <option value={PlanStatus.IN_PROGRESS}>In Progress</option>
            <option value={PlanStatus.REVIEW}>Under Review</option>
            <option value={PlanStatus.COMPLETED}>Completed</option>
            <option value={PlanStatus.PUBLISHED}>Published</option>
          </select>

          {/* Template Filter */}
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value as PlanTemplate | 'all')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
          >
            <option value="all">All Templates</option>
            <option value={PlanTemplate.STARTUP}>Startup</option>
            <option value={PlanTemplate.ESTABLISHED}>Established</option>
            <option value={PlanTemplate.NONPROFIT}>Nonprofit</option>
            <option value={PlanTemplate.RESTAURANT}>Restaurant</option>
            <option value={PlanTemplate.TECH}>Tech</option>
            <option value={PlanTemplate.RETAIL}>Retail</option>
          </select>
        </div>

        {/* Create New Button */}
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 px-4 py-2 bg-[#150578] text-white rounded-lg hover:bg-[#0d0342] transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Create New Plan</span>
        </button>
      </div>

      {/* Results Summary and Sort */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-[#778da9]">
          Showing {filteredAndSortedPlans.length} of {plans.length} business plans
          {searchQuery && (
            <span>
              {' '}for &quot;<span className="font-medium text-[#1b263b]">{searchQuery}</span>&quot;
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Sort Options */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#778da9]">Sort by:</span>
            <button
              onClick={() => handleSort('title')}
              className={`px-3 py-1 rounded-md transition-colors ${
                sortBy === 'title' ? 'bg-[#150578] text-white' : 'text-[#778da9] hover:text-[#150578]'
              }`}
            >
              Title
            </button>
            <button
              onClick={() => handleSort('date')}
              className={`px-3 py-1 rounded-md transition-colors ${
                sortBy === 'date' ? 'bg-[#150578] text-white' : 'text-[#778da9] hover:text-[#150578]'
              }`}
            >
              Date
            </button>
            <button
              onClick={() => handleSort('progress')}
              className={`px-3 py-1 rounded-md transition-colors ${
                sortBy === 'progress' ? 'bg-[#150578] text-white' : 'text-[#778da9] hover:text-[#150578]'
              }`}
            >
              Progress
            </button>
            <button
              onClick={() => handleSort('status')}
              className={`px-3 py-1 rounded-md transition-colors ${
                sortBy === 'status' ? 'bg-[#150578] text-white' : 'text-[#778da9] hover:text-[#150578]'
              }`}
            >
              Status
            </button>
          </div>
        </div>
      </div>

      {/* Plans Display */}
      {filteredAndSortedPlans.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <div className="text-[#778da9] mb-4">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-[#1b263b] mb-2">
            {searchQuery || selectedStatus !== 'all' || selectedTemplate !== 'all'
              ? 'No business plans found'
              : 'No business plans yet'}
          </h3>
          <p className="text-[#778da9] mb-4">
            {searchQuery || selectedStatus !== 'all' || selectedTemplate !== 'all'
              ? 'Try adjusting your search or filter criteria'
              : 'Create your first business plan to get started'}
          </p>
          {!searchQuery && selectedStatus === 'all' && selectedTemplate === 'all' && (
            <button
              onClick={onCreateNew}
              className="flex items-center gap-2 mx-auto px-6 py-2 bg-[#150578] text-white rounded-lg hover:bg-[#0d0342] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Business Plan
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedPlans.map((plan) => (
            <BusinessPlanCard
              key={plan.id}
              plan={plan}
              onEdit={onPlanEdit}
              onView={onPlanView}
              onShare={onPlanShare}
              onDelete={onPlanDelete}
              onDuplicate={onPlanDuplicate}
            />
          ))}
        </div>
      )}
    </div>
  );
}