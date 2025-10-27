'use client';

import React, { useState } from 'react';
import MainLayout from '@/components/MainLayout';
import InboxMetrics from './components/InboxMetrics';
import { DataTable, QuickActions } from '@/components/widgets';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InboxMetrics as InboxMetricsType, Message } from './types';
import { Search, Filter, Archive, Trash2, Reply, Forward, Star } from 'lucide-react';

// Mock data
const mockMetrics: InboxMetricsType = {
  unreadMessages: 12,
  responseRate: 87,
  avgResponseTime: 2.4,
  messageVolume: 156,
  volumeTrend: -8,
  responseTrend: 5
};

const mockMessages: Message[] = [
  {
    id: '1',
    sender: 'John Doe',
    senderEmail: 'john@example.com',
    subject: 'Project Update - Q2 Goals',
    preview: 'Hi team, I wanted to share our progress on the Q2 goals...',
    content: 'Hi team, I wanted to share our progress on the Q2 goals. We\'ve made significant strides in user acquisition and are on track to meet our targets.',
    timestamp: new Date().toISOString(),
    isRead: false,
    isImportant: true,
    category: 'inbox',
    hasAttachments: true,
    threadId: 'thread1'
  },
  {
    id: '2',
    sender: 'Jane Smith',
    senderEmail: 'jane@example.com',
    subject: 'Meeting Notes - Product Review',
    preview: 'Thanks for joining the product review meeting today...',
    content: 'Thanks for joining the product review meeting today. Here are the key action items we discussed...',
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    isRead: true,
    isImportant: false,
    category: 'inbox',
    hasAttachments: false,
    threadId: 'thread2'
  }
];

export default function InboxPage() {
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const messageColumns = [
    {
      key: 'sender',
      label: 'Sender',
      sortable: true,
      render: (value: string, row: Message) => (
        <div className="flex items-center">
          {!row.isRead && <div className="w-2 h-2 bg-blue-500 rounded-full mr-2" />}
          {row.isImportant && <Star className="w-4 h-4 text-yellow-500 mr-2" />}
          <span className={row.isRead ? 'font-normal' : 'font-semibold'}>
            {value}
          </span>
        </div>
      )
    },
    {
      key: 'subject',
      label: 'Subject',
      render: (value: string, row: Message) => (
        <span className={row.isRead ? 'font-normal' : 'font-semibold'}>
          {value}
        </span>
      )
    },
    {
      key: 'preview',
      label: 'Preview'
    },
    {
      key: 'timestamp',
      label: 'Time',
      render: (value: string) => {
        const date = new Date(value);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = Math.floor(diff / 3600000);

        if (hours < 1) return 'Just now';
        if (hours < 24) return `${hours}h ago`;
        return date.toLocaleDateString();
      }
    },
    {
      key: 'hasAttachments',
      label: '',
      render: (value: boolean) => value && '📎'
    }
  ];

  const quickActions = [
    {
      id: 'compose',
      label: 'Compose',
      action: () => console.log('Compose message'),
      icon: <Reply className="w-4 h-4 mr-2" />
    },
    {
      id: 'archive',
      label: 'Archive Selected',
      action: () => console.log('Archive messages'),
      icon: <Archive className="w-4 h-4 mr-2" />
    },
    {
      id: 'delete',
      label: 'Delete Selected',
      action: () => console.log('Delete messages'),
      icon: <Trash2 className="w-4 h-4 mr-2" />
    }
  ];

  const filteredMessages = mockMessages.filter(message => {
    const matchesSearch = message.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         message.sender.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         message.preview.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'all' || message.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <MainLayout>
      <div className="p-6 bg-gray-50 min-h-screen">
        <h1 className="text-2xl font-bold mb-6">Inbox</h1>

        <InboxMetrics metrics={mockMetrics} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Categories and Filters */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold mb-4">Categories</h3>
              <div className="space-y-2">
                {[
                  { id: 'all', label: 'All Messages', count: mockMessages.length },
                  { id: 'inbox', label: 'Inbox', count: mockMessages.filter(m => m.category === 'inbox').length },
                  { id: 'unread', label: 'Unread', count: mockMessages.filter(m => !m.isRead).length },
                  { id: 'important', label: 'Important', count: mockMessages.filter(m => m.isImportant).length }
                ].map(category => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                      selectedCategory === category.id
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span>{category.label}</span>
                      <Badge variant="secondary" className="text-xs">
                        {category.count}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Message List */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-lg shadow-sm">
              {/* Search and Actions Bar */}
              <div className="p-4 border-b flex items-center space-x-4">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search messages..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4 mr-2" />
                  Filter
                </Button>
              </div>

              <DataTable
                columns={messageColumns}
                data={filteredMessages}
                bulkActions={[
                  {
                    label: 'Archive',
                    action: (selected: string[]) => console.log('Archive:', selected)
                  },
                  {
                    label: 'Delete',
                    action: (selected: string[]) => console.log('Delete:', selected)
                  },
                  {
                    label: 'Mark Read',
                    action: (selected: string[]) => console.log('Mark read:', selected)
                  }
                ]}
              />
            </div>
          </div>

          {/* Message Detail */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm p-4">
              {selectedMessage ? (
                <div>
                  <div className="border-b pb-4 mb-4">
                    <h3 className="font-semibold text-lg mb-2">{selectedMessage.subject}</h3>
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>From: {selectedMessage.sender}</span>
                      <span>{new Date(selectedMessage.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="mb-4">
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedMessage.content}</p>
                  </div>
                  {selectedMessage.hasAttachments && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-md">
                      <p className="text-sm font-medium mb-2">Attachments</p>
                      <div className="text-sm text-blue-600">📎 document.pdf</div>
                    </div>
                  )}
                  <div className="flex space-x-2">
                    <Button size="sm">
                      <Reply className="w-4 h-4 mr-2" />
                      Reply
                    </Button>
                    <Button size="sm" variant="outline">
                      <Forward className="w-4 h-4 mr-2" />
                      Forward
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <p>Select a message to view details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
