'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import SendInvoiceIcon from '@/components/icons/SendInvoiceIcon';
import { formatDate, formatTime, formatCurrency, TransactionStatus } from '@/mockData/payrollMockData';

interface TransactionData {
  id: string;
  employeeName: string;
  company: string;
  date: Date;
  time: Date;
  amount: number;
  invoiceDate: Date;
  status: TransactionStatus;
  avatarUrl: string;
}

interface TransactionHistoryProps {
  data?: TransactionData[];
}

export default function TransactionHistory({ data }: TransactionHistoryProps) {
  if (!data || data.length === 0) return null;

  const handleSendInvoice = (transactionId: string) => {
    console.log('Sending invoice for transaction:', transactionId);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-medium text-[#0a112f]">Transaction History</h3>
          <Button variant="ghost" size="sm" className="text-[#3981f7] hover:text-[#3981f7]/80 p-0 h-auto font-normal">
            See All
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-6">
          {data.map((transaction, index) => (
            <div key={transaction.id} className="flex items-center gap-4">
              {/* Avatar and Employee Info */}
              <div className="flex items-center gap-4 flex-1">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={transaction.avatarUrl} alt={transaction.employeeName} />
                  <AvatarFallback className="bg-orange-500 text-white font-semibold">
                    {transaction.employeeName.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1">
                  <div className="font-medium text-[#0a112f] text-base leading-tight">
                    {transaction.employeeName}
                  </div>
                  <div className="text-sm text-[#70707a] leading-tight">
                    {transaction.company}
                  </div>
                </div>
              </div>

              {/* Date and Time */}
              <div className="text-center min-w-[100px]">
                <div className="font-medium text-[#0a112f] text-base leading-tight">
                  {formatDate(transaction.date)}
                </div>
                <div className="text-sm text-[#70707a] leading-tight">
                  {formatTime(transaction.time)}
                </div>
              </div>

              {/* Amount */}
              <div className="text-right min-w-[120px]">
                <div className="font-medium text-[#0a112f] text-lg leading-tight">
                  <span className="text-lg">{formatCurrency(Math.floor(transaction.amount))}</span>
                  <span className="text-sm text-[#9096a2]">
                    .{(transaction.amount % 1).toFixed(2).slice(2)}
                  </span>
                </div>
                <div className="text-sm text-[#70707a] leading-tight">
                  {formatDate(transaction.invoiceDate)}
                </div>
              </div>

              {/* Send Invoice Button */}
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 px-3 py-2 h-11 border-[#e4e4e7] hover:bg-gray-50"
                onClick={() => handleSendInvoice(transaction.id)}
              >
                <SendInvoiceIcon width={16} height={16} />
                <span className="text-sm font-medium text-[#0a112f]">Send Invoice</span>
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}