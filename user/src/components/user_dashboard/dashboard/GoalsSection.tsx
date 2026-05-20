'use client';

import React, { useState } from 'react';
import ChevronDownIcon from '../icons/ChevronDownIcon';
import GoalModal from './GoalModal';

interface Goal {
  name: string;
  current: number;
  target: number;
  color: string;
}

const goals: Goal[] = [
  { name: 'Car', current: 9700, target: 15000, color: '#ff8600' },
  { name: 'Vacation', current: 0, target: 8000, color: '#150578' },
  { name: 'House', current: 0, target: 190000, color: '#034078' },
  { name: 'Shopping', current: 0, target: 13000, color: '#1282a2' }
];

function formatCurrency(amount: number) {
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)} 000`;
  }
  return `$${amount}`;
}

function getProgressPercentage(current: number, target: number) {
  return Math.min((current / target) * 100, 100);
}

export default function GoalsSection() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="bg-white p-6 rounded-[20px] border border-gray-200 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-medium text-[#1b263b]">Goals</h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-[#4CAF50] hover:bg-[#45a049] text-white text-xs font-bold px-4 py-2 rounded-lg"
          >
            + Add Goal
          </button>
          <div className="flex items-center text-[13px] font-medium text-[#778da9] gap-2">
            This month
            <ChevronDownIcon width={11} height={6} color="#778da9" />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="grid grid-cols-2 gap-x-8 gap-y-6">
          {goals.map((goal) => {
            const progressPercentage = getProgressPercentage(goal.current, goal.target);

            return (
              <div key={goal.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-medium text-[#0d1b2a]">{goal.name}</span>
                  <span className="text-xs text-[#778da9]">{formatCurrency(goal.target)}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${progressPercentage}%`, backgroundColor: goal.color }}
                  />
                </div>
                <p className="text-xs text-[#778da9]">{formatCurrency(goal.current)} saved</p>
              </div>
            );
          })}
        </div>
      </div>

      <GoalModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
