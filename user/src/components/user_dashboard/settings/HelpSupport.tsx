'use client';

import React, { useState } from 'react';
import { HelpSettings, SupportTicket, BugReport, FeatureRequest } from './types';
import { HelpCircle, MessageCircle, AlertTriangle, Plus, Send, Search, ExternalLink, BookOpen, ThumbsUp, Filter } from 'lucide-react';

interface HelpSupportProps {
  settings: HelpSettings;
  onSettingsChange: (settings: HelpSettings) => void;
}

const tutorials = [
  {
    id: 'getting-started',
    title: 'Getting Started with Fund Flow AI',
    description: 'Learn the basics of financial management',
    duration: '15 min',
    progress: 100,
    videoUrl: '#'
  },
  {
    id: 'dashboard-overview',
    title: 'Understanding Your Dashboard',
    description: 'Navigate and use all dashboard features',
    duration: '10 min',
    progress: 75,
    videoUrl: '#'
  },
  {
    id: 'transactions-management',
    title: 'Managing Transactions',
    description: 'Track and categorize your financial activities',
    duration: '20 min',
    progress: 60,
    videoUrl: '#'
  },
  {
    id: 'reporting-analytics',
    title: 'Reports and Analytics',
    description: 'Generate insights from your financial data',
    duration: '25 min',
    progress: 30,
    videoUrl: '#'
  },
  {
    id: 'integrations-setup',
    title: 'Setting Up Integrations',
    description: 'Connect external services and APIs',
    duration: '30 min',
    progress: 0,
    videoUrl: '#'
  }
];

const faqCategories = [
  'Getting Started',
  'Account Management',
  'Security & Privacy',
  'Billing & Payments',
  'Troubleshooting',
  'Advanced Features'
];

const mockSupportTickets: SupportTicket[] = [
  {
    id: 'ticket-001',
    subject: 'Unable to connect bank account',
    description: 'I cannot connect my bank account to the dashboard.',
    status: 'resolved',
    priority: 'medium',
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-13'),
    lastResponse: new Date('2024-01-12'),
    responses: [],
    messages: [
      { sender: 'support', content: 'Please try clearing your browser cache and attempting the connection again.', timestamp: new Date('2024-01-11') },
      { sender: 'user', content: 'I tried that and it still doesn\'t work.', timestamp: new Date('2024-01-12') },
      { sender: 'support', content: 'I\'ve escalated this to our engineering team. They\'ll contact you within 24 hours.', timestamp: new Date('2024-01-13') }
    ]
  },
  {
    id: 'ticket-002',
    subject: 'Export function not working',
    description: 'The export button is unresponsive.',
    status: 'in-progress',
    priority: 'high',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-16'),
    responses: [],
    messages: [
      { sender: 'user', content: 'When I click export, nothing happens.', timestamp: new Date('2024-01-15') },
      { sender: 'support', content: 'We\'re investigating this issue. Can you tell me what browser you\'re using?', timestamp: new Date('2024-01-16') }
    ]
  },
  {
    id: 'ticket-003',
    subject: 'Request for invoice customization',
    description: 'I would like to customize my invoice templates.',
    status: 'closed',
    priority: 'low',
    createdAt: new Date('2024-01-08'),
    updatedAt: new Date('2024-01-09'),
    lastResponse: new Date('2024-01-09'),
    responses: [],
    messages: [
      { sender: 'user', content: 'Can you add custom invoice templates?', timestamp: new Date('2024-01-08') },
      { sender: 'support', content: 'This feature is planned for our Q2 release. We\'ll notify you when it\'s available.', timestamp: new Date('2024-01-09') }
    ]
  }
];

const mockBugReports: BugReport[] = [
  {
    id: 'bug-001',
    title: 'Mobile dashboard layout broken',
    description: 'Dashboard cards overlapping on mobile devices',
    status: 'resolved',
    severity: 'medium',
    createdAt: new Date('2024-01-05'),
    updatedAt: new Date('2024-01-12'),
    steps: [],
    screenshots: []
  },
  {
    id: 'bug-002',
    title: 'Export function fails with large datasets',
    description: 'Export fails when data exceeds 10,000 records',
    status: 'in-progress',
    severity: 'high',
    createdAt: new Date('2024-01-18'),
    updatedAt: new Date('2024-01-20'),
    steps: [],
    screenshots: []
  },
  {
    id: 'bug-003',
    title: 'Email notifications not sending',
    description: 'Payment reminders not being delivered to Gmail addresses',
    status: 'open',
    severity: 'medium',
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-01-22'),
    steps: [],
    screenshots: []
  }
];

const mockFeatureRequests: FeatureRequest[] = [
  {
    id: 'feature-001',
    title: 'Dark mode support',
    description: 'Add a dark theme option for the dashboard',
    status: 'approved',
    votes: 245,
    createdAt: new Date('2023-12-01'),
    updatedAt: new Date('2023-12-01'),
    category: 'enhancement'
  },
  {
    id: 'feature-002',
    title: 'Advanced search filters',
    description: 'More granular filtering options for transactions',
    status: 'approved',
    votes: 189,
    createdAt: new Date('2023-12-15'),
    updatedAt: new Date('2023-12-15'),
    category: 'enhancement'
  },
  {
    id: 'feature-003',
    title: 'Mobile app offline access',
    description: 'Access dashboard without internet connection',
    status: 'in-progress',
    votes: 156,
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-10'),
    category: 'new_feature'
  },
  {
    id: 'feature-004',
    title: 'API rate limit increase',
    description: 'Higher API limits for enterprise customers',
    status: 'approved',
    votes: 342,
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-01-20'),
    category: 'enhancement'
  }
];

export default function HelpSupport({ settings, onSettingsChange }: HelpSupportProps) {
  const [activeTab, setActiveTab] = useState('tutorials');
  const [searchQuery, setSearchQuery] = useState('');
  const [newTicket, setNewTicket] = useState({ subject: '', description: '', priority: 'medium' as const });
  const [newBugReport, setNewBugReport] = useState({ title: '', description: '', severity: 'medium' as const });
  const [newFeatureRequest, setNewFeatureRequest] = useState({ title: '', description: '' });
  const [showNewForm, setShowNewForm] = useState<'ticket' | 'bug' | 'feature' | null>(null);

  const handleSubmitTicket = () => {
    if (newTicket.subject.trim() && newTicket.description.trim()) {
      const ticket: SupportTicket = {
        id: `ticket-${Date.now()}`,
        subject: newTicket.subject,
        description: newTicket.description,
        status: 'open' as const,
        priority: newTicket.priority,
        createdAt: new Date(),
        updatedAt: new Date(),
        responses: [],
        messages: [
          {
            sender: 'user',
            content: newTicket.description,
            timestamp: new Date()
          }
        ]
      };

      const updatedSettings = {
        ...settings,
        supportTickets: [ticket, ...settings.supportTickets]
      };

      onSettingsChange(updatedSettings);
      setNewTicket({ subject: '', description: '', priority: 'medium' as const });
      setShowNewForm(null);
      alert('Support ticket submitted successfully! We\'ll respond within 24 hours.');
    }
  };

  const handleSubmitBugReport = () => {
    if (newBugReport.title.trim() && newBugReport.description.trim()) {
      const bugReport: BugReport = {
        id: `bug-${Date.now()}`,
        title: newBugReport.title,
        description: newBugReport.description,
        status: 'open' as const,
        severity: newBugReport.severity,
        createdAt: new Date(),
        updatedAt: new Date(),
        steps: [],
        screenshots: []
      };

      const updatedSettings = {
        ...settings,
        bugReports: [bugReport, ...settings.bugReports]
      };

      onSettingsChange(updatedSettings);
      setNewBugReport({ title: '', description: '', severity: 'medium' as const });
      setShowNewForm(null);
      alert('Bug report submitted successfully! Thank you for helping us improve Fund Flow AI.');
    }
  };

  const handleSubmitFeatureRequest = () => {
    if (newFeatureRequest.title.trim() && newFeatureRequest.description.trim()) {
      const featureRequest: FeatureRequest = {
        id: `feature-${Date.now()}`,
        title: newFeatureRequest.title,
        description: newFeatureRequest.description,
        status: 'open' as const,
        votes: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: 'new_feature'
      };

      const updatedSettings = {
        ...settings,
        featureRequests: [featureRequest, ...settings.featureRequests]
      };

      onSettingsChange(updatedSettings);
      setNewFeatureRequest({ title: '', description: '' });
      setShowNewForm(null);
      alert('Feature request submitted! You can track its status in the Feature Requests section.');
    }
  };

  const handleVoteOnFeature = (featureId: string) => {
    const updatedSettings = {
      ...settings,
      featureRequests: settings.featureRequests.map(req =>
        req.id === featureId ? { ...req, votes: req.votes + 1 } : req
      )
    };

    onSettingsChange(updatedSettings);
  };

  const filteredTutorials = tutorials.filter(tutorial =>
    tutorial.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tutorial.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-blue-600 bg-blue-100';
      case 'in_progress': return 'text-orange-600 bg-orange-100';
      case 'under_review': return 'text-yellow-600 bg-yellow-100';
      case 'planned': return 'text-purple-600 bg-purple-100';
      case 'implemented': return 'text-green-600 bg-green-100';
      case 'resolved': return 'text-green-600 bg-green-100';
      case 'closed': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="bg-white p-6">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-[#1b263b] mb-2 flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-[#150578]" />
          Help & Support
        </h2>
        <p className="text-sm text-[#778da9]">
          Get help, learn new skills, and connect with our support team
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-8">
        <div className="flex border-b border-gray-200">
          {['tutorials', 'knowledge-base', 'support', 'tickets'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'text-[#150578] border-[#150578]'
                  : 'text-[#778da9] border-transparent hover:text-[#150578] hover:border-gray-200'
              }`}
            >
              {tab === 'tutorials' && '📚 Tutorials'}
              {tab === 'knowledge-base' && '📖 Knowledge Base'}
              {tab === 'support' && '💬 Live Support'}
              {tab === 'tickets' && '🎫 My Tickets'}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'tutorials' && (
        <div>
          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#778da9] w-5 h-5" />
            <input
              type="text"
              placeholder="Search tutorials..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
            />
          </div>

          {/* Tutorials Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTutorials.map((tutorial) => (
              <div key={tutorial.id} className="bg-gray-50 p-6 rounded-lg border border-gray-200 hover:border-[#150578] transition-colors cursor-pointer">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      tutorial.progress === 100 ? 'bg-green-500' : 'bg-blue-500'
                    }`}>
                      <span className="text-white font-bold">{tutorial.progress}%</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#1b263b]">{tutorial.title}</h3>
                      <p className="text-sm text-[#778da9]">{tutorial.duration} • {tutorial.description}</p>
                    </div>
                  </div>
                  {tutorial.videoUrl && (
                    <button className="p-2 bg-[#150578] text-white rounded-lg hover:bg-[#0d0342] transition-colors">
                      <BookOpen className="w-4 h-4" />
                      Watch Video
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'support' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live Chat */}
          <div className="bg-green-50 p-6 rounded-lg border border-green-200">
            <h3 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
              <MessageCircle className="w-6 h-6" />
              Live Chat Support
            </h3>
            <p className="text-sm text-green-700 mb-4">
              Chat with our support team in real-time for immediate assistance.
            </p>
            <button className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              Start Live Chat
            </button>
          </div>

          {/* Email Support */}
          <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
            <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
              <Send className="w-6 h-6" />
              Email Support
            </h3>
            <p className="text-sm text-blue-700 mb-4">
              Send us an email and we&apos;ll respond within 24 hours.
            </p>
            <a href="mailto:support@fundflow.com" className="block">
              <button className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                Send Email
              </button>
            </a>
          </div>

          {/* Phone Support */}
          <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
            <h3 className="text-lg font-semibold text-purple-800 mb-4">Phone Support</h3>
            <p className="text-sm text-purple-700 mb-2">
              Mon-Fri: 9 AM - 6 PM EST
            </p>
            <p className="text-sm text-purple-700 mb-4">
              +1 (800) 123-4567
            </p>
            <p className="text-sm text-purple-700">
              Available for Premium and Enterprise customers
            </p>
          </div>
        </div>
      )}

      {activeTab === 'tickets' && (
        <div className="space-y-6">
          {/* Action Buttons */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setShowNewForm('ticket')}
              className="flex-1 px-4 py-2 bg-[#150578] text-white rounded-lg hover:bg-[#0d0342] transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Support Ticket
            </button>
            <button
              onClick={() => setShowNewForm('bug')}
              className="flex-1 px-4 py-2 border border-gray-300 text-[#150578] rounded-lg hover:bg-gray-50 transition-colors"
            >
              <AlertTriangle className="w-4 h-4" />
              Report Bug
            </button>
            <button
              onClick={() => setShowNewForm('feature')}
              className="flex-1 px-4 py-2 border border-gray-300 text-[#150578] rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Request Feature
            </button>
          </div>

          {/* New Form Modal */}
          {showNewForm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-[#1b263b]">
                    {showNewForm === 'ticket' && 'Submit Support Ticket'}
                    {showNewForm === 'bug' && 'Report Bug'}
                    {showNewForm === 'feature' && 'Request New Feature'}
                  </h3>
                  <button
                    onClick={() => setShowNewForm(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>

                {showNewForm === 'ticket' && (
                  <>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[#1b263b] mb-2">Subject</label>
                        <input
                          type="text"
                          value={newTicket.subject}
                          onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                          placeholder="Brief description of your issue"
                          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#1b263b] mb-2">Description</label>
                        <textarea
                          value={newTicket.description}
                          onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                          placeholder="Detailed description of your issue"
                          rows={4}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#1b263b] mb-2">Priority</label>
                        <select
                          value={newTicket.priority}
                          onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value as any })}
                          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={() => setShowNewForm(null)}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSubmitTicket}
                        className="flex-1 px-4 py-2 bg-[#150578] text-white rounded-lg hover:bg-[#0d0342] transition-colors"
                      >
                        Submit Ticket
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Support Tickets List */}
          {settings.supportTickets.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold text-[#1b263b] mb-2">No Support Tickets</h3>
              <p className="text-sm text-[#778da9] mb-4">
                You haven&apos;t submitted any support tickets yet.
              </p>
              <button
                onClick={() => setShowNewForm('ticket')}
                className="px-6 py-2 bg-[#150578] text-white rounded-lg hover:bg-[#0d0342] transition-colors"
              >
                Create First Ticket
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {settings.supportTickets.map((ticket) => (
                <div key={ticket.id} className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-[#1b263b]">{ticket.subject}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority.toUpperCase()}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(ticket.status)}`}>
                          {ticket.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="text-sm text-[#778da9]">
                      {ticket.createdAt.toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-sm text-[#778da9]">
                    Status: {ticket.status.replace('_', ' ')}
                  </div>
                  {ticket.lastResponse && (
                    <div className="text-sm text-[#778da9]">
                      Last response: {ticket.lastResponse.toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}