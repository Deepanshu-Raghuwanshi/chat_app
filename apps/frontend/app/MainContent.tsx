'use client';

import React from 'react';
import { useAuthStore } from '../src/features/auth/store/useAuthStore';

export const MainContent = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();

  return (
    <main className={`relative transition-all duration-300 ${isAuthenticated ? 'pt-16' : 'pt-0'}`}>
      {children}
    </main>
  );
};
