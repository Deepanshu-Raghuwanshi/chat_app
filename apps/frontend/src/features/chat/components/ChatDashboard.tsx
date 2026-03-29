'use client';

import React from 'react';
import { useAuthStore } from '../../auth/store/useAuthStore';
import { MessageSquare, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export const ChatDashboard = () => {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const t = useTranslations('features.chat.dashboard');

  return (
    <div className="min-h-screen bg-secondary flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-blue-100 animate-in fade-in slide-up duration-500">
        <div className="mb-6 flex justify-center">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
            <MessageSquare className="w-10 h-10 text-primary" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-foreground mb-4">
          {t('title')}
        </h1>
        
        <p className="text-foreground/70 mb-8 leading-relaxed">
          {t('greeting', { name: user?.fullName || user?.username || user?.email || 'there' })} 
          <br />
          {t('message')}
        </p>

        <div className="space-y-4">
          <button
            onClick={() => router.push('/friends')}
            className="w-full py-3 px-6 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all duration-300 font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
          >
            <Users className="w-5 h-5" />
            {t('button_friends')}
          </button>
        </div>
      </div>
      
      <p className="mt-8 text-sm text-foreground/40 font-medium tracking-wide uppercase">
        {t('coming_soon')}
      </p>
    </div>
  );
};
