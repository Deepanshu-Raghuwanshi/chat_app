'use client';

import React, { useState, useEffect } from 'react';
import { useLogin, useForgotPassword } from '../hooks/useAuth';
import { useRouter } from 'next/navigation';
import { showToast } from '../../../shared/utils/toast';
import { Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react';
import { Spinner } from '../../../shared/components/ui/spinner';

export const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { mutate: login, isPending, error: loginError } = useLogin();
  const { mutate: forgotPassword, isPending: isForgotPasswordPending } = useForgotPassword();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (loginError) {
      const errorMsg = loginError && typeof loginError === 'object' && 'response' in loginError
        ? (loginError as { response: { data: { message: string } } }).response?.data?.message 
        : loginError instanceof Error ? loginError.message : 'Login failed';
      showToast.error('Login failed', errorMsg);
    }
  }, [loginError]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast.error('Missing fields', 'Please enter both email and password');
      return;
    }
    login({ email, password });
  };

  const handleGoogleLogin = () => {
    showToast.loading('Redirecting to Google...');
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/auth/google`;
  };

  const handleForgotPassword = () => {
    if (!email) {
      router.push('/forgot-password');
      return;
    }

    forgotPassword(email, {
      onSuccess: () => {
        showToast.success('Email sent', 'A password reset link has been sent to your email.');
      },
      onError: (error: any) => {
        const msg = error.response?.data?.message || 'Failed to send reset link';
        showToast.error('Error', msg);
      }
    });
  };

  if (!mounted) return null;

  return (
    <div className="flex items-center justify-center p-4">
      <div className="w-120 max-w-130 animate-in fade-in slide-up duration-500">
        <div className="bg-white rounded-2xl shadow-xl border border-blue-100 overflow-hidden">
          <div className="bg-gradient-to-r from-primary to-blue-600 p-8 text-center">
            <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
            <p className="text-blue-100">Sign in to your account</p>
          </div>

          <div className="p-8">
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email Field */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-foreground">Email Address</label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-3.5 w-5 h-5 text-foreground/40 group-focus-within:text-primary transition-colors" />
                  <input
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

              {/* Password Field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-foreground">Password</label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={isForgotPasswordPending}
                    className="text-xs text-primary hover:underline transition-colors disabled:opacity-50"
                  >
                    {isForgotPasswordPending ? 'Sending...' : 'Forgot?'}
                  </button>
                </div>
                <div className="relative group">
                  <Lock className="absolute left-3 top-3.5 w-5 h-5 text-foreground/40 group-focus-within:text-primary transition-colors" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
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

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isPending}
                className="w-full py-2.5 bg-gradient-to-r from-primary to-blue-600 text-white rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 font-semibold flex items-center justify-center gap-2 mt-6"
              >
                {isPending ? (
                  <>
                    <Spinner className="w-4 h-4" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white text-foreground/60">Or continue with</span>
              </div>
            </div>

            {/* Google Login */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isPending}
              className="w-full py-2.5 flex items-center justify-center border-2 border-border rounded-lg hover:bg-secondary transition-all duration-300 font-medium text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>

            {/* Sign Up Link */}
            <p className="text-center text-sm text-foreground/60 mt-6">
              Don't have an account?{' '}
              <button
                onClick={() => router.push('/signup')}
                className="text-primary font-semibold hover:underline transition-colors"
              >
                Sign Up
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
