'use client';

import React, { useState, useCallback } from 'react';
import { mockBusinessPlanPageProps, BusinessPlan, PlanTemplate } from '@/mockData/businessPlanMockData';
import { BusinessPlanSection } from '@/mockData/businessPlanMockData';
import BusinessPlanGrid from '@/components/user_dashboard/business-plan/usinessPlanGrid';
import { Lightbulb, Target, TrendingUp, Calendar, DollarSign, Users, ArrowRight, Plus } from 'lucide-react';
import { getBusinessPlanMarketData, getBusinessPlanStats, listBusinessPlans } from '@/lib/api/business-plans';

export default function BusinessPlanPage() {
  const [plans, setPlans] = useState(mockBusinessPlanPageProps.plans);
  const [stats, setStats] = useState(mockBusinessPlanPageProps.stats);
  const [marketData, setMarketData] = useState(mockBusinessPlanPageProps.marketData);
  const [currentView, setCurrentView] = useState<'overview' | 'editor' | 'templates'>('overview');
  const [selectedPlan, setSelectedPlan] = useState<BusinessPlan | null>(null);

  React.useEffect(() => {
    listBusinessPlans().then(setPlans).catch(() => undefined);
    getBusinessPlanStats().then(setStats).catch(() => undefined);
    getBusinessPlanMarketData().then(setMarketData).catch(() => undefined);
  }, []);

  const handleCreateNew = useCallback(() => {
    // Create new business plan
    const newPlan: BusinessPlan = {
      id: `plan-${Date.now()}`,
      title: 'New Business Plan',
      template: PlanTemplate.STARTUP,
      status: 'Draft' as any,
      createdDate: new Date(),
      modifiedDate: new Date(),
      author: 'John Mike',
      description: 'Click to edit your new business plan',
      sections: [
        {
          id: 'section-new-1',
          type: BusinessPlanSection.EXECUTIVE_SUMMARY,
          title: 'Executive Summary',
          content: '',
          isCompleted: false,
          wordCount: 0,
          lastModified: new Date()
        }
      ],
      progress: 0,
      shareStatus: 'private',
      targetAudience: '',
      industry: '',
      tags: []
    };

    setPlans(prev => [newPlan, ...prev]);
    setSelectedPlan(newPlan);
    setCurrentView('editor');
  }, []);

  const handlePlanEdit = useCallback((plan: BusinessPlan) => {
    setSelectedPlan(plan);
    setCurrentView('editor');
  }, []);

  const handlePlanView = useCallback((plan: BusinessPlan) => {
    setSelectedPlan(plan);
    setCurrentView('editor');
  }, []);

  const handlePlanShare = useCallback((plan: BusinessPlan) => {
    // Share logic
    setPlans(prev => prev.map(p =>
      p.id === plan.id ? { ...p, shareStatus: p.shareStatus === 'shared' ? 'private' as any : 'shared' as any } : p
    ));
    alert(`Plan "${plan.title}" ${plan.shareStatus === 'shared' ? 'unshared' : 'shared'}`);
  }, []);

  const handlePlanDelete = useCallback((plan: BusinessPlan) => {
    if (confirm(`Are you sure you want to delete "${plan.title}"?`)) {
      setPlans(prev => prev.filter(p => p.id !== plan.id));
    }
  }, []);

  const handlePlanDuplicate = useCallback((plan: BusinessPlan) => {
    const duplicatedPlan: BusinessPlan = {
      ...plan,
      id: `plan-${Date.now()}`,
      title: `${plan.title} (Copy)`,
      status: 'Draft' as any,
      createdDate: new Date(),
      modifiedDate: new Date()
    };

    setPlans(prev => [duplicatedPlan, ...prev]);
  }, []);

  if (currentView === 'templates') {
    return (
      <div className="p-6 bg-[#f2f3f4] min-h-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#1b263b] mb-2">Business Plan Templates</h1>
          <p className="text-[#778da9]">
            Choose a template to get started with your business plan
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.values(PlanTemplate).map((template) => (
            <div
              key={template}
              className="bg-white p-6 border border-gray-200 rounded-lg cursor-pointer hover:shadow-md hover:border-[#150578] transition-all"
              onClick={() => {
                const newPlan: BusinessPlan = {
                  id: `plan-${Date.now()}`,
                  title: `New ${template}`,
                  template: template,
                  status: 'Draft' as any,
                  createdDate: new Date(),
                  modifiedDate: new Date(),
                  author: 'John Mike',
                  description: `${template} business plan`,
                  sections: [
                    {
                      id: 'section-template-1',
                      type: BusinessPlanSection.EXECUTIVE_SUMMARY,
                      title: 'Executive Summary',
                      content: '',
                      isCompleted: false,
                      wordCount: 0,
                      lastModified: new Date()
                    }
                  ],
                  progress: 0,
                  shareStatus: 'private',
                  targetAudience: '',
                  industry: '',
                  tags: []
                };

                setPlans(prev => [newPlan, ...prev]);
                setSelectedPlan(newPlan);
                setCurrentView('editor');
              }}
            >
              <div className="text-4xl mb-4">
                {template === PlanTemplate.STARTUP && '🚀'}
                {template === PlanTemplate.ESTABLISHED && '🏢'}
                {template === PlanTemplate.NONPROFIT && '🤝'}
                {template === PlanTemplate.RESTAURANT && '🍽'}
                {template === PlanTemplate.TECH && '💻'}
                {template === PlanTemplate.RETAIL && '🛍'}
              </div>
              <h3 className="font-semibold text-[#1b263b] mb-2">{template}</h3>
              <p className="text-sm text-[#778da9] mb-4">
                Professional template designed for {template.toLowerCase()} businesses
              </p>
              <button className="w-full px-4 py-2 bg-[#150578] text-white rounded-lg hover:bg-[#0d0342] transition-colors">
                Use This Template
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => setCurrentView('overview')}
          className="mt-6 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          ← Back to Overview
        </button>
      </div>
    );
  }

  if (currentView === 'editor' && selectedPlan) {
    return (
      <div className="p-6 bg-[#f2f3f4] min-h-full">
        <div className="mb-6">
          <button
            onClick={() => setCurrentView('overview')}
            className="mb-4 text-[#778da9] hover:text-[#150578] transition-colors"
          >
            ← Back to Overview
          </button>
          <h1 className="text-3xl font-bold text-[#1b263b] mb-2">{selectedPlan.title}</h1>
          <div className="flex items-center gap-4 text-sm text-[#778da9]">
            <span>Template: {selectedPlan.template}</span>
            <span>•</span>
            <span>Status: {selectedPlan.status}</span>
            <span>•</span>
            <span>Progress: {selectedPlan.progress}%</span>
          </div>
        </div>

        {/* Business Plan Editor */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <h2 className="text-xl font-semibold text-[#1b263b] mb-4">Plan Sections</h2>
              <div className="space-y-4">
                {selectedPlan.sections.map((section, index) => (
                  <div key={section.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-[#1b263b]">{section.title}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        section.isCompleted ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {section.isCompleted ? 'Completed' : 'In Progress'}
                      </span>
                    </div>
                    <textarea
                      value={section.content}
                      onChange={(e) => {
                        const updatedSections = [...selectedPlan.sections];
                        updatedSections[index] = { ...section, content: e.target.value };
                        const updatedPlan = { ...selectedPlan, sections: updatedSections };
                        setSelectedPlan(updatedPlan);
                        setPlans(prev => prev.map(p => p.id === selectedPlan.id ? updatedPlan : p));
                      }}
                      placeholder="Start writing your business plan section..."
                      className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent resize-none"
                    />
                    <div className="flex items-center justify-between mt-2 text-sm text-[#778da9]">
                      <span>{section.wordCount} words</span>
                      <button
                        onClick={() => {
                          const updatedSections = [...selectedPlan.sections];
                          updatedSections[index] = { ...section, isCompleted: !section.isCompleted };
                          const updatedPlan = { ...selectedPlan, sections: updatedSections };
                          setSelectedPlan(updatedPlan);
                          setPlans(prev => prev.map(p => p.id === selectedPlan.id ? updatedPlan : p));
                        }}
                        className={`px-3 py-1 rounded-md text-xs font-medium ${
                          section.isCompleted
                            ? 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                            : 'bg-[#150578] text-white hover:bg-[#0d0342]'
                        }`}
                      >
                        {section.isCompleted ? 'Mark as In Progress' : 'Mark as Complete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-[#1b263b] mb-4">Plan Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#1b263b] mb-2">Description</label>
                  <textarea
                    value={selectedPlan.description}
                    onChange={(e) => {
                      const updatedPlan = { ...selectedPlan, description: e.target.value };
                      setSelectedPlan(updatedPlan);
                      setPlans(prev => prev.map(p => p.id === selectedPlan.id ? updatedPlan : p));
                    }}
                    className="w-full h-20 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1b263b] mb-2">Target Audience</label>
                  <input
                    type="text"
                    value={selectedPlan.targetAudience}
                    onChange={(e) => {
                      const updatedPlan = { ...selectedPlan, targetAudience: e.target.value };
                      setSelectedPlan(updatedPlan);
                      setPlans(prev => prev.map(p => p.id === selectedPlan.id ? updatedPlan : p));
                    }}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1b263b] mb-2">Industry</label>
                  <input
                    type="text"
                    value={selectedPlan.industry}
                    onChange={(e) => {
                      const updatedPlan = { ...selectedPlan, industry: e.target.value };
                      setSelectedPlan(updatedPlan);
                      setPlans(prev => prev.map(p => p.id === selectedPlan.id ? updatedPlan : p));
                    }}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-[#f2f3f4] min-h-full">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1b263b] mb-2">Business Plan</h1>
        <p className="text-[#778da9]">
          Create, manage, and track your business plans with intelligent templates and tools
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#778da9] mb-1">Total Plans</p>
              <p className="text-2xl font-bold text-[#1b263b]">{stats.totalPlans}</p>
            </div>
            <Target className="w-8 h-8 text-[#150578]" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#778da9] mb-1">Completed</p>
              <p className="text-2xl font-bold text-[#63d51d]">{stats.completedPlans}</p>
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
              <p className="text-2xl font-bold text-[#ff8600]">{stats.inProgressPlans}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-[#ff8600]" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#778da9] mb-1">Avg Progress</p>
              <p className="text-2xl font-bold text-[#63d51d]">{Math.round(stats.averageProgress)}%</p>
            </div>
            <Lightbulb className="w-8 h-8 text-[#63d51d]" />
          </div>
        </div>
      </div>

      {/* Market Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-[#1b263b] mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[#150578]" />
            Market Size & Growth
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-[#778da9] mb-1">Total Market Size</p>
              <p className="text-xl font-bold text-[#1b263b]">
                ${(marketData.marketSize / 1000000).toFixed(0)}M
              </p>
            </div>
            <div>
              <p className="text-sm text-[#778da9] mb-1">Annual Growth Rate</p>
              <p className="text-xl font-bold text-[#63d51d]">+{marketData.growthRate}%</p>
            </div>
            <div>
              <p className="text-sm text-[#778da9] mb-1">Competition Level</p>
              <p className="text-lg font-medium capitalize text-[#ff8600]">{marketData.competitionLevel}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-semibold text-[#1b263b] mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#150578]" />
            Target Market
          </h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-[#778da9] mb-1">Primary Demographic</p>
              <p className="text-lg font-medium text-[#1b263b]">{marketData.targetDemographic}</p>
            </div>
            <div>
              <p className="text-sm text-[#778da9] mb-2">Key Segments</p>
              <div className="space-y-2">
                {marketData.keySegments.map((segment, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-[#150578] rounded-full"></div>
                    <span className="text-sm text-[#1b263b]">{segment}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <button
          onClick={handleCreateNew}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-[#150578] text-white rounded-lg hover:bg-[#0d0342] transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create New Plan
        </button>
        <button
          onClick={() => setCurrentView('templates')}
          className="flex items-center justify-center gap-2 px-6 py-3 border border-[#150578] text-[#150578] rounded-lg hover:bg-[#150578] hover:text-white transition-colors"
        >
          <Lightbulb className="w-5 h-5" />
          Browse Templates
        </button>
      </div>

      {/* Business Plans Grid */}
      <BusinessPlanGrid
        plans={plans}
        onPlanEdit={handlePlanEdit}
        onPlanView={handlePlanView}
        onPlanShare={handlePlanShare}
        onPlanDelete={handlePlanDelete}
        onPlanDuplicate={handlePlanDuplicate}
        onCreateNew={handleCreateNew}
      />
    </div>
  );
}
