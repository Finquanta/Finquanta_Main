import React from 'react';
import Link from 'next/link';

type FooterProps = {
  onContactClick: () => void;
};

const Footer = ({ onContactClick }: FooterProps) => {
  return (
    <footer className="bg-white py-8 mt-4">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top links */}
        <div className="flex flex-row justify-center items-center gap-16 mb-6">
          <Link href="/terms" className="text-sm text-gray-600 hover:text-gray-900 hover:underline">
            terms of service
          </Link>
          <Link href="/privacy" className="text-sm text-gray-600 hover:text-gray-900 hover:underline">
            privacy notice
          </Link>
          <Link href="/ai-risk-disclosure" className="text-sm text-gray-600 hover:text-gray-900 hover:underline">
            ai risk disclosure
          </Link>
        </div>

        {/* Copyright */}
        <p className="text-sm text-gray-500 text-center">
          Finquanta Financial Group {new Date().getFullYear()} ©. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;