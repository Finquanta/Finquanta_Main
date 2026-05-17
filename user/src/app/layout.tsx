import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AppProvider } from "@/hooks/context/SimpleAppProvider";
import { LanguageProvider } from "@/hooks/context/LanguageContext";
import { ThemeProvider } from "@/hooks/context/ThemeContext";
import SocialSidebar from "@/components/SocialSidebar";
import ChatbotWidget from "@/components/ChatbotWidget";

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
    <html lang="en" suppressHydrationWarning>
      <body className={cn("overflow-x-hidden", inter.className)} suppressHydrationWarning>
        <AppProvider enableDevMode={false}>
          <ThemeProvider>
            <LanguageProvider>
              {children}
              <SocialSidebar />
              <ChatbotWidget />
            </LanguageProvider>
          </ThemeProvider>
        </AppProvider>
      </body>
    </html>
  );
}