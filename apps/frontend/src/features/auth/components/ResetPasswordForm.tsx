'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useResetPassword } from '../hooks/useAuth';
import { showToast } from '../../../shared/utils/toast';
import { Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { Spinner } from '../../../shared/components/ui/spinner';

export const ResetPasswordForm = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const { mutate: resetPasswordMutation, isPending } = useResetPassword();

  useEffect(() => {
    if (!token) {
      showToast.error('Invalid link', 'No token provided in the URL');
      router.push('/login');
    }
  }, [token, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      showToast.error('Passwords mismatch', 'Passwords do not match');
      return;
    }

    if (password.length < 8) {
      showToast.error('Weak password', 'Password must be at least 8 characters long');
      return;
    }

    if (token) {
      resetPasswordMutation(
        { token, password },
        {
          onSuccess: () => {
            setIsSuccess(true);
            showToast.success('Success', 'Your password has been reset successfully');
            setTimeout(() => router.push('/login'), 3000);
          },
          onError: (error: any) => {
            const msg = error.response?.data?.message || 'Failed to reset password';
            showToast.error('Error', msg);
          }
        }
      );
    }
  };

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-blue-100 text-center animate-in fade-in zoom-in duration-500">
          <div className="mb-6 flex justify-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">Password Reset!</h2>
          <p className="text-foreground/60 mb-6">
            Your password has been successfully updated. You can now log in with your new password.
          </p>
          <p className="text-sm text-primary animate-pulse">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-xl border border-blue-100 animate-in fade-in slide-up duration-500">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Reset Your Password</h1>
          <p className="text-foreground/60">Enter a new password for your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">New Password</label>
            <div className="relative group">
              <Lock className="absolute left-3 top-3.5 w-5 h-5 text-foreground/40 group-focus-within:text-primary transition-colors" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all duration-200 bg-white"
                required
                disabled={isPending}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-foreground/40 hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-foreground">Confirm Password</label>
            <div className="relative group">
              <Lock className="absolute left-3 top-3.5 w-5 h-5 text-foreground/40 group-focus-within:text-primary transition-colors" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-10 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all duration-200 bg-white"
                required
                disabled={isPending}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 bg-gradient-to-r from-primary to-blue-600 text-white rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 font-semibold flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <Spinner className="w-4 h-4" />
                Resetting password...
              </>
            ) : (
              'Reset Password'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
