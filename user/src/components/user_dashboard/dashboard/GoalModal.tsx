'use client';
import React, { useState } from 'react';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function GoalModal({ isOpen, onClose }: GoalModalProps) {
  const [form, setForm] = useState({ goalName: '', description: '', goalAmount: '' });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[#1a1a2e] text-white rounded-2xl p-8 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-2xl font-bold mb-6">Enter Goal</h2>

        <label className="block text-sm font-semibold mb-1">Goal Name</label>
        <input className="w-full bg-[#2a2a3e] rounded-lg px-4 py-2 mb-4 text-sm outline-none" placeholder="Goal"
          value={form.goalName} onChange={(e) => setForm({ ...form, goalName: e.target.value })} />

        <label className="block text-sm font-semibold mb-1">Description</label>
        <input className="w-full bg-[#2a2a3e] rounded-lg px-4 py-2 mb-4 text-sm outline-none" placeholder="Text Here"
          value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

        <label className="block text-sm font-semibold mb-1">Goal Amount</label>
        <input className="w-full bg-[#2a2a3e] rounded-lg px-4 py-2 mb-6 text-sm outline-none" placeholder="Enter Value" type="number"
          value={form.goalAmount} onChange={(e) => setForm({ ...form, goalAmount: e.target.value })} />

        <button className="w-full bg-[#4CAF50] hover:bg-[#45a049] text-white font-bold py-3 rounded-full"
          onClick={() => { console.log(form); onClose(); }}>
          Enter Data
        </button>
      </div>
    </div>
  );
}