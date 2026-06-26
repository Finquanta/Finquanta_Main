import { Database } from '../../infrastructure/database';

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImageUrl: string | null;
  published: boolean;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'post';
}

export class BlogRepository {
  constructor(private database: Database) {}

  /** Create the blog_posts table. Idempotent. */
  async ensureSchema(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS blog_posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        excerpt TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        cover_image_url TEXT,
        published BOOLEAN NOT NULL DEFAULT false,
        author_name TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  }

  private map(r: any): BlogPost {
    return {
      id: r.id,
      title: r.title,
      slug: r.slug,
      excerpt: r.excerpt ?? '',
      content: r.content ?? '',
      coverImageUrl: r.cover_image_url ?? null,
      published: r.published,
      authorName: r.author_name ?? null,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    };
  }

  async listPublished(): Promise<BlogPost[]> {
    const res = await this.database.query(`SELECT * FROM blog_posts WHERE published = true ORDER BY created_at DESC`);
    return res.rows.map((r: any) => this.map(r));
  }

  async listAll(): Promise<BlogPost[]> {
    const res = await this.database.query(`SELECT * FROM blog_posts ORDER BY created_at DESC`);
    return res.rows.map((r: any) => this.map(r));
  }

  async getBySlug(slug: string): Promise<BlogPost | null> {
    const res = await this.database.query(`SELECT * FROM blog_posts WHERE slug = $1`, [slug]);
    return res.rows[0] ? this.map(res.rows[0]) : null;
  }

  async getById(id: string): Promise<BlogPost | null> {
    const res = await this.database.query(`SELECT * FROM blog_posts WHERE id = $1`, [id]);
    return res.rows[0] ? this.map(res.rows[0]) : null;
  }

  /** A slug unique across posts (appends -2, -3, … on collision). */
  private async uniqueSlug(base: string, excludeId?: string): Promise<string> {
    const root = slugify(base);
    let candidate = root;
    let n = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const res = excludeId
        ? await this.database.query(`SELECT 1 FROM blog_posts WHERE slug = $1 AND id <> $2`, [candidate, excludeId])
        : await this.database.query(`SELECT 1 FROM blog_posts WHERE slug = $1`, [candidate]);
      if (res.rows.length === 0) return candidate;
      n++;
      candidate = `${root}-${n}`;
    }
  }

  async create(data: { title: string; excerpt?: string; content?: string; coverImageUrl?: string | null; published?: boolean; authorName?: string | null }): Promise<BlogPost> {
    const slug = await this.uniqueSlug(data.title);
    const res = await this.database.query(
      `INSERT INTO blog_posts (title, slug, excerpt, content, cover_image_url, published, author_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [data.title, slug, data.excerpt ?? '', data.content ?? '', data.coverImageUrl ?? null, data.published ?? false, data.authorName ?? null]
    );
    return this.map(res.rows[0]);
  }

  async update(id: string, data: { title?: string; excerpt?: string; content?: string; coverImageUrl?: string | null; published?: boolean }): Promise<BlogPost | null> {
    const set: string[] = [];
    const vals: any[] = [];
    let i = 1;
    if (data.title !== undefined) {
      set.push(`title = $${i++}`); vals.push(data.title);
      set.push(`slug = $${i++}`); vals.push(await this.uniqueSlug(data.title, id));
    }
    if (data.excerpt !== undefined) { set.push(`excerpt = $${i++}`); vals.push(data.excerpt); }
    if (data.content !== undefined) { set.push(`content = $${i++}`); vals.push(data.content); }
    if (data.coverImageUrl !== undefined) { set.push(`cover_image_url = $${i++}`); vals.push(data.coverImageUrl); }
    if (data.published !== undefined) { set.push(`published = $${i++}`); vals.push(data.published); }
    if (set.length === 0) return this.getById(id);
    set.push(`updated_at = NOW()`);
    vals.push(id);
    const res = await this.database.query(`UPDATE blog_posts SET ${set.join(', ')} WHERE id = $${i} RETURNING *`, vals);
    return res.rows[0] ? this.map(res.rows[0]) : null;
  }

  async remove(id: string): Promise<void> {
    await this.database.query(`DELETE FROM blog_posts WHERE id = $1`, [id]);
  }
}
