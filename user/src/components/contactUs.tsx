import React from 'react';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type ContactUsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const ContactUsModal = ({ isOpen, onClose }: ContactUsModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-2 sm:px-0">
      <Card className="relative w-full max-w-lg p-0 border-0 shadow-lg">
        {/* Close Button */}
        <button
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl font-bold focus:outline-none"
          onClick={onClose}
          aria-label="Close"
        >
          &times;
        </button>
        {/* Logo */}
        <div className="flex flex-col items-center pt-8 pb-2">
          <Image src="/images/Finquanta_logo.png" alt="Finquanta AI Logo" width={80} height={40} className="mb-2" />
        </div>
        {/* Header */}
        <div className="text-center mb-2 px-4">
          <h2 className="text-3xl font-bold mb-2 tracking-tight">LET&apos;S TALK</h2>
          <p className="text-gray-700 text-base mb-2">Find out how Finquanta AI can benefit your business today</p>
        </div>
        {/* Form */}
        <form className="flex flex-col gap-4 lg:px-16 pb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              type="text"
              placeholder="First Name"
              className="bg-gray-400/70 placeholder-black font-normal rounded-full border-0 focus:ring-2 focus:ring-green-400 text-base h-12"
            />
            <Input
              type="text"
              placeholder="Last Name"
              className="bg-gray-400/70 placeholder-black font-normal rounded-full border-0 focus:ring-2 focus:ring-green-400 text-base h-12"
            />
          </div>
          <Input
            type="email"
            placeholder="Enter your email address"
            className="bg-gray-400/70 placeholder-black font-normal rounded-full border-0 focus:ring-2 focus:ring-green-400 text-base h-12"
          />
          <Input
            type="tel"
            placeholder="Phone Number (Optional)"
            className="bg-gray-400/70 placeholder-black font-normal rounded-full border-0 focus:ring-2 focus:ring-green-400 text-base h-12"
          />
          <textarea
            placeholder="Message (Required)"
            rows={5}
            className="bg-gray-400/70 placeholder-black font-normal rounded-2xl border-0 focus:ring-2 focus:ring-green-400 text-base px-4 py-3 resize-none min-h-[120px]"
          />
          <Button
            type="submit"
            className="w-full bg-[#6FFF6F] hover:bg-[#5ee95e] text-black font-bold py-3 rounded-full text-lg transition mt-2"
          >
            Send Message
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default ContactUsModal;
