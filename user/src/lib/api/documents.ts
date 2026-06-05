import { apiFetch } from './client';

export async function listDocuments(): Promise<any[]> {
  return apiFetch<any[]>('/v1/documents');
}

export async function getDocumentStats(): Promise<any> {
  return apiFetch<any>('/v1/documents/stats');
}
