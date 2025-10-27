import React from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const HeroSection = () => {
  return (
    <section className="container mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
      <div>
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-8 max-w-[1200px] mx-auto">
          {/* Left column: Content */}
          <div className="w-full md:w-1/2 h-full flex flex-col space-y-14 text-center md:text-left">
            <h1 className="text-3xl sm:text-4xl lg:text-6xl font-medium leading-tight text-gray-900">
              Transform Your Finances with AI Power!
            </h1>
            <p className="text-xl sm:text-2xl lg:text-3xl text-gray-600">
              Revolutionize your finances with our <br />
              AI-powered app. Effortlessly track <br />
              expenses, optimize investments, <br />
              and reach your goals—all in one <br />
              place.
            </p>
          </div>

          {/* Right column: Image */}
          <div className="w-full md:w-1/2 flex flex-col justify-center items-center">
            <Image
              src="/images/hero-flower-pot.svg"
              alt="Potted plant symbolizing financial growth"
              width={300}
              height={300}
              className="object-contain"
              priority
            />
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between w-full mt-10 max-w-[1200px] mx-auto">
          <div className="w-full md:w-1/2 flex justify-center items-center relative">
            <Input
              type="email"
              placeholder="Enter your email"
              className="w-full h-12 bg-gray-50 border border-gray-200 rounded-lg pl-10 pr-4 text-gray-700"
            />
            <Image
                src="/images/mail_icon.png"
                alt="Email icon"
                width={20}
                height={20}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-6 h-4"
              />
          </div>
          <div className="w-full md:w-1/2 flex justify-center items-center mt-4 md:mt-0">
            <Button
              variant="outline"
              className="h-12 w-[60%] text-green-600 border-2 border-green-600 hover:bg-green-50 rounded-lg px-6 font-bold"
            >
              Subscribe now
            </Button>
          </div>
        </div>
      </div>

      {/* Email signup */}
      {/* <div className="flex flex-col w-[60vw] sm:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-3 pt-4"></div> */}
      <div className="flex flex-col w-full sm:flex-row items-stretch space-y-3 sm:space-y-0 sm:space-x-3 pt-4 mt-6 max-w-[1200px] mx-auto">
        <p className="text-base sm:text-lg lg:text-xl text-gray-500 sm:ml-0">
          Sign up to Fiscal AI newsletter for all the latest news, trends and
          insights from our industry experts.
        </p>
      </div>
    </section>
  );
};

export default HeroSection;
