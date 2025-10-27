"use client";
import Image from "next/image";
import Link from "next/link";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils"; // Import cn for conditional classes if needed
import HamburgerMenu from "./ui/HamburgerMenu";

export function NavBarComponent() {
  return (
    // Add backdrop blur and semi-transparent background
    <nav className="fixed top-0 left-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/60 shadow-sm overflow-x-hidden">
      <div className="container mx-auto px-2 sm:px-4 lg:px-8">
        <div className="h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center">
              {/* Responsive logo size for mobile */}
              <Image src="/images/fiscal_logo.png" width={96} height={96} alt="Fiscal AI Logo" className="w-20 sm:w-28 md:w-36 h-auto" />
            </Link>
          </div>

          {/* Navigation Links */}
          {/* Hide links on smaller screens if needed, adjust spacing */}
          <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
            {/* Update links and hrefs */}
            <Link href="/features" className="text-gray-700 hover:text-gray-900 text-base font-medium">
              Features
            </Link>
            <Link href="/faq" className="text-gray-700 hover:text-gray-900 text-base font-medium">
              FAQs
            </Link>
            <Link href="/newsletter" className="text-gray-700 hover:text-gray-900 text-base font-medium">
              Newsletter
            </Link>
            <Link href="/community" className="text-gray-700 hover:text-gray-900 text-base font-medium">
              Community
            </Link>
          </div>

          {/* Action Buttons */}
          {/* Adjust spacing */}
          <div className="hidden md:flex items-center space-x-3">
            {/* Style Sign Up button */}
            <Link href="/signup">
              {/* Use specific green background */}
              <Button variant="default" className="bg-[#4CAF50] hover:bg-[#45a049] text-white rounded-lg px-5 py-2">
                Sign Up
              </Button>
            </Link>
            {/* Style Login button */}
            <Link href="/login">
              {/* Use light background and green text */}
              <Button variant="ghost" className="bg-gray-50 hover:bg-gray-100 text-[#4CAF50] rounded-lg px-5 py-2">
                Login
              </Button>
            </Link>
          </div>
          {/* Hamburger menu for mobile */}
          <div className="md:hidden flex items-center">
            <HamburgerMenu />
          </div>
        </div>
      </div>
    </nav>
  );
}
