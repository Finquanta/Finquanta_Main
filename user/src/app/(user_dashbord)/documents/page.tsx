'use client';

import React, { useState, useCallback } from 'react';
import { mockDocumentsPageProps } from '@/mockData/documentsMockData';
import { Document, DocumentFolder } from '@/mockData/documentsMockData';
import DocumentGrid from '@/components/user_dashboard/documents/DocumentGrid';
import { Folder, FileText, Upload, Plus, X } from 'lucide-react';

export default function DocumentsPage() {
  const [documents, setDocuments] = useState(mockDocumentsPageProps.documents);
  const [folders] = useState(mockDocumentsPageProps.folders);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);

  const handleDocumentSelect = useCallback((documentId: string) => {
    setSelectedDocuments(prev => {
      if (prev.includes(documentId)) {
        return prev.filter(id => id !== documentId);
      } else {
        return [...prev, documentId];
      }
    });
  }, []);

  const handleDocumentPreview = useCallback((document: Document) => {
    // In a real app, this would open a preview modal
    console.log('Preview document:', document.name);
    alert(`Preview: ${document.name}`);
  }, []);

  const handleDocumentDownload = useCallback((document: Document) => {
    // In a real app, this would trigger a download
    console.log('Download document:', document.name);
    alert(`Download: ${document.name}`);
  }, []);

  const handleDocumentShare = useCallback((document: Document) => {
    // In a real app, this would open a share dialog
    console.log('Share document:', document.name);
    alert(`Share: ${document.name}`);
  }, []);

  const handleDocumentStar = useCallback((document: Document) => {
    // Toggle star status
    setDocuments(prev => prev.map(doc =>
      doc.id === document.id ? { ...doc, starred: !doc.starred } : doc
    ));
  }, []);

  const handleDocumentDelete = useCallback((document: Document) => {
    // Delete document with confirmation
    if (confirm(`Are you sure you want to delete "${document.name}"?`)) {
      setDocuments(prev => prev.filter(doc => doc.id !== document.id));
      setSelectedDocuments(prev => prev.filter(id => id !== document.id));
    }
  }, []);

  const handleBulkDownload = useCallback((documentIds: string[]) => {
    // In a real app, this would create a zip file and download
    console.log('Bulk download:', documentIds);
    alert(`Download ${documentIds.length} documents`);
  }, []);

  const handleBulkDelete = useCallback((documentIds: string[]) => {
    // Delete multiple documents with confirmation
    if (confirm(`Are you sure you want to delete ${documentIds.length} document(s)?`)) {
      setDocuments(prev => prev.filter(doc => !documentIds.includes(doc.id)));
      setSelectedDocuments([]);
    }
  }, []);

  const handleUpload = useCallback(() => {
    // In a real app, this would open file upload dialog
    setShowUploadModal(true);
  }, []);

  const handleFileUpload = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    // In a real app, this would upload files to server
    const newDocuments = Array.from(files).map((file, index) => ({
      id: `doc-upload-${Date.now()}-${index}`,
      name: file.name,
      type: 'Document' as any, // Would be determined by file analysis
      category: 'Financial' as any, // Would be determined by user selection
      fileType: file.name.split('.').pop()?.toLowerCase() as any,
      size: file.size,
      uploadDate: new Date(),
      modifiedDate: new Date(),
      author: 'John Mike', // Would be current user
      tags: [],
      shareStatus: 'Private' as any,
      starred: false,
      folderPath: currentFolder ? [currentFolder] : [],
      url: URL.createObjectURL(file),
    }));

    setDocuments(prev => [...newDocuments, ...prev]);
    setShowUploadModal(false);
  }, [currentFolder]);

  const stats = mockDocumentsPageProps.stats;

  return (
    <div className="p-6 bg-[#f2f3f4] min-h-full">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1b263b] mb-2">Documents</h1>
        <p className="text-[#778da9]">
          Manage, organize, and share all your business documents in one place
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#778da9] mb-1">Total Documents</p>
              <p className="text-2xl font-bold text-[#1b263b]">{stats.totalDocuments}</p>
            </div>
            <FileText className="w-8 h-8 text-[#150578]" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#778da9] mb-1">Total Storage</p>
              <p className="text-2xl font-bold text-[#1b263b]">
                {(stats.totalSize / (1024 * 1024)).toFixed(1)} MB
              </p>
            </div>
            <Folder className="w-8 h-8 text-[#63d51d]" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#778da9] mb-1">Starred</p>
              <p className="text-2xl font-bold text-[#1b263b]">{stats.starredDocuments}</p>
            </div>
            <svg className="w-8 h-8 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l2.8-2.034a1 1 0 011.364 0l2.8 2.034c.755.588 1.54-.148 1.118-2.034l1.07-3.292a1 1 0 00-.364-1.118L18.46 8.72c-.783-.57-1.84-.7-2.4-.183l-2.8 2.034a1 1 0 01-1.364 0l-2.8-2.034c-.755-.57-1.24-.14-1.118 1.588l1.07 3.292z" />
            </svg>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[#778da9] mb-1">Shared</p>
              <p className="text-2xl font-bold text-[#1b263b]">{stats.sharedDocuments}</p>
            </div>
            <svg className="w-8 h-8 text-[#ff8600]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.032 4.026a9.001 9.001 0 01-7.432 0m9.032-4.026A9.001 9.001 0 0112 3c-4.474 0-8.268 2.943-9.543 7a9.97 9.97 0 001.428 2.684m9.032-4.026A9.001 9.001 0 0112 21c-4.474 0-8.268-2.943-9.543-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Folders Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-[#1b263b] mb-4">Folders</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {folders.map((folder) => (
            <div
              key={folder.id}
              onClick={() => setCurrentFolder(folder.name)}
              className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg cursor-pointer hover:shadow-md hover:border-[#150578] transition-all"
            >
              <Folder className="w-8 h-8 text-[#150578]" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-[#1b263b] truncate">{folder.name}</h3>
                <p className="text-sm text-[#778da9]">
                  {folder.documentCount} documents
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Documents Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-[#1b263b]">
            {currentFolder ? `${currentFolder} Documents` : 'All Documents'}
          </h2>
          <button
            onClick={() => setCurrentFolder(null)}
            className="text-sm text-[#778da9] hover:text-[#150578] transition-colors"
          >
            ← Back to all folders
          </button>
        </div>

        <DocumentGrid
          documents={currentFolder
            ? documents.filter(doc => doc.folderPath.includes(currentFolder))
            : documents
          }
          viewMode={viewMode}
          selectedDocuments={selectedDocuments}
          onDocumentSelect={handleDocumentSelect}
          onDocumentPreview={handleDocumentPreview}
          onDocumentDownload={handleDocumentDownload}
          onDocumentShare={handleDocumentShare}
          onDocumentStar={handleDocumentStar}
          onDocumentDelete={handleDocumentDelete}
          onBulkDownload={handleBulkDownload}
          onBulkDelete={handleBulkDelete}
          onUpload={handleUpload}
        />
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[#1b263b]">Upload Documents</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-[#778da9] hover:text-[#1b263b] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#150578] transition-colors cursor-pointer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFileUpload(e.dataTransfer.files);
              }}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = true;
                input.onchange = (e) => handleFileUpload((e.target as HTMLInputElement).files);
                input.click();
              }}
            >
              <Upload className="w-12 h-12 text-[#778da9] mx-auto mb-4" />
              <p className="text-[#1b263b] mb-2">Drop files here or click to upload</p>
              <p className="text-sm text-[#778da9]">
                Supports PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, PNG, JPG files
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.multiple = true;
                  input.onchange = (e) => handleFileUpload((e.target as HTMLInputElement).files);
                  input.click();
                }}
                className="px-4 py-2 bg-[#150578] text-white rounded-lg hover:bg-[#0d0342] transition-colors"
              >
                Select Files
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}