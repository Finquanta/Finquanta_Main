export interface BusinessPlanSection {
  id: string;
  type: string;
  title: string;
  content: string;
  isCompleted: boolean;
  wordCount: number;
  lastModified: string;
  templateContent?: string;
  guidance?: string[];
}

export interface BusinessPlan {
  id: string;
  title: string;
  template: string;
  status: string;
  createdDate: string;
  modifiedDate: string;
  author: string;
  description: string;
  sections: BusinessPlanSection[];
  progress: number;
  shareStatus: 'private' | 'shared' | 'public';
  sharedWith?: string[];
  targetAudience: string;
  industry: string;
  tags: string[];
}

export interface BusinessPlanStats {
  totalPlans: number;
  completedPlans: number;
  inProgressPlans: number;
  averageProgress: number;
  recentActivity: number;
  sharedPlans: number;
}
