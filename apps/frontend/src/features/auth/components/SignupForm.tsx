'use client';

import React, { useState, useEffect } from 'react';
import { useSignup } from '../hooks/useAuth';
import { useRouter } from 'next/navigation';
import { showToast } from '../../../shared/utils/toast';
import { Eye, EyeOff, Mail, Lock, CheckCircle, ArrowRight } from 'lucide-react';
import { Spinner } from '../../../shared/components/ui/spinner';

export const SignupForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const { mutate: signup, isPending, isSuccess, error: signupError } = useSignup();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isSuccess) {
      showToast.success('Account created!', `Verification email sent to ${email}`);
    }
  }, [isSuccess, email]);

  useEffect(() => {
    if (signupError) {
      const errorMsg = signupError && typeof signupError === 'object' && 'response' in signupError
        ? (signupError as { response: { data: { message: string } } }).response?.data?.message
        : signupError instanceof Error ? signupError.message : 'Signup failed';
      showToast.error('Signup failed', errorMsg);
    }
  }, [signupError]);

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      const msg = 'Passwords do not match';
      showToast.error('Password mismatch', msg);
      return;
    }
    if (password.length < 6) {
      const msg = 'Password must be at least 6 characters';
      showToast.error('Weak password', msg);
      return;
    }
    signup({ email, password });
  };

  if (!mounted) return null;

  if (isSuccess) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="w-120 max-w-130 animate-in slide-up duration-500">
          <div className="bg-white rounded-2xl shadow-xl border border-blue-100 overflow-hidden">
            <div className="bg-gradient-to-r from-primary to-blue-600 p-6 text-center">
              <div className="flex justify-center mb-4">
                <CheckCircle className="w-16 h-16 text-white animate-bounce" />
              </div>
              <h2 className="text-2xl font-bold text-white">Verify Your Email</h2>
            </div>
            <div className="p-8 text-center">
              <p className="text-foreground/70 mb-2">A verification link has been sent to</p>
              <p className="text-lg font-semibold text-primary mb-6 break-all">{email}</p>
              <p className="text-sm text-foreground/60 mb-8">
                Click the link in the email to activate your account and sign in.
              </p>
              <button
                onClick={() => router.push('/login')}
                className="w-full py-3 bg-gradient-to-r from-primary to-blue-600 text-white rounded-lg hover:shadow-lg transition-all duration-300 flex items-center justify-center gap-2 font-medium"
              >
                Go to Login
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-4">
      <div className="w-120 max-w-130 animate-in fade-in slide-up duration-500">
        <div className="bg-white rounded-2xl shadow-xl border border-blue-100 overflow-hidden">
          <div className="bg-gradient-to-r from-primary to-blue-600 p-8 text-center">
            <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
            <p className="text-blue-100">Join us and get started</p>
          </div>

          <div className="p-8">
            <form onSubmit={handleSignup} className="space-y-5">
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
                <label className="block text-sm font-semibold text-foreground">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-3.5 w-5 h-5 text-foreground/40 group-focus-within:text-primary transition-colors" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
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

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-foreground">Confirm Password</label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-3.5 w-5 h-5 text-foreground/40 group-focus-within:text-primary transition-colors" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    className="w-full pl-10 pr-10 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all duration-200 bg-white"
                    required
                    disabled={isPending}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-3 text-foreground/40 hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
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
                    Creating account...
                  </>
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Sign In Link */}
            <p className="text-center text-sm text-foreground/60 mt-6">
              Already have an account?{' '}
              <button
                onClick={() => router.push('/login')}
                className="text-primary font-semibold hover:underline transition-colors"
              >
                Sign In
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
