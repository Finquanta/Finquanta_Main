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

const SITE_URL = "https://finquanta.ai";

export const metadata: Metadata = {
  // Absolute base for every relative URL below (og:image and friends). Without
  // it Next guesses from the request host and warns on every build.
  metadataBase: new URL(SITE_URL),
  title: "Finquanta - AI-Powered Company Brain",
  description: "Finquanta is the AI-powered Company Brain for your business. It keeps your books, remembers every decision, and turns your numbers into answers you can act on.",
  // app/favicon.ico is served alongside this automatically. It used to be
  // Next's default triangle, which is what search results showed next to
  // Finquanta; it is now the F mark.
  icons: {
    icon: '/favicon.svg',
  },
  // 1200x600 JPEG (~60KB), downscaled from the 6912x3456 master PNG, which was
  // 7.7MB — far past what link-preview crawlers fetch comfortably. Dimensions
  // are declared so platforms can lay out the card without downloading first.
  // The PNG stays in /images so previews already cached against it still load.
  openGraph: {
    title: "Finquanta - AI-Powered Company Brain",
    description: "The AI-powered Company Brain that keeps your books and remembers why.",
    siteName: "Finquanta",
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
    description: "The AI-powered Company Brain that keeps your books and remembers why.",
    images: [{
      url: '/images/Finquanta_Metatag.jpg',
      width: 1200,
      height: 600,
      alt: 'Finquanta - AI-Powered Company Brain',
    }],
  },
};

/**
 * Who Finquanta is, in the form search engines read: the site's name, its logo
 * and its social profiles. It helps a search result show "Finquanta" with the
 * right logo, and keeps it apart from unrelated companies with similar names.
 */
const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Finquanta",
      url: SITE_URL,
      logo: `${SITE_URL}/images/Finquanta_Favicon.png`,
      sameAs: [
        "https://www.instagram.com/finquanta",
        "https://x.com/finquanta",
        "https://www.linkedin.com/company/finquanta/",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Finquanta",
      url: SITE_URL,
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("overflow-x-hidden", inter.className)} suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
        />
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
