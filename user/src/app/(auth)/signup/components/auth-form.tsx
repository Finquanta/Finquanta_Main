"use client";

import * as React from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2Icon, MailIcon, AlertTriangleIcon, CheckIcon } from "lucide-react";

interface UserAuthFormProps extends React.HTMLAttributes<HTMLDivElement> {}

export function UserAuthForm({ className, ...props }: UserAuthFormProps) {
  // Form states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [step, setStep] = useState<'email' | 'verification'>('email');
  const [email, setEmail] = useState<string>('');
  const [emailError, setEmailError] = useState<boolean>(false);
  const [emailValid, setEmailValid] = useState<boolean>(false);
  const [verificationCode, setVerificationCode] = useState<string[]>(['', '', '', '']);
  const [codeError, setCodeError] = useState<boolean>(false);
  const [codeErrorMessage, setCodeErrorMessage] = useState<string>('');
  
  // Email validation
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Handle email input
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    
    if (value.length > 0) {
      if (validateEmail(value)) {
        setEmailError(false);
        setEmailValid(true);
      } else {
        setEmailError(true);
        setEmailValid(false);
      }
    } else {
      setEmailError(false);
      setEmailValid(false);
    }
  };

  // Handle email submission
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailValid) return;
    setIsLoading(true);
    setEmailError(false);
    try {
      const res = await fetch("/api/v1/core/request-email-verification/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailError(true);
        setEmailValid(false);
        // Optionally show error message from backend
        return;
      }
      setStep('verification');
    } catch (error) {
      setEmailError(true);
      setEmailValid(false);
      console.error('Error sending verification code:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle verification code input
  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.slice(0, 1);
    }
    
    if (!/^\d*$/.test(value)) {
      return;
    }
    
    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);
    setCodeError(false);
    
    // Auto-focus to next input
    if (value && index < 3) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      nextInput?.focus();
    }
    
    // Submit automatically when all digits are filled
    if (value && index === 3 && newCode.every(digit => digit)) {
      handleVerificationSubmit();
    }
  };

  // Handle verification code submission
  const handleVerificationSubmit = async () => {
    const code = verificationCode.join('');
    if (code.length !== 4) return;
    setIsLoading(true);
    setCodeError(false);
    try {
      // You may want to collect username/password/other fields here
      // For demo, use email as username and a default password
      const res = await fetch("/api/v1/core/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: email,
          email,
          password: "changeme123", // TODO: collect from user
          password2: "changeme123", // TODO: collect from user
          verification_code: code
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCodeError(true);
        setCodeErrorMessage(data?.verification_code || data?.message || "Registration failed");
        return;
      }
      // Registration successful, redirect or show success
      window.location.href = '/dashboard';
    } catch (error) {
      setCodeError(true);
      setCodeErrorMessage("Network error. Please try again.");
      console.error('Error verifying code:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle paste for verification code
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const digits = pastedData.match(/\d/g)?.slice(0, 4);
    
    if (digits && digits.length) {
      const newCode = [...verificationCode];
      
      for (let i = 0; i < 4; i++) {
        if (i < digits.length) {
          newCode[i] = digits[i];
        }
      }
      
      setVerificationCode(newCode);
      
      // Focus on the appropriate input
      if (digits.length < 4) {
        const nextInput = document.getElementById(`code-${digits.length}`);
        nextInput?.focus();
      } else {
        handleVerificationSubmit();
      }
    }
  };

  // Handle backspace for verification code
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      // Move focus to previous input when backspace is pressed on an empty input
      const prevInput = document.getElementById(`code-${index - 1}`);
      prevInput?.focus();
    }
  };

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      {step === 'email' ? (
        // Email input step
        <>
          {/* Social login options */}
          <div className="grid gap-3">
            <p className="text-sm text-center">Sign up with your Google account</p>
            <div className="grid grid-cols-2 gap-4">
              <Button variant="outline" type="button" className="flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18.1711 8.36788H17.4998V8.33329H9.99984V11.6666H14.7094C14.0223 13.6071 12.1761 15.0001 9.99984 15.0001C7.23869 15.0001 4.99984 12.7613 4.99984 10.0001C4.99984 7.23895 7.23869 5.00008 9.99984 5.00008C11.2744 5.00008 12.434 5.48167 13.3169 6.26507L15.6744 3.90758C14.1844 2.52206 12.1948 1.66675 9.99984 1.66675C5.39775 1.66675 1.6665 5.39799 1.6665 10.0001C1.6665 14.6022 5.39775 18.3334 9.99984 18.3334C14.6019 18.3334 18.3332 14.6022 18.3332 10.0001C18.3332 9.44028 18.2757 8.89416 18.1711 8.36788Z" fill="#FBC02D"/>
                  <path d="M2.6286 6.36019L5.36485 8.36269C6.10401 6.46269 7.90068 5.00008 10.0003 5.00008C11.2749 5.00008 12.4344 5.48167 13.3173 6.26507L15.6748 3.90758C14.1848 2.52206 12.1953 1.66675 10.0003 1.66675C6.82964 1.66675 4.10026 3.57373 2.6286 6.36019Z" fill="#E93131"/>
                  <path d="M9.99984 18.3334C12.1511 18.3334 14.1057 17.505 15.5836 16.17L13.0078 13.9876C12.1556 14.6552 11.0946 15.0001 9.99984 15.0001C7.83359 15.0001 5.99317 13.6176 5.29775 11.6926L2.58301 13.7826C4.03817 16.5384 6.79317 18.3334 9.99984 18.3334Z" fill="#4CAF50"/>
                  <path d="M18.1711 8.36788H17.4998V8.33329H9.99984V11.6666H14.7094C14.3869 12.5897 13.8264 13.3893 13.0073 13.9883L13.0086 13.9875L15.5844 16.1699C15.4049 16.3316 18.3332 14.1666 18.3332 10.0001C18.3332 9.44028 18.2757 8.89416 18.1711 8.36788Z" fill="#1976D2"/>
                </svg>
                Google
              </Button>
              <Button variant="outline" type="button" className="flex items-center gap-2">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15.7943 10.5581C15.7726 8.91697 16.788 7.67964 18.8333 6.79797C17.7217 5.26381 16.0461 4.43464 13.8688 4.28797C11.8024 4.14797 9.51305 5.51964 8.86638 5.51964C8.17055 5.51964 6.11722 4.34797 4.64388 4.34797C1.92055 4.39131 0 6.19797 0 9.08797C0 10.0846 0.173883 11.1213 0.521883 12.1946C1.01472 13.7263 3.19222 17.9963 5.46055 17.9213C6.55722 17.8846 7.31055 17.0913 8.77388 17.0913C10.1861 17.0913 10.8826 17.9213 12.1077 17.9213C14.4016 17.8846 16.3581 14.0213 16.8206 12.4846C13.6333 10.9329 13.7943 10.6413 15.7943 10.5581ZM12.871 3.32797C13.7616 2.32131 13.6696 1.39297 13.6333 0.988308C12.8833 1.02631 12.0133 1.44964 11.5033 1.95131C10.936 2.49131 10.4703 3.25131 10.5996 4.24131C11.4288 4.30797 12.1973 4.13297 12.871 3.32797Z" fill="black"/>
                </svg>
                Apple ID
              </Button>
            </div>
          </div>

          {/* Email input form */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">Or continue with email address</span>
            </div>
          </div>

          <form onSubmit={handleEmailSubmit}>
            <div className="grid gap-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <MailIcon className="h-5 w-5 text-gray-400" />
                </div>
                {emailError && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <AlertTriangleIcon className="h-5 w-5 text-red-500" />
                  </div>
                )}
                {emailValid && (
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <CheckIcon className="h-5 w-5 text-green-500" />
                  </div>
                )}
                <Input
                  type="email"
                  id="email"
                  value={email}
                  onChange={handleEmailChange}
                  className={cn(
                    "pl-10 pr-10 py-2",
                    emailError ? "border-red-500 focus:border-red-500" : "",
                    emailValid ? "border-green-500 focus:border-green-500" : ""
                  )}
                  placeholder="Your email"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect="off"
                  disabled={isLoading}
                />
              </div>
              <Button 
                type="submit" 
                disabled={isLoading || !emailValid}
                className={cn(
                  "bg-blue-500 hover:bg-blue-600 text-white",
                  (!emailValid || isLoading) ? "opacity-70" : ""
                )}
              >
                {isLoading && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
                Continue
              </Button>
            </div>
          </form>
        </>
      ) : (
        // Verification code step
        <form onSubmit={(e) => { e.preventDefault(); handleVerificationSubmit(); }}>
          <div className="grid gap-6">
            <p className="text-center text-sm text-gray-600">
              Please input the verification code sent to your email
            </p>
            
            {/* Verification code inputs */}
            <div className="flex justify-center gap-2">
              {[0, 1, 2, 3].map((index) => (
                <Input
                  key={index}
                  id={`code-${index}`}
                  type="text"
                  value={verificationCode[index]}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  className={cn(
                    "w-14 h-14 text-center text-xl font-medium",
                    codeError && index === 3 ? "border-red-500 bg-red-100" : "",
                    verificationCode.every(v => v) && !codeError ? "border-green-200 bg-green-100" : ""
                  )}
                  disabled={isLoading}
                  maxLength={1}
                />
              ))}
            </div>
            
            {/* Error message */}
            {codeError && (
              <p className="text-center text-sm text-red-500">{codeErrorMessage}</p>
            )}
            
            <Button 
              type="submit" 
              disabled={isLoading || verificationCode.some(digit => !digit)}
              className={cn(
                "bg-blue-500 hover:bg-blue-600 text-white",
                (verificationCode.some(digit => !digit) || isLoading) ? "opacity-70" : ""
              )}
            >
              {isLoading && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
              Continue
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
