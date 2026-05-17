'use client';

import React from 'react';
import { useAuthStore } from '../src/features/auth/store/useAuthStore';
import { ThemeToggle } from '../src/shared/components/ThemeToggle';

export const MainContent = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();

  return (
    <main className={`relative transition-all duration-300 ${isAuthenticated ? 'pt-16' : 'pt-0'}`}>
      {!isAuthenticated && (
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>
      )}
      {children}
    </main>
  );
};
