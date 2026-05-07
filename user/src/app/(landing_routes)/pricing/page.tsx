import Link from 'next/link';

export default function Pricing() {
  return (
    <main className="min-h-screen bg-white pt-24 pb-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-xl font-bold mb-2">FIND THE RIGHT FINQUANTA PLAN THAT'S RIGHT FOR NOW.</h1>
          <p className="text-sm text-gray-500">Explore essential features with no cost. Get basic investment recommendations, budget tracking, and financial goal setting.</p>
          <div className="mt-4 inline-block bg-[#4CAF50] text-white px-8 py-2 rounded-full font-medium">
            FREE
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">

          {/* Entrepreneur */}
          <div className="border-2 border-blue-400 rounded-lg p-6 flex flex-col items-center text-center">
            <h2 className="text-lg font-bold mb-3">ENTREPRENEUR</h2>
            <p className="text-sm text-gray-600 mb-4">Advanced tools for entrepreneurs, including comprehensive financial planning and personalized investment advice.</p>
            <p className="text-2xl font-bold mb-1">$49.99/MO</p>
            <p className="text-xs text-gray-500 mb-6">Or $490.99/year (11% discount)</p>
            <Link href="/payment?plan=entrepreneur&price=49.99">
  <button className="bg-blue-500 text-white px-8 py-2 rounded-full font-bold hover:bg-blue-600 mb-6">
    BUY NOW
  </button>
</Link>
            <div className="mt-auto">
              <div className="flex flex-col items-center text-xs text-gray-500">
                <span>3 users or more?</span>
                <a href="#" className="underline">Request a demo for your team</a>
              </div>
            </div>
          </div>

          {/* Business - highlighted */}
          <div className="border-2 border-red-500 rounded-lg p-6 flex flex-col items-center text-center">
            <h2 className="text-lg font-bold mb-3">BUSINESS</h2>
            <p className="text-sm text-gray-600 mb-4">Detailed financial analytics, employee benefits planning, and advanced investment opportunities for scaling businesses.</p>
            <p className="text-2xl font-bold mb-1">$99.99/MO</p>
            <p className="text-xs text-gray-500 mb-6">Or $990.99/year (10% discount)</p>
            <Link href="/payment?plan=business&price=99.99">
  <button className="bg-red-500 text-white px-8 py-2 rounded-full font-bold hover:bg-red-600 mb-2">
    BUY NOW
  </button>
</Link>
            <p className="text-xs text-gray-500 mb-6">Recommended for small companies</p>
            <div className="mt-auto">
              <div className="flex flex-col items-center text-xs text-gray-500">
                <span>5 users or more?</span>
                <a href="#" className="underline">Request a demo for your team</a>
              </div>
            </div>
          </div>

          {/* Corporate */}
          <div className="border-2 border-gray-300 rounded-lg p-6 flex flex-col items-center text-center">
            <h2 className="text-lg font-bold mb-3">CORPORATE</h2>
            <p className="text-sm text-gray-600 mb-4">Custom financial strategies, extensive portfolio management, and dedicated support for large organizations.</p>
            <p className="text-sm text-gray-600 mb-4">Customized solution for teams of more than 5 users.</p>
            <button className="border-2 border-gray-400 text-gray-600 px-8 py-2 rounded-full font-bold hover:bg-gray-100 mb-2">
              CONTACT SALES
            </button>
            <p className="text-xs text-gray-500">Recommended for corporations and investors</p>
          </div>

        </div>

        {/* Feature comparison */}
        <p className="text-center text-sm text-gray-600 mt-10">
          Check out our feature comparison table <Link href="/pricing-comparison" className="underline">here</Link>.
        </p>

      </div>
    </main>
  );
}