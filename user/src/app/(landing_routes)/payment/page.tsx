"use client";
import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function PaymentForm() {
  const [agreed, setAgreed] = useState(false);
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan");
  const price = searchParams.get("price");

  return (
    <main className="min-h-screen bg-white pt-24 pb-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
        <h1 className="text-xl font-bold mb-8">Payment Details</h1>
        <div className="flex flex-col md:flex-row gap-12">
          {/* Left - Form */}
          <div className="flex-1">
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">First Name</label>
                <input type="text" placeholder="First Name" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Last Name</label>
                <input type="text" placeholder="Last Name" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Email</label>
                <input type="email" placeholder="Email address" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Card Number</label>
                <input type="text" placeholder="1234 1234 1234 1234" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-600 mb-1 block font-medium">Expiration</label>
                  <input type="text" placeholder="MM/YY" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-600 mb-1 block font-medium">CVC</label>
                  <input type="text" placeholder="CVC" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Country</label>
                <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-500">
                  <option>United States</option>
                  <option>United Kingdom</option>
                  <option>Canada</option>
                  <option>Australia</option>
                </select>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-600 mb-1 block font-medium">City</label>
                  <input type="text" placeholder="City" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-600 mb-1 block font-medium">Postal Code</label>
                  <input type="text" placeholder="Postal Code" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-600 mb-1 block font-medium">Address</label>
                <input type="text" placeholder="Address" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>

              {/* Order Summary */}
              <div className="border-t border-gray-200 pt-4 mt-2">
                <p className="text-xs font-medium text-gray-600 mb-2">Order Summary</p>
                <div className="flex justify-between text-sm">
                  <span className="capitalize">{plan ? `${plan} Plan` : "Selected Plan"}</span>
                  <span>${price || "0.00"}/mo</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="agree" checked={agreed} onChange={() => setAgreed(!agreed)} className="w-4 h-4 accent-blue-600" />
                <label htmlFor="agree" className="text-xs text-gray-600">
                  Securely save my information for one-click checkout
                </label>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-700">
                🔒 After submitting your order, you will be redirected to securely complete your purchase.
              </div>

              <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700">
                Done
              </button>
            </div>
          </div>

          {/* Right - Illustration */}
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-64 h-48 bg-blue-50 rounded-2xl flex items-center justify-center mb-6">
              <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
                <circle cx="60" cy="60" r="50" fill="#EEF2FF"/>
                <circle cx="60" cy="50" r="20" fill="#6366F1"/>
                <circle cx="60" cy="50" r="12" fill="white"/>
                <circle cx="60" cy="50" r="6" fill="#6366F1"/>
                <rect x="30" y="75" width="60" height="20" rx="4" fill="#6366F1"/>
                <rect x="35" y="80" width="20" height="3" rx="1" fill="white"/>
                <rect x="35" y="86" width="30" height="3" rx="1" fill="white"/>
                <circle cx="85" cy="40" r="10" fill="#818CF8"/>
                <path d="M82 40 L84 42 L88 38" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-sm text-gray-600 max-w-xs">Rest assured, your payment details are handled with the utmost security and confidentiality. Enjoy a seamless and hassle-free payment experience with Finquanta.</p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function Payment() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PaymentForm />
    </Suspense>
  );
}