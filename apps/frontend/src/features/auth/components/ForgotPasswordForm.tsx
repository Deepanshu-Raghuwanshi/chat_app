'use client';

import React, { useState, useEffect } from 'react';
import { useForgotPassword } from '../hooks/useAuth';
import { useRouter } from 'next/navigation';
import { showToast } from '../../../shared/utils/toast';
import { Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import { Spinner } from '../../../shared/components/ui/spinner';

export const ForgotPasswordForm = () => {
  const [email, setEmail] = useState('');
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { mutate: forgotPassword, isPending, isSuccess, error } = useForgotPassword();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (error) {
      const errorMsg = error && typeof error === 'object' && 'response' in error
        ? (error as { response: { data: { message: string } } }).response?.data?.message 
        : error instanceof Error ? error.message : 'Something went wrong';
      showToast.error('Request failed', errorMsg);
    }
  }, [error]);

  useEffect(() => {
    if (isSuccess) {
      showToast.success('Email sent', 'If an account exists, you will receive a reset link.');
    }
  }, [isSuccess]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      showToast.error('Missing field', 'Please enter your email address');
      return;
    }
    forgotPassword(email);
  };

  if (!mounted) return null;

  return (
    <div className="flex items-center justify-center p-4">
      <div className="w-120 max-w-130 animate-in fade-in slide-up duration-500">
        <div className="bg-white rounded-2xl shadow-xl border border-blue-100 overflow-hidden">
          <div className="bg-gradient-to-r from-primary to-blue-600 p-8 text-center">
            <h1 className="text-3xl font-bold text-white mb-2">Reset Password</h1>
            <p className="text-blue-100">We'll send you a link to reset your password</p>
          </div>

          <div className="p-8">
            {isSuccess ? (
              <div className="text-center space-y-6 py-4">
                <div className="bg-green-50 border border-green-100 p-4 rounded-xl text-green-800 text-sm">
                  Check your inbox for a password reset link. It will expire in 30 minutes.
                </div>
                <button
                  onClick={() => router.push('/login')}
                  className="text-primary font-semibold hover:underline flex items-center justify-center gap-2 mx-auto"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                <div className="space-y-2">
                  <label htmlFor="email" className="block text-sm font-semibold text-foreground">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-3.5 w-5 h-5 text-foreground/40 group-focus-within:text-primary transition-colors" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all duration-200 bg-white"
                      required
                      disabled={isPending}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-2.5 bg-gradient-to-r from-primary to-blue-600 text-white rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 font-semibold flex items-center justify-center gap-2"
                >
                  {isPending ? (
                    <>
                      <Spinner className="w-4 h-4" />
                      Sending Link...
                    </>
                  ) : (
                    <>
                      Send Reset Link
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => router.push('/login')}
                  className="w-full py-2 flex items-center justify-center gap-2 text-sm text-foreground/60 hover:text-primary transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Login
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
