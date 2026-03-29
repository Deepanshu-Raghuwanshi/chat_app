'use client';

import React from 'react';
import { useLogout } from '../../features/auth/hooks/useAuth';
import { useAuthStore } from '../../features/auth/store/useAuthStore';
import { LogOut, MessageSquare } from 'lucide-react';
import { Spinner } from './ui/spinner';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export const Navbar = () => {
  const { isAuthenticated, user } = useAuthStore();
  const { mutate: logout, isPending } = useLogout();
  const t = useTranslations('features.navbar');

  if (!isAuthenticated) return null;

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 z-50 px-6">
      <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
        <Link href="/friends" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
            <MessageSquare className="w-5 h-5 text-primary" />
          </div>
          <span className="font-bold text-lg tracking-tight text-gray-900">{t('app_name')}</span>
        </Link>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end mr-2">
            <span className="text-sm font-semibold text-gray-900">{user?.fullName || user?.username || user?.email}</span>
            <span className="text-xs text-gray-500">{t('status.online')}</span>
          </div>
          
          <button
            onClick={() => logout()}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all duration-200 border border-red-100"
            title={t('buttons.logout')}
          >
            {isPending ? (
              <Spinner className="w-4 h-4" />
            ) : (
              <>
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">{t('buttons.logout')}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </nav>
  );
};
