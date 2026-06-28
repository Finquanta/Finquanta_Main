import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AppProvider } from "@/hooks/context/SimpleAppProvider";
import { LanguageProvider } from "@/hooks/context/LanguageContext";
import { ThemeProvider } from "@/hooks/context/ThemeContext";
import GlobalLoadingIndicator from "@/components/GlobalLoadingIndicator";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Finquanta - AI Powered Finance",
  description: "Finquanta AI is modern money management platform powered by AI. Track expenses, optimize investments, and reach your goals all in one place.",
icons: {
  icon: '/favicon.svg',
},
  openGraph: {
    title: "Finquanta - AI Powered Finance",
    description: "Finquanta AI is modern money management platform powered by AI.",
    images: '/images/Finquanta_Metatag.png',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Finquanta - AI Powered Finance",
    description: "Finquanta AI is modern money management platform powered by AI.",
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
              {children}
              <GlobalLoadingIndicator />
            </LanguageProvider>
          </ThemeProvider>
        </AppProvider>
      </body>
    </html>
  );
}
