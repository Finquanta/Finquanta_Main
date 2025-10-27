import AiFocusSection from "@/components/pages/home/AiFocusSection";
import FaqSection from "@/components/pages/home/FaqSection";
import HeroSection from "@/components/pages/home/HeroSection";
import MobilePromoSection from "@/components/pages/home/MobilePromoSection";
import NewsletterSection from "@/components/pages/home/NewsletterSection";
import SocialConnectSection from "@/components/pages/home/SocialConnectSection";

export default function Home() {
  return (
    <main>
      <HeroSection />
      <AiFocusSection />
      <MobilePromoSection />
      <FaqSection />
      <NewsletterSection />
      <SocialConnectSection />
    </main>
  );
}
