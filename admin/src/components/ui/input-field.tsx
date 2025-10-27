import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import UserIcon from '@/components/icons/UserIcon';
import LockIcon from '@/components/icons/LockIcon';
import EyeIcon from '@/components/icons/EyeIcon';

interface InputFieldProps {
  type: 'email' | 'password';
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}

export function InputField({ type, label, value, placeholder, onChange }: InputFieldProps) {
  const [showPassword, setShowPassword] = useState(false);
  
  const inputType = type === 'password' && showPassword ? 'text' : type;
  
  return (
    <div className="w-full">
      <div className="relative bg-black/8 rounded-t-[4px] px-3 py-3">
        <div className="flex items-center gap-[14px]">
          <div className="flex-shrink-0">
            {type === 'email' ? (
              <UserIcon width={19} height={20} color="#000000" />
            ) : (
              <LockIcon width={19} height={24} color="#000000" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <Label 
              htmlFor={type}
              className="block text-xs font-normal text-black/60 leading-[14px] tracking-[0.40px] mb-1"
              style={{ fontFamily: 'Roboto, sans-serif' }}
            >
              {label}
            </Label>
            <Input
              id={type}
              type={inputType}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="border-0 bg-transparent p-0 h-auto text-base font-normal text-black/87 leading-6 tracking-[0.15px] placeholder:text-black/87 focus-visible:ring-0 focus-visible:ring-offset-0"
              style={{ fontFamily: 'Roboto, sans-serif' }}
            />
          </div>
          {type === 'password' && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="flex-shrink-0 p-1 hover:bg-black/5 rounded transition-colors"
            >
              <EyeIcon width={22} height={15} color="rgba(0, 0, 0, 0.60)" />
            </button>
          )}
        </div>
      </div>
      <div 
        className={`h-0.5 border-t border-black ${
          type === 'email' ? 'bg-login-blue-light' : 'bg-[rgba(44,102,190,0.60)]'
        }`}
      />
    </div>
  );
}