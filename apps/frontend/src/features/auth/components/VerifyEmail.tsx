'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { authService } from '../services/auth.service';
import { showToast } from '../../../shared/utils/toast';
import { CheckCircle, XCircle, Clock, ArrowRight, RotateCcw } from 'lucide-react';

export const VerifyEmail = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link.');
      showToast.error('Invalid link', 'Verification link is missing');
      return;
    }

    const verifyEmail = async () => {
      try {
        await authService.verifyEmail(token);
        setStatus('success');
        setMessage('Email verified! You can now log in.');
        showToast.success('Email verified', 'Your email has been successfully verified');
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } catch (err: unknown) {
        setStatus('error');
        const errorMessage = err && typeof err === 'object' && 'response' in err
          ? (err as { response: { data: { message: string } } }).response?.data?.message
          : err instanceof Error ? err.message : 'Verification failed. Link may be expired.';
        setMessage(errorMessage);
        showToast.error('Verification failed', errorMessage);
      }
    };

    verifyEmail();
  }, [token, router]);

  if (!mounted) return null;

  return (
    <div className="flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-in fade-in slide-up duration-500">
        <div className="bg-white rounded-2xl shadow-xl border border-blue-100 overflow-hidden">
          {status === 'loading' && (
            <>
              <div className="bg-gradient-to-r from-primary to-blue-600 p-8 text-center">
                <div className="flex justify-center mb-4">
                  <Clock className="w-16 h-16 text-white animate-spin" />
                </div>
                <h2 className="text-2xl font-bold text-white">Verifying Email</h2>
              </div>
              <div className="p-8 text-center">
                <p className="text-foreground/70 mb-4">Please wait while we verify your email...</p>
                <div className="flex justify-center gap-1">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-8 text-center">
                <div className="flex justify-center mb-4">
                  <CheckCircle className="w-16 h-16 text-white animate-bounce" />
                </div>
                <h2 className="text-2xl font-bold text-white">Email Verified</h2>
              </div>
              <div className="p-8 text-center">
                <p className="text-foreground/70 mb-2">Great! Your email has been verified.</p>
                <p className="text-sm text-foreground/60 mb-8">You can now log in to your account.</p>
                <button
                  onClick={() => router.push('/login')}
                  className="w-full py-3 bg-gradient-to-r from-primary to-blue-600 text-white rounded-lg hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2 font-medium"
                >
                  Go to Login
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="bg-gradient-to-r from-destructive to-red-600 p-8 text-center">
                <div className="flex justify-center mb-4">
                  <XCircle className="w-16 h-16 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">Verification Failed</h2>
              </div>
              <div className="p-8 text-center">
                <p className="text-foreground/70 mb-2">Something went wrong</p>
                <p className="text-sm text-foreground/60 mb-8">{message}</p>
                <div className="space-y-3">
                  <button
                    onClick={() => router.push('/signup')}
                    className="w-full py-3 bg-gradient-to-r from-primary to-blue-600 text-white rounded-lg hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2 font-medium"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Try Signing Up Again
                  </button>
                  <button
                    onClick={() => router.push('/login')}
                    className="w-full py-3 border-2 border-primary text-primary rounded-lg hover:bg-blue-50 transition-all duration-300 font-medium"
                  >
                    Back to Login
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
