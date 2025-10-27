'use client';

import React, { useState } from 'react';
import { BusinessPlan, PlanStatus, PlanTemplate } from '@/mockData/businessPlanMockData';
import { formatDate } from '@/mockData/businessPlanMockData';
import { MoreVertical, Share2, Eye, Edit3, Trash2, Users, Calendar, BarChart3 } from 'lucide-react';

interface BusinessPlanCardProps {
  plan: BusinessPlan;
  onEdit?: (plan: BusinessPlan) => void;
  onView?: (plan: BusinessPlan) => void;
  onShare?: (plan: BusinessPlan) => void;
  onDelete?: (plan: BusinessPlan) => void;
  onDuplicate?: (plan: BusinessPlan) => void;
}

export default function BusinessPlanCard({
  plan,
  onEdit,
  onView,
  onShare,
  onDelete,
  onDuplicate
}: BusinessPlanCardProps) {
  const [showActions, setShowActions] = useState(false);

  const getStatusColor = (status: PlanStatus) => {
    switch (status) {
      case PlanStatus.COMPLETED:
        return 'bg-green-100 text-green-800';
      case PlanStatus.IN_PROGRESS:
        return 'bg-blue-100 text-blue-800';
      case PlanStatus.REVIEW:
        return 'bg-orange-100 text-orange-800';
      case PlanStatus.PUBLISHED:
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500';
    if (progress >= 60) return 'bg-blue-500';
    if (progress >= 40) return 'bg-orange-500';
    return 'bg-gray-500';
  };

  const getTemplateIcon = (template: PlanTemplate) => {
    switch (template) {
      case PlanTemplate.STARTUP:
        return '🚀';
      case PlanTemplate.ESTABLISHED:
        return '🏢';
      case PlanTemplate.NONPROFIT:
        return '🤝';
      case PlanTemplate.RESTAURANT:
        return '🍽';
      case PlanTemplate.TECH:
        return '💻';
      case PlanTemplate.RETAIL:
        return '🛍';
      default:
        return '📄';
    }
  };

  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
    setShowActions(false);
  };

  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-6 cursor-pointer hover:shadow-md hover:border-[#150578] transition-all"
      onClick={() => onView?.(plan)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="text-2xl">
            {getTemplateIcon(plan.template)}
          </div>
          <div>
            <h3 className="font-semibold text-[#1b263b] text-lg mb-1">
              {plan.title}
            </h3>
            <p className="text-sm text-[#778da9]">
              {plan.template}
            </p>
          </div>
        </div>
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowActions(!showActions);
            }}
            className="p-2 text-[#778da9] hover:text-[#150578] hover:bg-gray-100 rounded-lg transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {showActions && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              {onView && (
                <button
                  onClick={(e) => handleActionClick(e, () => onView(plan))}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  View Plan
                </button>
              )}
              {onEdit && (
                <button
                  onClick={(e) => handleActionClick(e, () => onEdit(plan))}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit
                </button>
              )}
              {onShare && (
                <button
                  onClick={(e) => handleActionClick(e, () => onShare(plan))}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              )}
              {onDuplicate && (
                <button
                  onClick={(e) => handleActionClick(e, () => onDuplicate(plan))}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8v8z" />
                  </svg>
                  Duplicate
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => handleActionClick(e, () => onDelete(plan))}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-[#778da9] text-sm mb-4 line-clamp-2">
        {plan.description}
      </p>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[#1b263b]">Progress</span>
          <span className="text-sm font-bold text-[#150578]">{plan.progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${getProgressColor(plan.progress)}`}
            style={{ width: `${plan.progress}%` }}
          ></div>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#778da9]" />
          <span className="text-[#778da9]">
            Modified {formatDate(plan.modifiedDate)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#778da9]" />
          <span className="text-[#778da9]">
            {plan.sections.filter(s => s.isCompleted).length}/{plan.sections.length} sections
          </span>
        </div>
      </div>

      {/* Status and Actions */}
      <div className="flex items-center justify-between">
        <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(plan.status)}`}>
          {plan.status.replace('_', ' ')}
        </span>
        <div className="flex items-center gap-2">
          {plan.shareStatus === 'shared' && (
            <div className="flex items-center gap-1 text-[#ff8600]">
              <Users className="w-4 h-4" />
              <span className="text-xs font-medium">
                {plan.sharedWith?.length || 0} shared
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      {plan.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {plan.tags.map((tag, index) => (
            <span
              key={index}
              className="px-2 py-1 text-xs bg-[#f2f3f4] text-[#778da9] rounded-md"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}