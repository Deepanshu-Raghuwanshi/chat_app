'use client';

import React, { useState } from 'react';
import { useLogin } from '../hooks/useAuth';

export const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { mutate: login, isPending, error: loginError } = useLogin();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    login({ email, password });
  };

  const handleGoogleLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/auth/google`;
  };

  const error = loginError && typeof loginError === 'object' && 'response' in loginError
    ? (loginError as { response: { data: { message: string } } }).response?.data?.message 
    : loginError instanceof Error ? loginError.message : '';

  return (
    <div className="max-w-md w-full mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      <form onSubmit={handleLogin} className="space-y-4">
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
        <button
          type="submit"
          disabled={isPending}
          className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50"
        >
          {isPending ? 'Logging in...' : 'Login'}
        </button>
      </form>
      <div className="mt-6">
        <button
          onClick={handleGoogleLogin}
          className="w-full py-2 flex items-center justify-center border border-gray-300 rounded-md hover:bg-gray-50 transition"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 mr-2" />
          Login with Google
        </button>
      </div>
    </div>
  );
};
