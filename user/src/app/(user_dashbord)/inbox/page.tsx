import React from 'react';

export default function InboxPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Inbox</h1>
      <div className="space-y-4">
        <p className="text-gray-600">Welcome to your inbox.</p>
        <div className="grid gap-4">
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <h2 className="font-semibold mb-2">No messages yet</h2>
            <p className="text-sm text-gray-500">Your inbox is empty. Check back later for new messages.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
