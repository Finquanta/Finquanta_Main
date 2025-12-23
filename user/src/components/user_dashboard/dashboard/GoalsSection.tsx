import React from 'react';
import ChevronDownIcon from '../icons/ChevronDownIcon';

interface Goal {
    name: string;
    current: number;
    target: number;
    color: string;
}

export default function GoalsSection() {
    const goals: Goal[] = [
        { name: 'Car', current: 9700, target: 15000, color: '#ff8600' },
        { name: 'Vacation', current: 0, target: 8000, color: '#150578' },
        { name: 'House', current: 0, target: 190000, color: '#034078' },
        { name: 'shopping', current: 0, target: 13000, color: '#1282a2' },
    ];

    const formatCurrency = (amount: number) => {
        if (amount >= 1000) {
            return `$${(amount / 1000).toFixed(0)} 000`;
        }
        return `$${amount}`;
    };

    const getProgressPercentage = (current: number, target: number) => {
        return Math.min((current / target) * 100, 100);
    };

    return (
        <div className="bg-white p-6 rounded-[20px] border border-gray-200 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-medium text-[#1b263b]">Goals</h3>
                <div className="flex items-center text-[13px] font-medium text-[#778da9] gap-2">
                    This month
                    <ChevronDownIcon width={11} height={6} color="#778da9" />
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                    {goals.map((goal, index) => {
                        const progressPercentage = getProgressPercentage(goal.current, goal.target);

                        return (
                            <div key={goal.name} className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[15px] font-medium text-[#0d1b2a]">{goal.name}</span>
                                </div>

                                <div className="flex items-center justify-between text-[13px] font-medium text-[#778da9]">
                                    <span>$0</span>
                                    <span>{formatCurrency(goal.target)}</span>
                                </div>

                                {/* Progress bar */}
                                <div className="relative w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className="h-2 rounded-full transition-all duration-300"
                                        style={{
                                            width: `${progressPercentage}%`,
                                            backgroundColor: goal.color
                                        }}
                                    ></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Bottom note */}
            <div className="mt-6">
                <p className="text-[13px] font-normal text-[#778da9]">
                    This month you saved 5% more than the previous month. Use the{' '}
                    <span className="text-[#ff8600] font-medium underline cursor-pointer">
                        Savings
                    </span>{' '}
                    service to achieve your goals faster
                </p>
            </div>
        </div>
    );
}