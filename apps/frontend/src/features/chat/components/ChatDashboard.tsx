'use client';

import React from 'react';
import { useLogout } from '../../auth/hooks/useAuth';
import { useAuthStore } from '../../auth/store/useAuthStore';
import { LogOut, MessageSquare, Users } from 'lucide-react';
import { Spinner } from '../../../shared/components/ui/spinner';
import { useRouter } from 'next/navigation';

export const ChatDashboard = () => {
  const user = useAuthStore((state) => state.user);
  const { mutate: logout, isPending } = useLogout();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-secondary flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-blue-100 animate-in fade-in slide-up duration-500">
        <div className="mb-6 flex justify-center">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
            <MessageSquare className="w-10 h-10 text-primary" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-foreground mb-4">
          Welcome to Chat App!
        </h1>
        
        <p className="text-foreground/70 mb-8 leading-relaxed">
          Hello, <span className="font-semibold text-primary">{user?.fullName || user?.username || user?.email || 'there'}</span>! 
          We are currently setting things up. The full chat experience will be starting soon.
        </p>

        <div className="space-y-4">
          <button
            onClick={() => router.push('/friends')}
            className="w-full py-3 px-6 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all duration-300 font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
          >
            <Users className="w-5 h-5" />
            Go to Friends
          </button>

          <button
            onClick={() => logout()}
            disabled={isPending}
            className="w-full py-3 px-6 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all duration-300 font-semibold flex items-center justify-center gap-2 group border border-red-100"
          >
            {isPending ? (
              <Spinner className="w-5 h-5" />
            ) : (
              <>
                <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                Sign Out
              </>
            )}
          </button>
        </div>
      </div>
      
      <p className="mt-8 text-sm text-foreground/40 font-medium tracking-wide uppercase">
        Coming Soon • Version 2.0
      </p>
    </div>
  );
};
