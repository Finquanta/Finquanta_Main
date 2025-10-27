import React from 'react';
import { FileType } from '@/mockData/documentsMockData';

interface FileIconProps {
  fileType: FileType;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export default function FileIcon({ fileType, size = 'medium', className = '' }: FileIconProps) {
  const sizeClasses = {
    small: 'w-4 h-4',
    medium: 'w-6 h-6',
    large: 'w-8 h-8'
  };

  const getIconContent = () => {
    switch (fileType) {
      case FileType.PDF:
        return (
          <svg className={`${sizeClasses[size]} ${className}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18.5,9H13V3.5L18.5,9M8,12H16V14H8V12M8,16H13V18H8V16Z" fill="#dc2626"/>
          </svg>
        );
      case FileType.DOC:
      case FileType.DOCX:
        return (
          <svg className={`${sizeClasses[size]} ${className}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18.5,9H13V3.5L18.5,9M6,12H16V14H6V12M6,16H13V18H6V16Z" fill="#150578"/>
          </svg>
        );
      case FileType.XLS:
      case FileType.XLSX:
        return (
          <svg className={`${sizeClasses[size]} ${className}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18.5,9H13V3.5L18.5,9M8,13H16V15H8V13M8,17H12V19H8V17Z" fill="#63d51d"/>
          </svg>
        );
      case FileType.PPT:
      case FileType.PPTX:
        return (
          <svg className={`${sizeClasses[size]} ${className}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18.5,9H13V3.5L18.5,9M9,13H15V17H9V13M11,15H13V15H11V15Z" fill="#ff8600"/>
          </svg>
        );
      case FileType.PNG:
      case FileType.JPG:
      case FileType.JPEG:
      case FileType.GIF:
        return (
          <svg className={`${sizeClasses[size]} ${className}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19M8.5,9A1.5,1.5 0 0,1 7,7.5A1.5,1.5 0 0,1 8.5,6A1.5,1.5 0 0,1 10,7.5A1.5,1.5 0 0,1 8.5,9Z" fill="#06b6d4"/>
          </svg>
        );
      case FileType.ZIP:
        return (
          <svg className={`${sizeClasses[size]} ${className}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M14,17H17L19,13V7H15L13,11V17M14,2L6,2A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18.5,9H13V3.5L18.5,9Z" fill="#778da9"/>
          </svg>
        );
      default:
        return (
          <svg className={`${sizeClasses[size]} ${className}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M13,9H18.5L13,3.5V9M6,2H14L20,8V20A2,2 0 0,1 18,22H6C4.89,22 4,21.1 4,20V4C4,2.89 4.89,2 6,2M15,18V16H6V18H15M18,14V12H6V14H18Z" fill="#778da9"/>
          </svg>
        );
    }
  };

  return <div className="inline-flex items-center justify-center">{getIconContent()}</div>;
}