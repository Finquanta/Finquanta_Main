'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface ClientSectionProps {
  data?: {
    name: string;
    company: string;
    avatarUrl: string;
  };
}

export default function ClientSection({ data }: ClientSectionProps) {
  if (!data) return null;

  const handleSendInvoice = () => {
    console.log('Sending invoice to client:', data.name);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <h3 className="font-medium text-[#0a112f] text-base">Client</h3>
      </CardHeader>
      
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="w-12 h-12">
              <AvatarImage src={data.avatarUrl} alt={data.name} />
              <AvatarFallback className="bg-orange-500 text-white font-semibold">
                {data.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
            <div>
              <div className="font-medium text-[#0a112f] text-base leading-tight">
                {data.name}
              </div>
              <div className="text-sm text-[#70707a] leading-tight">
                {data.company}
              </div>
            </div>
          </div>
          
          <Button
            className="bg-[#150578] hover:bg-[#150578]/90 text-white px-6 py-2 rounded-full text-sm font-medium"
            onClick={handleSendInvoice}
          >
            Send invoice
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}