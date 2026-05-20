import { DocumentService } from '../../../src/modules/documents/document.service';

describe('DocumentService', () => {
  it('calculates document stats from document rows', async () => {
    const repository = {
      listDocuments: jest.fn().mockResolvedValue([
        { id: 'doc-1', type: 'Report', category: 'Financial', size: 1024, starred: true, shareStatus: 'Private', uploadDate: new Date() },
        { id: 'doc-2', type: 'Contract', category: 'Legal', size: 2048, starred: false, shareStatus: 'Shared', uploadDate: new Date() }
      ])
    };

    const service = new DocumentService(repository as any);
    const stats = await service.getStats('user-1');

    expect(stats.totalDocuments).toBe(2);
    expect(stats.totalSize).toBe(3072);
    expect(stats.starredDocuments).toBe(1);
    expect(stats.sharedDocuments).toBe(1);
  });
});
