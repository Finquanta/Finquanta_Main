// src/app/inbox/types.ts
export interface Message {
  id: string;
  sender: string;
  senderEmail: string;
  subject: string;
  preview: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  isImportant: boolean;
  category: 'inbox' | 'sent' | 'draft' | 'trash';
  hasAttachments: boolean;
  threadId?: string;
}

export interface InboxMetrics {
  unreadMessages: number;
  responseRate: number;
  avgResponseTime: number;
  messageVolume: number;
  volumeTrend: number;
  responseTrend: number;
}