import React from 'react';
import SearchIcon from '@/components/icons/SearchIcon';
import ChevronRightIcon from '@/components/icons/ChevronRightIcon';

interface SettingsMenuProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const settingsItems = [
  { id: 'account-profile', label: 'Account and Profile' },
  { id: 'access-permission', label: 'Access and permission' },
  { id: 'languages', label: 'Languages Settings' },
  { id: 'notification-preference', label: 'Notification preference' },
  { id: 'data-privacy', label: 'Data and privacy' },
  { id: 'backup-recovery', label: 'Backup and recovery options' },
  { id: 'help-support', label: 'Help and support' },
  { id: 'log-out', label: 'Log out' },
];

export default function SettingsMenu({ activeSection, onSectionChange }: SettingsMenuProps) {
  return (
    <div className="bg-[#e7e7e7] p-6 h-full">
      <h2 className="text-2xl font-medium text-black mb-6">Settings</h2>
      
      {/* Search */}
      <div className="relative mb-8">
        <div className="relative border border-black rounded-lg">
          <input
            type="text"
            placeholder="search"
            className="w-full pl-4 pr-10 py-2 bg-transparent text-sm font-medium text-black placeholder-black focus:outline-none"
          />
          <SearchIcon 
            width={18} 
            height={18} 
            color="#000000" 
            className="absolute right-3 top-1/2 transform -translate-y-1/2" 
          />
        </div>
      </div>

      {/* Settings Menu Items */}
      <nav className="space-y-8">
        {settingsItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onSectionChange(item.id)}
            className={`w-full flex items-center justify-between text-left text-sm font-medium transition-colors ${
              activeSection === item.id
                ? 'text-white bg-[#150578] px-3 py-2 rounded'
                : 'text-black hover:text-gray-700'
            }`}
          >
            {item.label}
            <ChevronRightIcon 
              width={8} 
              height={14} 
              color={activeSection === item.id ? '#ffffff' : '#101010'} 
            />
          </button>
        ))}
      </nav>
    </div>
  );
}