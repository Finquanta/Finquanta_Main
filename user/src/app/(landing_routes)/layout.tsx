"use client";

import ClientOnly from "@/components/client-only";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./../globals.css";
import { cn } from "@/lib/utils";
import { NavBarComponent } from "@/components/navbar";
import Footer from "@/components/layout/Footer";
import { useState } from "react";
import ContactUsModal from "@/components/contactUs";

const inter = Inter({ subsets: ["latin"] });

// export const metadata: Metadata = {
//   title: "Auth Fiscal AI",
//   description:
//     "Fiscal AI is modern monry management platform powered by AI. Track expenses, optimize investments, and reach your goals—all in one place.",
// };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isContactModalOpen, setContactModalOpen] = useState(false);

  return (
    <>
      <div className={cn("overflow-x-hidden min-w-[320px] max-w-[2560px] mx-auto", inter.className)}>
        <NavBarComponent />
        <main className="pt-16 w-full">{children}</main>
        <Footer onContactClick={() => setContactModalOpen(true)} />
      </div>
      <ClientOnly>
        <ContactUsModal
          isOpen={isContactModalOpen}
          onClose={() => setContactModalOpen(false)}
        />
      </ClientOnly>
    </>
  );
}
