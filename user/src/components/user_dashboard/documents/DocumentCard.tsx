'use client';

import React, { useState } from 'react';
import { Document, ShareStatus, formatFileSize, formatRelativeTime } from '@/mockData/documentsMockData';
import FileIcon from './FileIcon';
import { Star, Download, Share2, MoreVertical } from 'lucide-react';

interface DocumentCardProps {
  document: Document;
  viewMode: 'grid' | 'list';
  isSelected?: boolean;
  onSelect?: (document: Document) => void;
  onPreview?: (document: Document) => void;
  onDownload?: (document: Document) => void;
  onShare?: (document: Document) => void;
  onStar?: (document: Document) => void;
  onDelete?: (document: Document) => void;
}

export default function DocumentCard({
  document,
  viewMode,
  isSelected = false,
  onSelect,
  onPreview,
  onDownload,
  onShare,
  onStar,
  onDelete
}: DocumentCardProps) {
  const [showActions, setShowActions] = useState(false);

  const handleCardClick = () => {
    if (onSelect) {
      onSelect(document);
    } else if (onPreview) {
      onPreview(document);
    }
  };

  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
    setShowActions(false);
  };

  const getShareStatusColor = (status: ShareStatus) => {
    switch (status) {
      case ShareStatus.PUBLIC:
        return 'text-[#63d51d] bg-green-50';
      case ShareStatus.SHARED:
        return 'text-[#ff8600] bg-orange-50';
      default:
        return 'text-[#778da9] bg-gray-50';
    }
  };

  const getDocumentTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'invoice':
      case 'receipt':
      case 'tax document':
        return 'text-[#dc2626]';
      case 'contract':
      case 'certificate':
        return 'text-[#150578]';
      case 'report':
      case 'proposal':
      case 'spreadsheet':
        return 'text-[#63d51d]';
      default:
        return 'text-[#778da9]';
    }
  };

  if (viewMode === 'list') {
    return (
      <div
        className={`
          flex items-center p-4 bg-white border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors
          ${isSelected ? 'border-[#150578] bg-[#f0f1ff]' : 'border-gray-200'}
        `}
        onClick={handleCardClick}
      >
        <div className="mr-4">
          <FileIcon fileType={document.fileType} size="medium" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-[#1b263b] truncate">{document.name}</h4>
            {document.starred && (
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
            )}
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getShareStatusColor(document.shareStatus)}`}>
              {document.shareStatus}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-[#778da9]">
            <span className={getDocumentTypeColor(document.type)}>{document.type}</span>
            <span>{formatFileSize(document.size)}</span>
            <span>Modified {formatRelativeTime(document.modifiedDate)}</span>
            <span>by {document.author}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          {onPreview && (
            <button
              onClick={(e) => handleActionClick(e, () => onPreview(document))}
              className="p-2 text-[#778da9] hover:text-[#150578] hover:bg-gray-100 rounded-lg transition-colors"
              title="Preview"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          )}
          {onDownload && (
            <button
              onClick={(e) => handleActionClick(e, () => onDownload(document))}
              className="p-2 text-[#778da9] hover:text-[#150578] hover:bg-gray-100 rounded-lg transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          {onShare && (
            <button
              onClick={(e) => handleActionClick(e, () => onShare(document))}
              className="p-2 text-[#778da9] hover:text-[#150578] hover:bg-gray-100 rounded-lg transition-colors"
              title="Share"
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowActions(!showActions);
              }}
              className="p-2 text-[#778da9] hover:text-[#150578] hover:bg-gray-100 rounded-lg transition-colors"
              title="More options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {showActions && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                {onStar && (
                  <button
                    onClick={(e) => handleActionClick(e, () => onStar(document))}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                  >
                    <Star className={`w-4 h-4 ${document.starred ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                    {document.starred ? 'Remove from starred' : 'Add to starred'}
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => handleActionClick(e, () => onDelete(document))}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-left text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        bg-white border rounded-lg cursor-pointer hover:shadow-md transition-all
        ${isSelected ? 'border-[#150578] shadow-md' : 'border-gray-200'}
      `}
      onClick={handleCardClick}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileIcon fileType={document.fileType} size="medium" />
            {document.starred && (
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
            )}
          </div>
          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getShareStatusColor(document.shareStatus)}`}>
            {document.shareStatus}
          </span>
        </div>

        <h4 className="font-medium text-[#1b263b] mb-2 line-clamp-2 leading-tight">
          {document.name}
        </h4>

        <div className="space-y-1">
          <div className={`text-sm font-medium ${getDocumentTypeColor(document.type)}`}>
            {document.type}
          </div>
          <div className="text-xs text-[#778da9]">
            {formatFileSize(document.size)}
          </div>
          <div className="text-xs text-[#778da9]">
            {formatRelativeTime(document.modifiedDate)}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          {onPreview && (
            <button
              onClick={(e) => handleActionClick(e, () => onPreview(document))}
              className="p-1.5 text-[#778da9] hover:text-[#150578] hover:bg-gray-100 rounded transition-colors"
              title="Preview"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          )}
          {onDownload && (
            <button
              onClick={(e) => handleActionClick(e, () => onDownload(document))}
              className="p-1.5 text-[#778da9] hover:text-[#150578] hover:bg-gray-100 rounded transition-colors"
              title="Download"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
          {onShare && (
            <button
              onClick={(e) => handleActionClick(e, () => onShare(document))}
              className="p-1.5 text-[#778da9] hover:text-[#150578] hover:bg-gray-100 rounded transition-colors"
              title="Share"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}