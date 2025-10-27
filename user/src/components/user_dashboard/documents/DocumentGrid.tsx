'use client';

import React, { useState, useMemo } from 'react';
import { Document, DocumentCategory, DocumentType } from '@/mockData/documentsMockData';
import DocumentCard from './DocumentCard';
import { Grid, List, Search, Filter, Download, Upload, Plus } from 'lucide-react';

interface DocumentGridProps {
  documents: Document[];
  viewMode: 'grid' | 'list';
  selectedDocuments: string[];
  onDocumentSelect: (documentId: string) => void;
  onDocumentPreview: (document: Document) => void;
  onDocumentDownload: (document: Document) => void;
  onDocumentShare: (document: Document) => void;
  onDocumentStar: (document: Document) => void;
  onDocumentDelete: (document: Document) => void;
  onBulkDownload: (documentIds: string[]) => void;
  onBulkDelete: (documentIds: string[]) => void;
  onUpload: () => void;
}

export default function DocumentGrid({
  documents,
  viewMode,
  selectedDocuments,
  onDocumentSelect,
  onDocumentPreview,
  onDocumentDownload,
  onDocumentShare,
  onDocumentStar,
  onDocumentDelete,
  onBulkDownload,
  onBulkDelete,
  onUpload
}: DocumentGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | 'all'>('all');
  const [selectedType, setSelectedType] = useState<DocumentType | 'all'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size' | 'type'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filter and sort documents
  const filteredAndSortedDocuments = useMemo(() => {
    let filtered = documents.filter(doc => {
      const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
      const matchesType = selectedType === 'all' || doc.type === selectedType;

      return matchesSearch && matchesCategory && matchesType;
    });

    // Sort documents
    return filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'date':
          aValue = a.modifiedDate.getTime();
          bValue = b.modifiedDate.getTime();
          break;
        case 'size':
          aValue = a.size;
          bValue = b.size;
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [documents, searchQuery, selectedCategory, selectedType, sortBy, sortOrder]);

  const handleSort = (field: 'name' | 'date' | 'size' | 'type') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleSelectAll = () => {
    if (selectedDocuments.length === filteredAndSortedDocuments.length) {
      // Deselect all
      filteredAndSortedDocuments.forEach(doc => onDocumentSelect(''));
    } else {
      // Select all
      filteredAndSortedDocuments.forEach(doc => onDocumentSelect(doc.id));
    }
  };

  const isAllSelected = filteredAndSortedDocuments.length > 0 &&
                    selectedDocuments.length === filteredAndSortedDocuments.length;

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex-1 flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#778da9] w-4 h-4" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
            />
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as DocumentCategory | 'all')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
          >
            <option value="all">All Categories</option>
            <option value={DocumentCategory.FINANCIAL}>Financial</option>
            <option value={DocumentCategory.LEGAL}>Legal</option>
            <option value={DocumentCategory.BUSINESS}>Business</option>
            <option value={DocumentCategory.PERSONAL}>Personal</option>
          </select>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as DocumentType | 'all')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#150578] focus:border-transparent"
          >
            <option value="all">All Types</option>
            <option value={DocumentType.INVOICE}>Invoice</option>
            <option value={DocumentType.RECEIPT}>Receipt</option>
            <option value={DocumentType.CONTRACT}>Contract</option>
            <option value={DocumentType.REPORT}>Report</option>
            <option value={DocumentType.TAX_DOCUMENT}>Tax Document</option>
            <option value={DocumentType.CERTIFICATE}>Certificate</option>
            <option value={DocumentType.PROPOSAL}>Proposal</option>
            <option value={DocumentType.PRESENTATION}>Presentation</option>
            <option value={DocumentType.SPREADSHEET}>Spreadsheet</option>
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onUpload}
            className="flex items-center gap-2 px-4 py-2 bg-[#150578] text-white rounded-lg hover:bg-[#0d0342] transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span className="hidden sm:inline">Upload</span>
          </button>

          {selectedDocuments.length > 0 && (
            <>
              <button
                onClick={() => onBulkDownload(selectedDocuments)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download ({selectedDocuments.length})</span>
              </button>
              <button
                onClick={() => onBulkDelete(selectedDocuments)}
                className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span className="hidden sm:inline">Delete</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Results Summary and Sort */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-[#778da9]">
          Showing {filteredAndSortedDocuments.length} of {documents.length} documents
          {searchQuery && (
            <span>
              {' '}for &quot;<span className="font-medium text-[#1b263b]">{searchQuery}</span>&quot;
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Sort Options */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#778da9]">Sort by:</span>
            <button
              onClick={() => handleSort('name')}
              className={`px-3 py-1 rounded-md transition-colors ${
                sortBy === 'name' ? 'bg-[#150578] text-white' : 'text-[#778da9] hover:text-[#150578]'
              }`}
            >
              Name
            </button>
            <button
              onClick={() => handleSort('date')}
              className={`px-3 py-1 rounded-md transition-colors ${
                sortBy === 'date' ? 'bg-[#150578] text-white' : 'text-[#778da9] hover:text-[#150578]'
              }`}
            >
              Date
            </button>
            <button
              onClick={() => handleSort('size')}
              className={`px-3 py-1 rounded-md transition-colors ${
                sortBy === 'size' ? 'bg-[#150578] text-white' : 'text-[#778da9] hover:text-[#150578]'
              }`}
            >
              Size
            </button>
            <button
              onClick={() => handleSort('type')}
              className={`px-3 py-1 rounded-md transition-colors ${
                sortBy === 'type' ? 'bg-[#150578] text-white' : 'text-[#778da9] hover:text-[#150578]'
              }`}
            >
              Type
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 border border-gray-300 rounded-lg">
            <button
              onClick={() => {/* View mode controlled by parent */}}
              className={`p-2 rounded-l-lg transition-colors ${
                viewMode === 'grid' ? 'bg-[#150578] text-white' : 'text-[#778da9] hover:text-[#150578]'
              }`}
              title="Grid view"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => {/* View mode controlled by parent */}}
              className={`p-2 rounded-r-lg transition-colors ${
                viewMode === 'list' ? 'bg-[#150578] text-white' : 'text-[#778da9] hover:text-[#150578]'
              }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Select All Checkbox */}
      {filteredAndSortedDocuments.length > 0 && (
        <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-gray-200">
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={handleSelectAll}
            className="w-4 h-4 text-[#150578] border-gray-300 rounded focus:ring-[#150578]"
          />
          <label className="text-sm text-[#778da9]">
            Select all ({filteredAndSortedDocuments.length} documents)
          </label>
        </div>
      )}

      {/* Documents Display */}
      {filteredAndSortedDocuments.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <div className="text-[#778da9] mb-4">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-[#1b263b] mb-2">
            {searchQuery || selectedCategory !== 'all' || selectedType !== 'all'
              ? 'No documents found'
              : 'No documents yet'}
          </h3>
          <p className="text-[#778da9] mb-4">
            {searchQuery || selectedCategory !== 'all' || selectedType !== 'all'
              ? 'Try adjusting your search or filter criteria'
              : 'Upload your first document to get started'}
          </p>
          {!searchQuery && selectedCategory === 'all' && selectedType === 'all' && (
            <button
              onClick={onUpload}
              className="flex items-center gap-2 mx-auto px-6 py-2 bg-[#150578] text-white rounded-lg hover:bg-[#0d0342] transition-colors"
            >
              <Plus className="w-4 h-4" />
              Upload Document
            </button>
          )}
        </div>
      ) : (
        <div className={
          viewMode === 'grid'
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
            : 'space-y-2'
        }>
          {filteredAndSortedDocuments.map((document) => (
            <DocumentCard
              key={document.id}
              document={document}
              viewMode={viewMode}
              isSelected={selectedDocuments.includes(document.id)}
              onSelect={() => onDocumentSelect(document.id)}
              onPreview={onDocumentPreview}
              onDownload={onDocumentDownload}
              onShare={onDocumentShare}
              onStar={onDocumentStar}
              onDelete={onDocumentDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}