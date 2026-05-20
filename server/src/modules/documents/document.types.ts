export interface DocumentRecord {
  id: string;
  name?: string;
  type: string;
  category: string;
  fileType?: string;
  size: number;
  uploadDate: Date | string;
  modifiedDate?: Date | string;
  author?: string;
  tags?: string[];
  shareStatus: string;
  sharedWith?: string[];
  starred: boolean;
  folderPath?: string[];
  url?: string;
  thumbnailUrl?: string;
}

export interface DocumentStats {
  totalDocuments: number;
  totalSize: number;
  documentsByType: Record<string, number>;
  documentsByCategory: Record<string, number>;
  recentUploads: number;
  starredDocuments: number;
  sharedDocuments: number;
}
