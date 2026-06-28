"use client";

import ClientOnly from "@/components/client-only";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { NavBarComponent } from "@/components/navbar";
import Footer from "@/components/layout/Footer";
import { useState } from "react";
import ContactUsModal from "@/components/contactUs";

const inter = Inter({ subsets: ["latin"] });

export default function BlogLayout({
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
