import { DocumentRecord, DocumentStats } from './document.types';

export interface DocumentRepositoryPort {
  listDocuments(userId: string, filters?: Record<string, any>): Promise<DocumentRecord[]>;
}

export class DocumentService {
  constructor(private repository: DocumentRepositoryPort) {}

  listDocuments(userId: string, filters: Record<string, any> = {}) {
    return this.repository.listDocuments(userId, filters);
  }

  async getStats(userId: string): Promise<DocumentStats> {
    const documents = await this.repository.listDocuments(userId);
    const now = Date.now();

    return {
      totalDocuments: documents.length,
      totalSize: documents.reduce((sum, document) => sum + document.size, 0),
      documentsByType: this.countBy(documents, document => document.type),
      documentsByCategory: this.countBy(documents, document => document.category),
      recentUploads: documents.filter(document => {
        const uploadedAt = new Date(document.uploadDate).getTime();
        return Number.isFinite(uploadedAt) && now - uploadedAt <= 7 * 24 * 60 * 60 * 1000;
      }).length,
      starredDocuments: documents.filter(document => document.starred).length,
      sharedDocuments: documents.filter(document => document.shareStatus.toLowerCase() !== 'private').length
    };
  }

  private countBy(documents: DocumentRecord[], selector: (document: DocumentRecord) => string): Record<string, number> {
    return documents.reduce<Record<string, number>>((counts, document) => {
      const key = selector(document);
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {});
  }
}
