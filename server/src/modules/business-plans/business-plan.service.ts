import { BusinessPlan } from './business-plan.types';

export interface BusinessPlanRepositoryPort {
  findById(userId: string, planId: string): Promise<BusinessPlan | null>;
  duplicate(userId: string, plan: BusinessPlan): Promise<BusinessPlan>;
  list(userId: string): Promise<BusinessPlan[]>;
  getStats(userId: string): Promise<any>;
}

export class BusinessPlanService {
  constructor(private repository: BusinessPlanRepositoryPort) {}

  list(userId: string): Promise<BusinessPlan[]> {
    return this.repository.list(userId);
  }

  getStats(userId: string) {
    return this.repository.getStats(userId);
  }

  async duplicate(userId: string, planId: string): Promise<BusinessPlan> {
    const plan = await this.repository.findById(userId, planId);
    if (!plan) {
      throw new Error('Business plan not found');
    }

    return this.repository.duplicate(userId, {
      ...plan,
      title: `${plan.title} (Copy)`,
      status: 'Draft',
      shareStatus: 'private'
    });
  }

  getTemplates(): string[] {
    return [
      'Startup Business Plan',
      'Established Business Plan',
      'Nonprofit Business Plan',
      'Restaurant Business Plan',
      'Tech Startup Plan',
      'Retail Business Plan'
    ];
  }

  getMarketData() {
    return {
      marketSize: 15000000000,
      growthRate: 12,
      competitionLevel: 'high',
      targetDemographic: 'Small to medium-sized businesses (10-500 employees)',
      keySegments: ['Professional services', 'Retail and e-commerce', 'Manufacturing', 'Healthcare', 'Construction']
    };
  }
}
