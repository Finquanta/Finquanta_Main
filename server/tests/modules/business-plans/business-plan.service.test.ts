import { BusinessPlanService } from '../../../src/modules/business-plans/business-plan.service';

describe('BusinessPlanService', () => {
  it('duplicates a plan as a draft copy', async () => {
    const repository = {
      findById: jest.fn().mockResolvedValue({
        id: 'plan-1',
        title: 'Expansion Plan',
        sections: [{ title: 'Executive Summary' }]
      }),
      duplicate: jest.fn().mockResolvedValue({
        id: 'plan-2',
        title: 'Expansion Plan (Copy)',
        status: 'Draft'
      })
    };

    const service = new BusinessPlanService(repository as any);
    const result = await service.duplicate('user-1', 'plan-1');

    expect(result.title).toBe('Expansion Plan (Copy)');
    expect(result.status).toBe('Draft');
  });
});
