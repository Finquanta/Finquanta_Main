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
  // 1200x600 JPEG (~60KB), downscaled from the 6912x3456 master PNG, which was
  // 7.7MB — far past what link-preview crawlers fetch comfortably. Dimensions
  // are declared so platforms can lay out the card without downloading first.
  // The PNG stays in /images so previews already cached against it still load.
  openGraph: {
    title: "Finquanta - AI-Powered Company Brain",
    description: "The AI-powered company brain that keeps your books and remembers why.",
    images: [{
      url: '/images/Finquanta_Metatag.jpg',
      width: 1200,
      height: 600,
      alt: 'Finquanta - AI-Powered Company Brain',
      type: 'image/jpeg',
    }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: "Finquanta - AI-Powered Company Brain",
    description: "The AI-powered company brain that keeps your books and remembers why.",
    images: [{
      url: '/images/Finquanta_Metatag.jpg',
      width: 1200,
      height: 600,
      alt: 'Finquanta - AI-Powered Company Brain',
    }],
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
