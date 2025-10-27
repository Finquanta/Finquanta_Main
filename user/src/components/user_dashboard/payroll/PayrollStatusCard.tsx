'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import PreviousPayrollIcon from '@/components/icons/PreviousPayrollIcon';
import UpcomingPayrollIcon from '@/components/icons/UpcomingPayrollIcon';
import { formatCurrency, formatDate, PaymentStatus } from '@/mockData/payrollMockData';

interface PayrollStatusCardProps {
  type: 'previous' | 'upcoming';
  data?: {
    amount: number;
    date: Date;
    status: PaymentStatus;
  };
}

export default function PayrollStatusCard({ type, data }: PayrollStatusCardProps) {
  if (!data) return null;

  const isPrevious = type === 'previous';
  const Icon = isPrevious ? PreviousPayrollIcon : UpcomingPayrollIcon;
  
  const getStatusStyles = (status: PaymentStatus) => {
    switch (status) {
      case PaymentStatus.PAID:
        return 'bg-[#ceefdf] text-[#0aaf60] border-0';
      case PaymentStatus.PENDING:
        return 'bg-[#feedda] text-[#faa745] border-0';
      default:
        return 'bg-gray-100 text-gray-800 border-0';
    }
  };

  const title = isPrevious ? 'Previous Payroll' : 'Upcoming Payroll';
  const dateText = isPrevious ? formatDate(data.date) : `June1, 2024`;

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-gray-50 rounded-lg flex-shrink-0">
            <Icon width={24} height={24} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-[#0a112f] text-base leading-tight">
                {title}
              </h3>
              <span className="text-base text-[#70707a] leading-tight">
                {dateText}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="text-4xl font-medium text-[#0a112f] tracking-tight">
                {formatCurrency(data.amount)}
              </div>
              
              <Badge 
                variant="secondary"
                className={`px-3 py-1 text-sm font-normal rounded-full ${getStatusStyles(data.status)}`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-current mr-2" />
                {data.status}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}