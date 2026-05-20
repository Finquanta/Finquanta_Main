import { Database } from '../../infrastructure/database';
import { UserRepository } from '../users/user.repository';
import { BusinessPlan, BusinessPlanSection } from './business-plan.types';

export class BusinessPlanRepository {
  private users: UserRepository;

  constructor(private database: Database) {
    this.users = new UserRepository(database);
  }

  async list(userId: string): Promise<BusinessPlan[]> {
    const plans = await this.database.query(
      `SELECT * FROM business_plans WHERE user_id = $1 ORDER BY updated_at DESC`,
      [userId]
    );
    const sections = await this.database.query(
      `SELECT * FROM business_plan_sections WHERE plan_id = ANY($1::uuid[]) ORDER BY updated_at DESC`,
      [plans.rows.map((row: any) => row.id)]
    );
    const sectionsByPlan = new Map<string, any[]>();
    for (const section of sections.rows) {
      const items = sectionsByPlan.get(section.plan_id) ?? [];
      items.push(section);
      sectionsByPlan.set(section.plan_id, items);
    }

    return Promise.all(plans.rows.map((row: any) => this.mapPlan(row, sectionsByPlan.get(row.id) ?? [])));
  }

  async findById(userId: string, planId: string): Promise<BusinessPlan | null> {
    const plan = await this.database.query('SELECT * FROM business_plans WHERE id = $1 AND user_id = $2', [planId, userId]);
    if (plan.rows.length === 0) {
      return null;
    }
    const sections = await this.database.query('SELECT * FROM business_plan_sections WHERE plan_id = $1', [planId]);
    return this.mapPlan(plan.rows[0], sections.rows);
  }

  async duplicate(userId: string, plan: BusinessPlan): Promise<BusinessPlan> {
    const inserted = await this.database.query(
      `INSERT INTO business_plans (
        user_id, title, template, status, description, progress, share_status,
        shared_with, target_audience, industry, tags, created_at, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW())
      RETURNING *`,
      [
        userId,
        plan.title,
        plan.template,
        'Draft',
        plan.description,
        plan.progress,
        'private',
        [],
        plan.targetAudience,
        plan.industry,
        plan.tags
      ]
    );

    for (const section of plan.sections) {
      await this.database.query(
        `INSERT INTO business_plan_sections (
          plan_id, section_type, title, content, is_completed, word_count, template_content, guidance, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
        [inserted.rows[0].id, section.type, section.title, section.content, false, section.wordCount, section.templateContent ?? null, section.guidance ?? []]
      );
    }

    const created = await this.findById(userId, inserted.rows[0].id);
    if (!created) {
      throw new Error('Business plan duplicate failed');
    }
    return created;
  }

  async getStats(userId: string) {
    const result = await this.database.query(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'Completed') as completed,
        COUNT(*) FILTER (WHERE status = 'In Progress') as in_progress,
        COALESCE(AVG(progress), 0) as average_progress,
        COUNT(*) FILTER (WHERE updated_at >= NOW() - INTERVAL '7 days') as recent_activity,
        COUNT(*) FILTER (WHERE share_status = 'shared') as shared
       FROM business_plans
       WHERE user_id = $1`,
      [userId]
    );
    const row = result.rows[0];
    return {
      totalPlans: Number(row.total),
      completedPlans: Number(row.completed),
      inProgressPlans: Number(row.in_progress),
      averageProgress: Number.parseFloat(row.average_progress),
      recentActivity: Number(row.recent_activity),
      sharedPlans: Number(row.shared)
    };
  }

  private async mapPlan(row: any, sections: any[]): Promise<BusinessPlan> {
    const user = await this.users.findById(row.user_id);
    return {
      id: row.id,
      title: row.title,
      template: row.template,
      status: row.status,
      createdDate: new Date(row.created_at).toISOString(),
      modifiedDate: new Date(row.updated_at).toISOString(),
      author: user ? `${user.firstName} ${user.lastName}` : 'User',
      description: row.description,
      sections: sections.map(section => this.mapSection(section)),
      progress: row.progress,
      shareStatus: row.share_status,
      sharedWith: row.shared_with ?? [],
      targetAudience: row.target_audience,
      industry: row.industry,
      tags: row.tags ?? []
    };
  }

  private mapSection(row: any): BusinessPlanSection {
    return {
      id: row.id,
      type: row.section_type,
      title: row.title,
      content: row.content,
      isCompleted: row.is_completed,
      wordCount: row.word_count,
      lastModified: new Date(row.updated_at).toISOString(),
      templateContent: row.template_content ?? undefined,
      guidance: row.guidance ?? []
    };
  }
}
