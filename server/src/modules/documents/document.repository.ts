import { Database } from '../../infrastructure/database';
import { DocumentRecord } from './document.types';

export class DocumentRepository {
  constructor(private database: Database) {}

  async listDocuments(userId: string, filters: Record<string, any> = {}): Promise<DocumentRecord[]> {
    const clauses = ['d.user_id = $1'];
    const params: any[] = [userId];
    let index = 2;

    if (filters.folderId) {
      clauses.push(`d.folder_id = $${index++}`);
      params.push(filters.folderId);
    }
    if (filters.category) {
      clauses.push(`d.category = $${index++}`);
      params.push(filters.category);
    }
    if (filters.type) {
      clauses.push(`d.document_type = $${index++}`);
      params.push(filters.type);
    }
    if (filters.search) {
      clauses.push(`d.name ILIKE $${index++}`);
      params.push(`%${filters.search}%`);
    }

    const result = await this.database.query(
      `SELECT d.*, f.name as folder_name
       FROM documents d
       LEFT JOIN document_folders f ON f.id = d.folder_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY d.modified_at DESC`,
      params
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      type: row.document_type,
      category: row.category,
      fileType: row.file_type,
      size: Number(row.size_bytes),
      uploadDate: row.uploaded_at,
      modifiedDate: row.modified_at,
      author: row.author,
      tags: row.tags ?? [],
      shareStatus: this.capitalize(row.share_status),
      sharedWith: row.shared_with ?? [],
      starred: row.starred,
      folderPath: row.folder_name ? [row.folder_name] : [],
      url: row.public_url,
      thumbnailUrl: row.thumbnail_url
    }));
  }

  private capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}
