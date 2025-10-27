import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./../globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Auth Fiscal AI",
  description:
    "Fiscal AI is modern monry management platform powered by AI. Track expenses, optimize investments, and reach your goals—all in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <div className={cn(" ", inter.className)}>{children}</div>
    </>
  );
}
