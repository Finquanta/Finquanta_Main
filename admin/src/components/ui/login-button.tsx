import React from 'react';
import { Button } from '@/components/ui/button';

interface LoginButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function LoginButton({ onClick, disabled = false }: LoginButtonProps) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className="w-auto px-8 py-3 bg-login-blue hover:bg-login-blue/90 text-white font-semibold text-base leading-[19px] rounded-full border-0 transition-colors"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      LOGIN
    </Button>
  );
}