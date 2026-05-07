import Link from 'next/link';

export default function PricingComparison() {
  return (
    <main className="min-h-screen bg-white pt-24 pb-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
        
        <h1 className="text-lg font-bold mb-3">FEATURE COMPARISON TABLE</h1>
        <p className="text-sm text-gray-600 mb-8">Explore our feature comparison table to find the perfect plan for your needs. Compare the benefits and tools available at each pricing tier — Free, Entrepreneur and Business — so you can make an informed decision and get the most out of Finquanta. See at a glance which features align with your financial goals and business requirements.</p>

        <table className="w-full border border-gray-300 text-sm text-center mb-8">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-3 text-left">FEATURES</th>
              <th className="border border-gray-300 px-4 py-3">FREE</th>
              <th className="border border-gray-300 px-4 py-3">ENTREPRENEUR</th>
              <th className="border border-gray-300 px-4 py-3">BUSINESS</th>
            </tr>
          </thead>
          <tbody>
            {[
              { feature: "Bookkeeping", free: true, entrepreneur: true, business: true },
              { feature: "Business Plan Creation & Validation", free: true, entrepreneur: true, business: true },
              { feature: "Business Proposal Creation & Validation", free: true, entrepreneur: true, business: true },
              { feature: "Accounting", free: false, entrepreneur: true, business: true },
              { feature: "Taxes", free: false, entrepreneur: true, business: true },
              { feature: "Accounts Payable", free: false, entrepreneur: true, business: true },
              { feature: "Accounts Receivable", free: false, entrepreneur: true, business: true },
              { feature: "Business Correspondence", free: false, entrepreneur: true, business: true },
              { feature: "Processing Payroll", free: false, entrepreneur: false, business: true },
              { feature: "Financial Statements", free: false, entrepreneur: false, business: true },
              { feature: "Financial Administration", free: false, entrepreneur: false, business: true },
              { feature: "Audits", free: false, entrepreneur: false, business: true },
              { feature: "Legal Contract Creation", free: false, entrepreneur: false, business: true },
            ].map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="border border-gray-300 px-4 py-3 text-left">{row.feature}</td>
                <td className="border border-gray-300 px-4 py-3">{row.free ? "✓" : ""}</td>
                <td className="border border-gray-300 px-4 py-3">{row.entrepreneur ? "✓" : ""}</td>
                <td className="border border-gray-300 px-4 py-3">{row.business ? "✓" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-center text-sm text-gray-600">
          Check out our pricing <Link href="/pricing" className="underline">here</Link>.
        </p>

      </div>
    </main>
  );
}