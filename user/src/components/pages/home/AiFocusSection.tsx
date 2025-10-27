import React from 'react';
import Image from 'next/image';

// Updated data to match the image content with actual image paths
const featuresData = [
  { 
    imagePath: "/images/maturity010.png", 
    title: "Maturity", 
    description: "Smart strategies for every stage, from startup to growth." 
  },
  { 
    imagePath: "/images/nature.png", 
    title: "Nature", 
    description: "Industry-specific insights to help you make better decisions." 
  },
  { 
    imagePath: "/images/niche.png", 
    title: "Niche", 
    description: "Financial guidance based on your business model and operations." 
  },
  { 
    imagePath: "/images/financial_health.png", 
    title: "Financial Health", 
    description: "Stay on top of your business' cash flow, expenses, and profits." 
  },
];

const AiFocusSection = () => {
  return (
    <section className="w-full py-12 bg-white px-4 sm:px-6 lg:px-8">
      {/* Top banner with background image */}
      <div className="relative py-12 mb-16 flex items-center justify-center overflow-hidden w-full">
        <Image 
          src="/images/image_69.png" 
          alt="Financial AI Technology Background"
          fill
          className="absolute object-cover z-0"
          priority
        />
        <h2 className="text-xl sm:text-2xl lg:text-3xl font-medium text-white relative z-10 text-center px-4">
          Optimizing financial decisions through powerful AI technology.
        </h2>
      </div>

      {/* Only one container, use w-full and responsive paddings for inner content */}
      <div className="w-full px-4 sm:px-6 lg:px-8">
        {/* Main title */}
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-16 text-center">
          Our AI assistant focuses on what matters most
        </h2>
        
        {/* Features cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-16 w-full max-w-[1200px] mx-auto">
          {featuresData.map((feature, index) => (
            <div key={index} className="bg-[#00a907] text-white p-10 rounded-xl flex flex-col items-center text-center shadow-md">
              <h3 className="text-lg sm:text-xl font-semibold mb-2">{feature.title}</h3>
              <div className="p-3 mb-4 inline-block flex items-center justify-center h-[100px]">
                <Image 
                  src={feature.imagePath} 
                  alt={`${feature.title} icon`}
                  height={100}
                  width={0}
                  style={{ width: 'auto', height: '100%' }}
                  className="text-[#3EB449]"
                />
              </div>
              <p className="text-base sm:text-lg">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
        
        {/* Bottom tagline */}
        <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-12">
          delivering smart financial strategies for your business.
        </h3>
      </div>
    </section>
  );
};

export default AiFocusSection; 