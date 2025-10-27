'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { InputField } from '@/components/ui/input-field';
import { LoginButton } from '@/components/ui/login-button';
import Image from 'next/image';

export function LoginForm() {
  const [email, setEmail] = useState('hello@fiscal.host');
  const [password, setPassword] = useState('******');

  const handleLogin = () => {
    console.log('Login attempted with:', { email, password });
  };

  return (
    <Card className="w-[479px] bg-white rounded-[10px] shadow-lg border-0 p-0">
      <CardContent className="p-10 space-y-8">
        {/* Logo and Title */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <Image
              src="/fiscal-ai-logo.png"
              alt="FISCAL AI"
              width={329}
              height={52}
              className="object-contain"
            />
          </div>
          <h1 
            className="text-[28px] font-medium leading-[34px] text-black"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Administration Portal
          </h1>
        </div>

        {/* Form Fields */}
        <div className="space-y-5">
          <InputField
            type="email"
            label="Email"
            value={email}
            placeholder="hello@fiscal.host"
            onChange={setEmail}
          />
          
          <InputField
            type="password"
            label="Password"
            value={password}
            placeholder="******"
            onChange={setPassword}
          />
        </div>

        {/* Login Button */}
        <div className="flex justify-center pt-4">
          <LoginButton onClick={handleLogin} />
        </div>

        {/* Forgot Password Link */}
        <div className="text-center">
          <button 
            className="text-base font-medium leading-[19px] text-login-blue hover:text-login-blue/80 transition-colors"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Forgot password?
          </button>
        </div>
      </CardContent>
    </Card>
  );
}