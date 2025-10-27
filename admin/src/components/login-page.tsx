'use client';

import React from 'react';
import { LoginForm } from '@/components/login-form';
import Image from 'next/image';

export function LoginPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/login-background.png"
          alt="Login Background"
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <LoginForm />
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 left-0 right-0 z-10">
        <div className="text-center">
          <p 
            className="text-base font-normal leading-[19px] text-white"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Fiscal Asset Group Ltd. © 2024 - Administration Portal
          </p>
        </div>
      </div>
    </div>
  );
}