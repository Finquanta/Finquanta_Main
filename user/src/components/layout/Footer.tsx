import React from 'react';
import Link from 'next/link'; // Import Link for navigation

type FooterProps = {
  onContactClick: () => void;
};

const Footer = ({ onContactClick }: FooterProps) => {
  return (
    // Match Figma footer background, padding
    <footer className="bg-gray-50 py-8 mt-20"> 
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Use flexbox to layout footer items */}
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          {/* Footer Links */}
          <div className="flex space-x-6">
            <button
              type="button"
              onClick={onContactClick}
              className="text-sm text-gray-600 hover:text-gray-900 hover:underline bg-transparent border-none p-0 m-0 cursor-pointer"
            >
              Contact us
            </button>
            <Link href="/offers" className="text-sm text-gray-600 hover:text-gray-900 hover:underline">
              Offers
            </Link>
            <Link href="/community" className="text-sm text-gray-600 hover:text-gray-900 hover:underline">
              Community
            </Link>
          </div>

          {/* Copyright Text */}
          <p className="text-sm text-gray-500">
            © Fiscal Group {new Date().getFullYear()}. All rights reserved.
          </p>
        </div>
        {/* Add any other footer elements like logo or social icons if in Figma */} 
      </div>
    </footer>
  );
};

export default Footer; 