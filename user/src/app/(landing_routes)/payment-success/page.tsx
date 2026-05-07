import Link from 'next/link';

export default function PaymentSuccess() {
  return (
    <main className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center max-w-lg px-4">
        <p className="text-base text-gray-800 font-medium mb-8">
          Thank you for choosing Finquanta AI! Your journey to smarter financial management begins here. If you have any questions or need assistance, our support team is always ready to help.
        </p>
        <Link href="/dashboard">
          <button className="bg-[#4CAF50] text-white px-10 py-3 rounded-lg font-medium hover:bg-[#45a049] text-base">
            Go To Dashboard
          </button>
        </Link>
      </div>
    </main>
  );
}