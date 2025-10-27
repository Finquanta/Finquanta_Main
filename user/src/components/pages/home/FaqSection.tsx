import React from 'react';

// Update FAQ content to match Figma exactly
const faqData = [
  {
    id: "item-1",
    question: "How much does Fiscal AI cost?",
    answer: "We offer a free plan with essential tools, plus paid plans starting at $49.99/month for growing businesses. Get advanced features, investment insights, and financial planning to your needs."
  },
  {
    id: "item-2",
    question: "How does Fiscal AI work?",
    answer: "Our AI analyzes your business finances, tracks expenses, and provides smart recommendations to optimize cash flow, taxes, and investments."
  },
  {
    id: "item-3", 
    question: "What are the benefits of using Fiscal AI?",
    answer: "Save time, make smarter financial decisions, and get AI-powered insights to grow your business with confidence."
  }
];

const FaqSection = () => {
  return (
    <section className="container py-20 bg-white">
      <div className="mx-auto pb-4 sm:px-6 lg:px-36 ">
        <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-semibold mb-12 text-center">Frequently Asked Questions</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 px-4 sm:px-6 lg:px-10 w-full max-w-full">
          {faqData.map((item) => (
            <div 
              key={item.id} 
              className="bg-[#33B736] p-6 sm:p-8 rounded-lg text-white text-center flex flex-col h-full"
            >
              <h3 className="text-lg sm:text-xl md:text-2xl font-semibold mb-3 sm:mb-4">{item.question}</h3>
              <p className="text-sm sm:text-base">{item.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FaqSection;