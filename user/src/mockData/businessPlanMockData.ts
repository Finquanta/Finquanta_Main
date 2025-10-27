// Mock data for business planning system

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

// Business plan section types
export enum BusinessPlanSection {
  EXECUTIVE_SUMMARY = 'Executive Summary',
  COMPANY_DESCRIPTION = 'Company Description',
  MARKET_ANALYSIS = 'Market Analysis',
  ORGANIZATION_MANAGEMENT = 'Organization & Management',
  PRODUCTS_SERVICES = 'Products & Services',
  MARKETING_SALES = 'Marketing & Sales Strategy',
  FINANCIAL_PROJECTIONS = 'Financial Projections',
  APPENDIX = 'Appendix'
}

export enum PlanStatus {
  DRAFT = 'Draft',
  IN_PROGRESS = 'In Progress',
  REVIEW = 'Under Review',
  COMPLETED = 'Completed',
  PUBLISHED = 'Published'
}

export enum PlanTemplate {
  STARTUP = 'Startup Business Plan',
  ESTABLISHED = 'Established Business Plan',
  NONPROFIT = 'Nonprofit Business Plan',
  RESTAURANT = 'Restaurant Business Plan',
  TECH = 'Tech Startup Plan',
  RETAIL = 'Retail Business Plan'
}

// Type definitions
export interface BusinessPlan {
  id: string;
  title: string;
  template: PlanTemplate;
  status: PlanStatus;
  createdDate: Date;
  modifiedDate: Date;
  author: string;
  description: string;
  sections: PlanSection[];
  progress: number;
  shareStatus: 'private' | 'shared' | 'public';
  sharedWith?: string[];
  targetAudience: string;
  industry: string;
  tags: string[];
}

export interface PlanSection {
  id: string;
  type: BusinessPlanSection;
  title: string;
  content: string;
  isCompleted: boolean;
  wordCount: number;
  lastModified: Date;
  templateContent?: string;
  guidance?: string[];
}

export interface FinancialProjection {
  year: number;
  revenue: number;
  expenses: number;
  profit: number;
  profitMargin: number;
  growthRate: number;
  employees: number;
  customerCount: number;
}

export interface MarketData {
  marketSize: number;
  growthRate: number;
  competitionLevel: 'low' | 'medium' | 'high';
  targetDemographic: string;
  keySegments: string[];
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  targetDate: Date;
  isCompleted: boolean;
  category: 'product' | 'marketing' | 'financial' | 'operational';
}

export interface BusinessPlanStats {
  totalPlans: number;
  completedPlans: number;
  inProgressPlans: number;
  averageProgress: number;
  recentActivity: number;
  sharedPlans: number;
}

export interface BusinessPlanPageProps {
  plans: BusinessPlan[];
  currentPlan?: BusinessPlan;
  stats: BusinessPlanStats;
  templates: PlanTemplate[];
  marketData: MarketData;
  financialProjections: FinancialProjection[];
  milestones: Milestone[];
}

// Template content for each section
export const sectionTemplates: Record<BusinessPlanSection, { content: string; guidance: string[] }> = {
  [BusinessPlanSection.EXECUTIVE_SUMMARY]: {
    content: "Your executive summary should provide a compelling overview of your business plan, highlighting the key points that will interest investors and stakeholders.",
    guidance: [
      "Start with a mission statement that clearly defines your business purpose",
      "Briefly describe your business concept and unique value proposition",
      "Highlight key market opportunities and target customers",
      "Summarize your financial projections and funding requirements",
      "Introduce your management team and their expertise",
      "Keep it concise - ideally 1-2 pages maximum"
    ]
  },
  [BusinessPlanSection.COMPANY_DESCRIPTION]: {
    content: "Describe your company in detail, including its history, structure, and what makes it unique in the marketplace.",
    guidance: [
      "Provide company background and history",
      "Describe your business structure (sole proprietorship, partnership, LLC, etc.)",
      "Explain your mission and vision statements",
      "Detail your products or services and what makes them unique",
      "Describe your location, facilities, and equipment needs",
      "Include any patents, trademarks, or proprietary technology"
    ]
  },
  [BusinessPlanSection.MARKET_ANALYSIS]: {
    content: "Analyze your target market, competition, and industry trends to demonstrate market opportunity.",
    guidance: [
      "Define your target market and customer demographics",
      "Estimate market size and growth potential",
      "Analyze your competition and their strengths/weaknesses",
      "Identify market trends and opportunities",
      "Describe your competitive advantages",
      "Include industry statistics and market research data"
    ]
  },
  [BusinessPlanSection.ORGANIZATION_MANAGEMENT]: {
    content: "Outline your organizational structure, management team, and personnel needs.",
    guidance: [
      "Create an organizational chart showing reporting structure",
      "Provide detailed profiles of key management team members",
      "Describe roles and responsibilities for key positions",
      "Identify current staffing needs and future hiring plans",
      "Include advisors, board members, or key consultants",
      "Highlight relevant experience and qualifications"
    ]
  },
  [BusinessPlanSection.PRODUCTS_SERVICES]: {
    content: "Detail your products or services, including features, benefits, and how they meet customer needs.",
    guidance: [
      "Describe each product or service in detail",
      "Explain unique features and competitive advantages",
      "Highlight benefits and value proposition for customers",
      "Discuss product lifecycle and development roadmap",
      "Include pricing strategy and revenue model",
      "Mention any patents, copyrights, or proprietary technology"
    ]
  },
  [BusinessPlanSection.MARKETING_SALES]: {
    content: "Explain how you will reach your target market and convert prospects into customers.",
    guidance: [
      "Define your marketing strategy and channels",
      "Describe your sales approach and process",
      "Outline your pricing and promotional strategies",
      "Include branding and positioning strategy",
      "Detail customer acquisition and retention plans",
      "Set measurable marketing goals and KPIs"
    ]
  },
  [BusinessPlanSection.FINANCIAL_PROJECTIONS]: {
    content: "Provide detailed financial forecasts and analysis to demonstrate business viability.",
    guidance: [
      "Include 3-5 year financial projections",
      "Provide monthly breakdowns for the first year",
      "Include profit and loss statements",
      "Create cash flow projections",
      "Develop balance sheet projections",
      "Calculate break-even analysis",
      "Explain assumptions behind your projections"
    ]
  },
  [BusinessPlanSection.APPENDIX]: {
    content: "Include supporting documents and additional information that adds credibility to your business plan.",
    guidance: [
      "Include resumes of key management team members",
      "Add product photos, marketing materials, and mockups",
      "Provide market research data and surveys",
      "Include licenses, permits, and legal documents",
      "Add letters of intent or support from potential customers",
      "Include detailed financial calculations and assumptions"
    ]
  }
};

// Mock business plans
export const mockBusinessPlans: BusinessPlan[] = [
  {
    id: 'plan-001',
    title: 'Fund Flow AI - 2024 Business Expansion Plan',
    template: PlanTemplate.TECH,
    status: PlanStatus.IN_PROGRESS,
    createdDate: new Date('2024-01-01'),
    modifiedDate: new Date('2024-01-15'),
    author: 'John Mike',
    description: 'Comprehensive business plan for expanding Fund Flow AI into new markets and customer segments.',
    sections: [
      {
        id: 'section-001-1',
        type: BusinessPlanSection.EXECUTIVE_SUMMARY,
        title: 'Executive Summary',
        content: `Fund Flow AI is an innovative financial management platform that uses artificial intelligence to help small and medium-sized businesses optimize their financial operations. Our platform currently serves over 10,000 active users with a 95% customer satisfaction rate.

We are seeking $2 million in Series A funding to expand our AI capabilities, increase market penetration, and scale our operations to serve 100,000 users within the next 24 months.

Key highlights:
• Current ARR: $1.2M with 40% year-over-year growth
• Customer retention rate: 92%
• Market opportunity: $15B addressable market
• Competitive advantage: Proprietary AI algorithms and user-friendly interface

The investment will primarily be used for product development (45%), marketing and sales (30%), operational expansion (20%), and working capital (5%).`,
        isCompleted: true,
        wordCount: 1250,
        lastModified: new Date('2024-01-10'),
        templateContent: sectionTemplates[BusinessPlanSection.EXECUTIVE_SUMMARY].content,
        guidance: sectionTemplates[BusinessPlanSection.EXECUTIVE_SUMMARY].guidance
      },
      {
        id: 'section-001-2',
        type: BusinessPlanSection.COMPANY_DESCRIPTION,
        title: 'Company Description',
        content: `Fund Flow AI was founded in 2022 with the mission to democratize financial management for businesses of all sizes. Our company is structured as a Delaware C-Corporation with 15 full-time employees and headquarters in San Francisco, California.

Our platform combines cutting-edge artificial intelligence with intuitive user experience to provide:
- Real-time financial analytics and insights
- Automated bookkeeping and expense tracking
- Business planning and forecasting tools
- Document management and compliance features

What sets us apart is our proprietary AI engine that analyzes financial patterns and provides actionable recommendations, helping businesses make better financial decisions and improve profitability by an average of 23%.`,
        isCompleted: true,
        wordCount: 980,
        lastModified: new Date('2024-01-08'),
        templateContent: sectionTemplates[BusinessPlanSection.COMPANY_DESCRIPTION].content,
        guidance: sectionTemplates[BusinessPlanSection.COMPANY_DESCRIPTION].guidance
      },
      {
        id: 'section-001-3',
        type: BusinessPlanSection.MARKET_ANALYSIS,
        title: 'Market Analysis',
        content: `The global financial software market is valued at $15 billion and is projected to grow at a CAGR of 12% through 2028. Our target segment includes small to medium-sized businesses (SMBs) with annual revenues between $100K and $10M.

Market trends favoring our growth:
• Increasing adoption of AI-powered business tools
• Growing need for real-time financial insights
• Rising regulatory compliance requirements
• Shift from traditional accounting software to integrated platforms

Competition includes established players like QuickBooks, Xero, and emerging fintech startups. Our competitive advantages include superior AI capabilities, more intuitive user experience, and competitive pricing.`,
        isCompleted: false,
        wordCount: 650,
        lastModified: new Date('2024-01-12'),
        templateContent: sectionTemplates[BusinessPlanSection.MARKET_ANALYSIS].content,
        guidance: sectionTemplates[BusinessPlanSection.MARKET_ANALYSIS].guidance
      }
    ],
    progress: 65,
    shareStatus: 'shared',
    sharedWith: ['investors@fundflow.com', 'board@fundflow.com'],
    targetAudience: 'Small to medium-sized businesses seeking AI-powered financial management',
    industry: 'FinTech',
    tags: ['fintech', 'AI', 'SMB', 'expansion', 'Series A']
  },
  {
    id: 'plan-002',
    title: 'New Product Launch - Mobile App',
    template: PlanTemplate.TECH,
    status: PlanStatus.DRAFT,
    createdDate: new Date('2023-12-15'),
    modifiedDate: new Date('2024-01-05'),
    author: 'John Mike',
    description: 'Business plan for launching a mobile companion app for Fund Flow AI platform.',
    sections: [
      {
        id: 'section-002-1',
        type: BusinessPlanSection.EXECUTIVE_SUMMARY,
        title: 'Executive Summary',
        content: 'This business plan outlines the development and launch of a mobile companion application for the Fund Flow AI platform. The mobile app will provide on-the-go financial management capabilities and push notifications for critical financial events.',
        isCompleted: false,
        wordCount: 200,
        lastModified: new Date('2023-12-20'),
        templateContent: sectionTemplates[BusinessPlanSection.EXECUTIVE_SUMMARY].content,
        guidance: sectionTemplates[BusinessPlanSection.EXECUTIVE_SUMMARY].guidance
      }
    ],
    progress: 25,
    shareStatus: 'private',
    targetAudience: 'Existing Fund Flow AI users and mobile-first small business owners',
    industry: 'FinTech',
    tags: ['mobile', 'app', 'product launch']
  }
];

// Mock financial projections
export const mockFinancialProjections: FinancialProjection[] = [
  {
    year: 2024,
    revenue: 2500000,
    expenses: 1800000,
    profit: 700000,
    profitMargin: 28.0,
    growthRate: 108.0,
    employees: 25,
    customerCount: 25000
  },
  {
    year: 2025,
    revenue: 5500000,
    expenses: 3850000,
    profit: 1650000,
    profitMargin: 30.0,
    growthRate: 120.0,
    employees: 45,
    customerCount: 55000
  },
  {
    year: 2026,
    revenue: 12000000,
    expenses: 7800000,
    profit: 4200000,
    profitMargin: 35.0,
    growthRate: 118.0,
    employees: 80,
    customerCount: 100000
  }
];

// Mock milestones
export const mockMilestones: Milestone[] = [
  {
    id: 'milestone-001',
    title: 'Series A Funding Close',
    description: 'Secure $2M in Series A funding from institutional investors',
    targetDate: new Date('2024-03-31'),
    isCompleted: false,
    category: 'financial'
  },
  {
    id: 'milestone-002',
    title: 'Mobile App Launch',
    description: 'Launch iOS and Android companion apps',
    targetDate: new Date('2024-06-30'),
    isCompleted: false,
    category: 'product'
  },
  {
    id: 'milestone-003',
    title: 'Customer Milestone: 25K Users',
    description: 'Reach 25,000 active customers',
    targetDate: new Date('2024-04-30'),
    isCompleted: false,
    category: 'marketing'
  },
  {
    id: 'milestone-004',
    title: 'AI Enhancement Launch',
    description: 'Release advanced AI prediction capabilities',
    targetDate: new Date('2024-05-15'),
    isCompleted: false,
    category: 'product'
  }
];

// Mock market data
export const mockMarketData: MarketData = {
  marketSize: 15000000000, // $15 billion
  growthRate: 12.0,
  competitionLevel: 'high',
  targetDemographic: 'Small to medium-sized businesses (10-500 employees)',
  keySegments: [
    'Professional services',
    'Retail and e-commerce',
    'Manufacturing',
    'Healthcare',
    'Construction'
  ]
};

// Mock statistics
export const mockBusinessPlanStats: BusinessPlanStats = {
  totalPlans: mockBusinessPlans.length,
  completedPlans: mockBusinessPlans.filter(plan => plan.status === PlanStatus.COMPLETED).length,
  inProgressPlans: mockBusinessPlans.filter(plan => plan.status === PlanStatus.IN_PROGRESS).length,
  averageProgress: mockBusinessPlans.reduce((sum, plan) => sum + plan.progress, 0) / mockBusinessPlans.length,
  recentActivity: 5, // Number of plans modified in last 7 days
  sharedPlans: mockBusinessPlans.filter(plan => plan.shareStatus === 'shared').length
};

// Data passed as props to root component
export const mockBusinessPlanPageProps: BusinessPlanPageProps = {
  plans: mockBusinessPlans,
  stats: mockBusinessPlanStats,
  templates: Object.values(PlanTemplate),
  marketData: mockMarketData,
  financialProjections: mockFinancialProjections,
  milestones: mockMilestones
};