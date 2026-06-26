import { apiFetch } from './client';

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

// ---- Public ----
export async function listBlogPosts(): Promise<BlogPost[]> {
  return apiFetch<BlogPost[]>('/v1/blog');
}

export async function getBlogPost(slug: string): Promise<BlogPost> {
  return apiFetch<BlogPost>(`/v1/blog/${slug}`);
}

// ---- Admin ----
export interface BlogInput {
  title: string;
  excerpt?: string;
  content?: string;
  coverImageUrl?: string | null;
  published?: boolean;
}

export async function listAllBlogPosts(): Promise<BlogPost[]> {
  return apiFetch<BlogPost[]>('/v1/admin/blog');
}

export async function createBlogPost(data: BlogInput): Promise<BlogPost> {
  return apiFetch<BlogPost>('/v1/admin/blog', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateBlogPost(id: string, data: Partial<BlogInput>): Promise<BlogPost> {
  return apiFetch<BlogPost>(`/v1/admin/blog/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteBlogPost(id: string): Promise<void> {
  await apiFetch(`/v1/admin/blog/${id}`, { method: 'DELETE' });
}
