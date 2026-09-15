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
import ChatbotWidget from "@/components/ChatbotWidget";
import SocialSidebar from "@/components/SocialSidebar";

const inter = Inter({ subsets: ["latin"] });

// export const metadata: Metadata = {
//   title: "Auth Finquanta AI",
//   description:
//     "Finquanta AI is modern monry management platform powered by AI. Track expenses, optimize investments, and reach your goals—all in one place.",
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
        <main
          className="w-full"
          // 4.75rem clears the floating navbar (a 0.75rem gap and a 3.5rem
          // pill); the variable clears the maintenance banner above it, and is
          // 0px when there is no banner.
          style={{ paddingTop: "calc(4.75rem + var(--maintenance-h, 0px))" }}
        >{children}</main>
        <Footer onContactClick={() => setContactModalOpen(true)} />
      </div>
      <ClientOnly>
        <ContactUsModal
          isOpen={isContactModalOpen}
          onClose={() => setContactModalOpen(false)}
        />
      </ClientOnly>
      {/* Finna for visitors who have no account yet. `variant="landing"` is what
          keeps it out of the books: no tools, no Council, no nudges, and the
          marketing system prompt. The /api/chat route already caps anonymous
          use by IP, so this cannot be driven into unbounded spend. */}
      <ClientOnly>
        <ChatbotWidget variant="landing" />
      </ClientOnly>
      {/* Instagram, X and LinkedIn in a column on the right, with Finna's
          bubble docked beneath it. Mounted here rather than globally so it is
          scoped to the marketing pages by construction — the dashboard never
          renders this layout. */}
      <ClientOnly>
        <SocialSidebar />
      </ClientOnly>
    </>
  );
}
