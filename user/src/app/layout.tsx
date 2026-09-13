import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AppProvider } from "@/hooks/context/SimpleAppProvider";
import { LanguageProvider } from "@/hooks/context/LanguageContext";
import { ThemeProvider } from "@/hooks/context/ThemeContext";
import GlobalLoadingIndicator from "@/components/GlobalLoadingIndicator";
import MaintenanceBanner from "@/components/MaintenanceBanner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Finquanta - AI-Powered Company Brain",
  description: "Finquanta is the AI-powered company brain for your business. It keeps your books, remembers every decision, and turns your numbers into answers you can act on.",
icons: {
  icon: '/favicon.svg',
},
  openGraph: {
    title: "Finquanta - AI-Powered Company Brain",
    description: "The AI-powered company brain that keeps your books and remembers why.",
    images: '/images/Finquanta_Metatag.png',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Finquanta - AI-Powered Company Brain",
    description: "The AI-powered company brain that keeps your books and remembers why.",
    images: '/images/Finquanta_Metatag.png',
  },
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
              <MaintenanceBanner />
              {children}
              <GlobalLoadingIndicator />
            </LanguageProvider>
          </ThemeProvider>
        </AppProvider>
      </body>
    </html>
  );
}
