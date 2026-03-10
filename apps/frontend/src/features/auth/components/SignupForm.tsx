'use client';

import React, { useState } from 'react';
import { useSignup } from '../hooks/useAuth';
import { useRouter } from 'next/navigation';

export const SignupForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const router = useRouter();
  const { mutate: signup, isPending, isSuccess, error: signupError } = useSignup();

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return setLocalError('Passwords do not match');
    }
    setLocalError('');
    signup({ email, password });
  };

  const error = localError || (signupError && typeof signupError === 'object' && 'response' in signupError
    ? (signupError as { response: { data: { message: string } } }).response?.data?.message
    : signupError instanceof Error ? signupError.message : '');

  if (isSuccess) {
    return (
      <div className="max-w-md w-full mx-auto p-6 bg-white rounded-lg shadow-md text-center">
        <h2 className="text-2xl font-bold mb-4 text-green-600">Check Your Email</h2>
        <p className="text-gray-600 mb-6">
          A verification link has been sent to <strong>{email}</strong>. 
          Please verify your email to log in.
        </p>
        <button
          onClick={() => router.push('/login')}
          className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md w-full mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">Create Account</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 border rounded-md focus:ring-blue-500"
            required
            disabled={isPending}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2 border rounded-md focus:ring-blue-500"
            required
            disabled={isPending}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-2 border rounded-md focus:ring-blue-500"
            required
            disabled={isPending}
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
        >
          {isPending ? 'Signing up...' : 'Sign Up'}
        </button>
      </form>
    </div>
  );
};
