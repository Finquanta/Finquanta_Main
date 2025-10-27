export interface SupportTicket {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in-progress' | 'resolved' | 'closed';
  assignee?: string;
  requester: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeArticle {
  id: string;
  title: string;
  category: string;
  views: number;
  lastUpdated: string;
  status: 'published' | 'draft' | 'archived';
}

export interface HelpMetrics {
  openTickets: number;
  avgResolutionTime: number;
  satisfactionScore: number;
  totalArticles: number;
  ticketTrend: number;
  resolutionTrend: number;
  satisfactionTrend: number;
  articleViews: number;
}