import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NavBarComponent } from "@/components/navbar";
import { cn } from "@/lib/utils";
import Footer from "@/components/layout/Footer";
import { AppProvider } from "@/hooks/context/SimpleAppProvider";
import { LanguageProvider } from "@/hooks/context/LanguageContext";
import BookkeepingModal from '@/components/user_dashboard/bookkeeping/BookkeepingModal';
import GoalModal from '@/components/user_dashboard/dashboard/GoalModal';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Finquanta AI",
  description: "Finquanta AI is modern money management platform powered by AI. Track expenses, optimize investments, and reach your goals all in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={cn("overflow-x-hidden ", inter.className)}>
        <AppProvider enableDevMode={process.env.NODE_ENV === 'development'}>
          <LanguageProvider>
            {children}
          </LanguageProvider>
        </AppProvider>
      </body>
    </html>
  );
}