'use client';

import React from 'react';
import { useLogout } from '../../features/auth/hooks/useAuth';
import { useAuthStore } from '../../features/auth/store/useAuthStore';
import { LogOut, MessageSquare, Home, Users } from 'lucide-react';
import { Spinner } from './ui/spinner';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { cn } from '../utils/cn';

export const Navbar = () => {
  const { isAuthenticated, user } = useAuthStore();
  const { mutate: logout, isPending } = useLogout();
  const t = useTranslations('features.navbar');
  const pathname = usePathname();

  if (!isAuthenticated) return null;

  const navItems = [
    { icon: Home, label: t('home'), href: '/chat' },
    { icon: Users, label: t('friends'), href: '/friends' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 z-50 px-6">
      <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/chat" className="flex items-center gap-2 group" title={t('app_name')}>
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200",
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-gray-500")} />
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div 
            className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold text-sm uppercase"
            title={user?.fullName || user?.username || user?.email}
          >
            {(user?.email || user?.username || user?.fullName || '?')[0]}
          </div>
          
          <button
            onClick={() => logout()}
            disabled={isPending}
            className="flex items-center justify-center w-10 h-10 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all duration-200 border border-red-100"
            title={t('buttons.logout')}
          >
            {isPending ? (
              <Spinner className="w-4 h-4" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </nav>
  );
};
