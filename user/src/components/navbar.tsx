"use client";
import Image from "next/image";
import Link from "next/link";
import { Button } from "./ui/button";
import HamburgerMenu from "./ui/HamburgerMenu";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/hooks/context/LanguageContext";

export function NavBarComponent() {
  const router = useRouter();
  const { language, setLanguage, t } = useLanguage();

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: "smooth" });
    } else {
      router.push(`/#${id}`);
    }
  };

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/60 shadow-sm overflow-x-hidden">
      <div className="container mx-auto px-2 sm:px-4 lg:px-8">
        <div className="h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center">
              <Image src="/images/finquanta_logo.svg" width={96} height={96} alt="Finquanta Logo" className="w-20 sm:w-28 md:w-36 h-auto" />
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
            <button onClick={() => scrollToSection("features")} className="text-gray-700 hover:text-gray-900 text-base font-medium bg-transparent border-none cursor-pointer">{t("nav", "features")}</button>
            <button onClick={() => scrollToSection("faq")} className="text-gray-700 hover:text-gray-900 text-base font-medium bg-transparent border-none cursor-pointer">{t("nav", "faqs")}</button>
            <button onClick={() => scrollToSection("newsletter")} className="text-gray-700 hover:text-gray-900 text-base font-medium bg-transparent border-none cursor-pointer">{t("nav", "newsletter")}</button>
            <button onClick={() => scrollToSection("community")} className="text-gray-700 hover:text-gray-900 text-base font-medium bg-transparent border-none cursor-pointer">{t("nav", "community")}</button>
            <Link href="/blog" className="text-gray-700 hover:text-gray-900 text-base font-medium">{t("nav", "blog")}</Link>
          </div>

          {/* Action Buttons + Language Selector */}
          <div className="hidden md:flex items-center space-x-3">
            {/* Language Selector */}
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white text-gray-700 cursor-pointer"
            >
              <option value="en">🇬🇧 EN</option>
              <option value="es">🇪🇸 ES</option>
              <option value="fr">🇫🇷 FR</option>
              <option value="pt">🇵🇹 PT</option>
              <option value="ar">🇸🇦 AR</option>
              <option value="zh">🇨🇳 ZH</option>
              <option value="ja">🇯🇵 JA</option>
              <option value="ru">🇷🇺 RU</option>
              <option value="nl">🇳🇱 NL</option>
              <option value="de">🇩🇪 DE</option>
            </select>

            <Link href="https://calendly.com/YOUR_CALENDLY_LINK_HERE" target="_blank">
              <Button variant="default" className="bg-[#2196F3] hover:bg-[#1e88e5] text-white rounded-lg px-5 py-2">
                {t("nav", "scheduleDemo")}
              </Button>
            </Link>
            <Link href="/signup">
              <Button variant="default" className="bg-[#4CAF50] hover:bg-[#45a049] text-white rounded-lg px-5 py-2">
                {t("nav", "signUp")}
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" className="bg-gray-50 hover:bg-gray-100 text-[#4CAF50] rounded-lg px-5 py-2">
                {t("nav", "login")}
              </Button>
            </Link>
          </div>

          {/* Hamburger menu for mobile */}
          <div className="md:hidden flex items-center">
            <HamburgerMenu />
          </div>
        </div>
      </div>
    </nav>
  );
}