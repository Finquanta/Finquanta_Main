import React from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const NewsletterSection = () => {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">
        <Image
          src="/images/getInTouch.svg"
          alt="Envelope icon for newsletter signup"
          width={320}
          height={320}
          className="mb-10"
        />
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold mb-8">Stay in the know</h2>
        <p className="text-gray-600 mb-8 max-w-lg text-base sm:text-lg">
          Sign up to Fiscal AI newsletter for all the latest news, trends and insights from our industry experts.
        </p>
        <div className="flex flex-col sm:flex-row items-stretch justify-center space-y-10 gap-16 sm:space-y-0 sm:space-x-3 w-full max-w-md px-4 sm:px-10 lg:px-40">
          <Input
            type="email"
            placeholder="Enter your email"
            className="flex-grow w-full sm:w-auto border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-green-200 focus:border-green-500"
          />
          <Button
            type="submit"
            variant="outline"
            className="w-full sm:w-auto text-green-600 border-2 border-green-600 hover:bg-green-50 rounded-lg px-6 py-3 text-sm sm:text-base font-medium"
          >
            Subscribe now
          </Button>
        </div>
      </div>
    </section>
  );
};

export default NewsletterSection; 