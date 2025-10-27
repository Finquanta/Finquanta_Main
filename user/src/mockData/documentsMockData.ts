// Mock data for documents management system

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

export const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays} days ago`;
  if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
  if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
  return `${Math.floor(diffInDays / 365)} years ago`;
};

// Document types and categories
export enum DocumentType {
  INVOICE = 'Invoice',
  RECEIPT = 'Receipt',
  CONTRACT = 'Contract',
  REPORT = 'Report',
  TAX_DOCUMENT = 'Tax Document',
  CERTIFICATE = 'Certificate',
  PROPOSAL = 'Proposal',
  PRESENTATION = 'Presentation',
  SPREADSHEET = 'Spreadsheet',
  IMAGE = 'Image',
  OTHER = 'Other'
}

export enum DocumentCategory {
  FINANCIAL = 'Financial',
  LEGAL = 'Legal',
  BUSINESS = 'Business',
  PERSONAL = 'Personal'
}

export enum FileType {
  PDF = 'pdf',
  DOC = 'doc',
  DOCX = 'docx',
  XLS = 'xls',
  XLSX = 'xlsx',
  PPT = 'ppt',
  PPTX = 'pptx',
  PNG = 'png',
  JPG = 'jpg',
  JPEG = 'jpeg',
  GIF = 'gif',
  ZIP = 'zip',
  OTHER = 'other'
}

export enum ShareStatus {
  PRIVATE = 'Private',
  SHARED = 'Shared',
  PUBLIC = 'Public'
}

// Type definitions
export interface Document {
  id: string;
  name: string;
  type: DocumentType;
  category: DocumentCategory;
  fileType: FileType;
  size: number;
  uploadDate: Date;
  modifiedDate: Date;
  author: string;
  tags: string[];
  shareStatus: ShareStatus;
  sharedWith?: string[];
  starred: boolean;
  folderPath: string[];
  url: string;
  thumbnailUrl?: string;
}

export interface DocumentFolder {
  id: string;
  name: string;
  path: string;
  documentCount: number;
  totalSize: number;
  createdDate: Date;
  parentId?: string;
  subfolders?: DocumentFolder[];
}

export interface DocumentStats {
  totalDocuments: number;
  totalSize: number;
  documentsByType: Record<DocumentType, number>;
  documentsByCategory: Record<DocumentCategory, number>;
  recentUploads: number;
  starredDocuments: number;
  sharedDocuments: number;
}

export interface DocumentsPageProps {
  documents: Document[];
  folders: DocumentFolder[];
  stats: DocumentStats;
  searchQuery: string;
  selectedCategory: DocumentCategory | 'all';
  selectedType: DocumentType | 'all';
  sortBy: 'name' | 'date' | 'size' | 'type';
  sortOrder: 'asc' | 'desc';
  viewMode: 'grid' | 'list';
}

// Mock data for documents page
export const mockDocuments: Document[] = [
  {
    id: 'doc-001',
    name: 'Q4 2024 Financial Report',
    type: DocumentType.REPORT,
    category: DocumentCategory.FINANCIAL,
    fileType: FileType.PDF,
    size: 2457600, // 2.4 MB
    uploadDate: new Date('2024-01-15'),
    modifiedDate: new Date('2024-01-15'),
    author: 'John Mike',
    tags: ['Q4', '2024', 'financial', 'report'],
    shareStatus: ShareStatus.PRIVATE,
    starred: true,
    folderPath: ['Financial Documents'],
    url: '/documents/financial/q4-2024-report.pdf',
    thumbnailUrl: '/thumbnails/q4-2024-report.png'
  },
  {
    id: 'doc-002',
    name: 'Service Contract - ABC Corp',
    type: DocumentType.CONTRACT,
    category: DocumentCategory.LEGAL,
    fileType: FileType.PDF,
    size: 1024000, // 1 MB
    uploadDate: new Date('2024-01-10'),
    modifiedDate: new Date('2024-01-12'),
    author: 'John Mike',
    tags: ['contract', 'service', 'ABC Corp'],
    shareStatus: ShareStatus.SHARED,
    sharedWith: ['legal@fundflow.com', 'contracts@fundflow.com'],
    starred: false,
    folderPath: ['Legal Documents'],
    url: '/documents/legal/service-contract-abc.pdf',
    thumbnailUrl: '/thumbnails/service-contract-abc.png'
  },
  {
    id: 'doc-003',
    name: 'Business Plan 2024-2025',
    type: DocumentType.PROPOSAL,
    category: DocumentCategory.BUSINESS,
    fileType: FileType.DOCX,
    size: 3145728, // 3 MB
    uploadDate: new Date('2023-12-20'),
    modifiedDate: new Date('2024-01-05'),
    author: 'John Mike',
    tags: ['business', 'plan', '2024', '2025', 'strategy'],
    shareStatus: ShareStatus.PUBLIC,
    starred: true,
    folderPath: ['Business Documents'],
    url: '/documents/business/business-plan-2024.docx',
    thumbnailUrl: '/thumbnails/business-plan-2024.png'
  },
  {
    id: 'doc-004',
    name: 'Expense Receipt - Office Supplies',
    type: DocumentType.RECEIPT,
    category: DocumentCategory.FINANCIAL,
    fileType: FileType.JPG,
    size: 512000, // 512 KB
    uploadDate: new Date('2024-01-08'),
    modifiedDate: new Date('2024-01-08'),
    author: 'John Mike',
    tags: ['receipt', 'expenses', 'office', 'supplies'],
    shareStatus: ShareStatus.PRIVATE,
    starred: false,
    folderPath: ['Financial Documents', 'Receipts'],
    url: '/documents/receipts/office-supplies.jpg',
    thumbnailUrl: '/thumbnails/office-supplies.jpg'
  },
  {
    id: 'doc-005',
    name: 'Professional Certificate - Finance Management',
    type: DocumentType.CERTIFICATE,
    category: DocumentCategory.PERSONAL,
    fileType: FileType.PDF,
    size: 1572864, // 1.5 MB
    uploadDate: new Date('2023-11-15'),
    modifiedDate: new Date('2023-11-15'),
    author: 'John Mike',
    tags: ['certificate', 'professional', 'finance', 'management'],
    shareStatus: ShareStatus.PRIVATE,
    starred: false,
    folderPath: ['Personal Documents', 'Certificates'],
    url: '/documents/personal/finance-certificate.pdf',
    thumbnailUrl: '/thumbnails/finance-certificate.png'
  },
  {
    id: 'doc-006',
    name: 'Marketing Presentation - Q1 2024',
    type: DocumentType.PRESENTATION,
    category: DocumentCategory.BUSINESS,
    fileType: FileType.PPTX,
    size: 5242880, // 5 MB
    uploadDate: new Date('2024-01-02'),
    modifiedDate: new Date('2024-01-07'),
    author: 'John Mike',
    tags: ['marketing', 'presentation', 'Q1', '2024'],
    shareStatus: ShareStatus.SHARED,
    sharedWith: ['marketing@fundflow.com'],
    starred: false,
    folderPath: ['Business Documents', 'Presentations'],
    url: '/documents/business/marketing-q1-2024.pptx',
    thumbnailUrl: '/thumbnails/marketing-q1-2024.png'
  },
  {
    id: 'doc-007',
    name: 'Tax Document - 2023 Returns',
    type: DocumentType.TAX_DOCUMENT,
    category: DocumentCategory.FINANCIAL,
    fileType: FileType.PDF,
    size: 2097152, // 2 MB
    uploadDate: new Date('2024-01-01'),
    modifiedDate: new Date('2024-01-01'),
    author: 'John Mike',
    tags: ['tax', '2023', 'returns', 'IRS'],
    shareStatus: ShareStatus.PRIVATE,
    starred: true,
    folderPath: ['Financial Documents', 'Tax Documents'],
    url: '/documents/tax/2023-returns.pdf',
    thumbnailUrl: '/thumbnails/2023-returns.png'
  },
  {
    id: 'doc-008',
    name: 'Budget Planning Spreadsheet',
    type: DocumentType.SPREADSHEET,
    category: DocumentCategory.FINANCIAL,
    fileType: FileType.XLSX,
    size: 786432, // 768 KB
    uploadDate: new Date('2023-12-15'),
    modifiedDate: new Date('2024-01-10'),
    author: 'John Mike',
    tags: ['budget', 'planning', 'spreadsheet', '2024'],
    shareStatus: ShareStatus.SHARED,
    sharedWith: ['finance@fundflow.com'],
    starred: false,
    folderPath: ['Financial Documents', 'Budgets'],
    url: '/documents/budget/2024-budget.xlsx',
    thumbnailUrl: '/thumbnails/2024-budget.png'
  }
];

export const mockFolders: DocumentFolder[] = [
  {
    id: 'folder-001',
    name: 'Financial Documents',
    path: '/Financial Documents',
    documentCount: 5,
    totalSize: 8388608, // 8 MB
    createdDate: new Date('2023-01-01'),
    subfolders: [
      {
        id: 'folder-001-1',
        name: 'Receipts',
        path: '/Financial Documents/Receipts',
        documentCount: 1,
        totalSize: 512000,
        createdDate: new Date('2023-06-01'),
        parentId: 'folder-001'
      },
      {
        id: 'folder-001-2',
        name: 'Tax Documents',
        path: '/Financial Documents/Tax Documents',
        documentCount: 1,
        totalSize: 2097152,
        createdDate: new Date('2023-04-01'),
        parentId: 'folder-001'
      },
      {
        id: 'folder-001-3',
        name: 'Budgets',
        path: '/Financial Documents/Budgets',
        documentCount: 1,
        totalSize: 786432,
        createdDate: new Date('2023-08-01'),
        parentId: 'folder-001'
      }
    ]
  },
  {
    id: 'folder-002',
    name: 'Legal Documents',
    path: '/Legal Documents',
    documentCount: 1,
    totalSize: 1024000, // 1 MB
    createdDate: new Date('2023-02-01')
  },
  {
    id: 'folder-003',
    name: 'Business Documents',
    path: '/Business Documents',
    documentCount: 2,
    totalSize: 8388608, // 8 MB
    createdDate: new Date('2023-03-01'),
    subfolders: [
      {
        id: 'folder-003-1',
        name: 'Presentations',
        path: '/Business Documents/Presentations',
        documentCount: 1,
        totalSize: 5242880,
        createdDate: new Date('2023-09-01'),
        parentId: 'folder-003'
      }
    ]
  },
  {
    id: 'folder-004',
    name: 'Personal Documents',
    path: '/Personal Documents',
    documentCount: 1,
    totalSize: 1572864, // 1.5 MB
    createdDate: new Date('2023-05-01'),
    subfolders: [
      {
        id: 'folder-004-1',
        name: 'Certificates',
        path: '/Personal Documents/Certificates',
        documentCount: 1,
        totalSize: 1572864,
        createdDate: new Date('2023-11-01'),
        parentId: 'folder-004'
      }
    ]
  }
];

export const mockDocumentStats: DocumentStats = {
  totalDocuments: mockDocuments.length,
  totalSize: mockDocuments.reduce((sum, doc) => sum + doc.size, 0),
  documentsByType: mockDocuments.reduce((acc, doc) => {
    acc[doc.type] = (acc[doc.type] || 0) + 1;
    return acc;
  }, {} as Record<DocumentType, number>),
  documentsByCategory: mockDocuments.reduce((acc, doc) => {
    acc[doc.category] = (acc[doc.category] || 0) + 1;
    return acc;
  }, {} as Record<DocumentCategory, number>),
  recentUploads: mockDocuments.filter(doc => {
    const diffInDays = Math.floor((new Date().getTime() - doc.uploadDate.getTime()) / (1000 * 60 * 60 * 24));
    return diffInDays <= 7;
  }).length,
  starredDocuments: mockDocuments.filter(doc => doc.starred).length,
  sharedDocuments: mockDocuments.filter(doc => doc.shareStatus !== ShareStatus.PRIVATE).length
};

// Data passed as props to the root component
export const mockDocumentsPageProps: DocumentsPageProps = {
  documents: mockDocuments,
  folders: mockFolders,
  stats: mockDocumentStats,
  searchQuery: '',
  selectedCategory: 'all',
  selectedType: 'all',
  sortBy: 'date',
  sortOrder: 'desc',
  viewMode: 'grid'
};