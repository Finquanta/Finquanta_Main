export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  status: 'active' | 'inactive' | 'on-leave';
  joinDate: string;
  lastActive: string;
  performanceScore: number;
}

export interface TeamMetrics {
  totalMembers: number;
  activeProjects: number;
  avgProductivity: number;
  upcomingDeadlines: number;
  growthTrend: number;
  productivityTrend: number;
}