import React from 'react';
import Image from 'next/image';

const MobilePromoSection = () => {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex justify-center">
        <Image
          src="/images/faq.svg"
          alt="Fiscal AI mobile app interface showing charts"
          width={900}
          height={600}
          className="rounded-lg w-full max-w-[900px] h-auto"
        />
      </div>
    </section>
  );
};

export default MobilePromoSection; 