'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Users, UserPlus, Search } from 'lucide-react';
import { cn } from '../../../shared/utils/cn';

interface SubNavbarProps {
  activeTab: 'friends' | 'requests' | 'search';
  onTabChange: (tab: 'friends' | 'requests' | 'search') => void;
  requestCount?: number;
}

export const SubNavbar = ({ activeTab, onTabChange, requestCount = 0 }: SubNavbarProps) => {
  const t = useTranslations('features.sub_navbar.friends');

  return (
    <div className="sticky top-16 z-40 w-full bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-4xl mx-auto px-6">
        <div className="flex items-center gap-8">
          <button
            onClick={() => onTabChange('friends')}
            title={t('friends_recs')}
            className={cn(
              "flex items-center justify-center py-4 transition-all relative",
              activeTab === 'friends' ? "text-primary" : "text-gray-500 hover:text-gray-900"
            )}
          >
            <Users className="w-5 h-5" />
            {activeTab === 'friends' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>

          <button
            onClick={() => onTabChange('requests')}
            title={t('requests')}
            className={cn(
              "flex items-center justify-center py-4 transition-all relative",
              activeTab === 'requests' ? "text-primary" : "text-gray-500 hover:text-gray-900"
            )}
          >
            <div className="relative">
              <UserPlus className="w-5 h-5" />
              {requestCount > 0 && (
                <span className="absolute -top-2 -right-2 px-1 py-0.5 bg-primary text-white text-[8px] font-bold rounded-full min-w-[14px] text-center border-2 border-white">
                  {requestCount}
                </span>
              )}
            </div>
            {activeTab === 'requests' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>

          <button
            onClick={() => onTabChange('search')}
            title={t('search')}
            className={cn(
              "flex items-center justify-center py-4 transition-all relative",
              activeTab === 'search' ? "text-primary" : "text-gray-500 hover:text-gray-900"
            )}
          >
            <Search className="w-5 h-5" />
            {activeTab === 'search' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
