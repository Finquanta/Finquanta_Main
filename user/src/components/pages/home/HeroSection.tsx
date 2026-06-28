"use client";
import React, { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/hooks/context/LanguageContext";

const HeroSection = () => {
  const { t } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState("");

  // Carry whatever they typed straight into signup (pre-filled email).
  const goToSignup = (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    router.push(value ? `/signup?email=${encodeURIComponent(value)}` : "/signup");
  };

  return (
    <section className="container mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-12 sm:pb-16">
      <div>
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6 sm:gap-8 max-w-[1200px] mx-auto">
          {/* Left column: Content */}
          <div className="w-full md:w-1/2 h-full flex flex-col space-y-8 sm:space-y-14 text-center md:text-left">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-medium leading-tight text-gray-900">
              {t("hero", "title")}
            </h1>
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-600 leading-relaxed">
              {t("hero", "description")}
            </p>
          </div>
          {/* Right column: Image */}
          <div className="w-full md:w-1/2 flex flex-col justify-center items-center">
            <Image
              src="/images/hero-flower-pot.png"
              alt="Potted plant symbolizing financial growth"
              width={300}
              height={300}
              className="object-contain w-56 sm:w-72 md:w-80 h-auto max-h-80"
              priority
            />
          </div>
        </div>
        <form onSubmit={goToSignup} className="flex flex-col sm:flex-row items-stretch gap-3 sm:gap-4 w-full mt-8 sm:mt-10 max-w-[1200px] mx-auto">
          <div className="flex-1 flex justify-center items-center relative">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("hero", "emailPlaceholder")}
              className="w-full h-12 bg-gray-200 border border-gray-300 rounded-lg pl-10 pr-4 text-gray-700 text-sm sm:text-base"
            />
            <Image
              src="/images/mail_icon.png"
              alt="Email icon"
              width={20}
              height={20}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 sm:w-6 h-3 sm:h-4"
            />
          </div>
          <div className="flex justify-center items-center">
            <Button
              type="submit"
              variant="outline"
              className="h-12 w-full sm:w-auto sm:min-w-[200px] text-white border-2 rounded-lg px-6 font-bold text-sm sm:text-base"
              style={{backgroundColor: '#4CAF50', borderColor: '#4CAF50'}}
            >
              {t("nav", "signUp")}
            </Button>
          </div>
        </form>
      </div>
      {/* Email signup */}
      <div className="flex flex-col w-full items-stretch space-y-3 pt-4 mt-4 sm:mt-6 max-w-[1200px] mx-auto">
        <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-500 text-center sm:text-left px-4 sm:px-0">
          {t("hero", "notice")}
        </p>
      </div>
    </section>
  );
};

export default HeroSection;