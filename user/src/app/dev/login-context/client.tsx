"use client";

import React from "react";
import LoginContextDemo from "@/hooks/examples/loginContextDemo";

/**
 * The actual dev tool. Split out from page.tsx so the production check in that
 * file can run on the server — a "use client" page cannot gate itself before
 * being served.
 */
export default function LoginContextDevClient() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <LoginContextDemo />
      </div>
    </div>
  );
}
