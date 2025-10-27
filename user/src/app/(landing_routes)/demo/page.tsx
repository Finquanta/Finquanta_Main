"use client";

import React from "react";
import LoginContextDemo from "@/hooks/examples/loginContextDemo";

/**
 * Demo page showcasing the login context integration
 * Accessible at /demo
 */
export default function DemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <LoginContextDemo />
      </div>
    </div>
  );
}
