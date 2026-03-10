'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { authService } from '../services/auth.service';

export const VerifyEmail = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (token) {
      authService.verifyEmail(token)
        .then(() => {
          setStatus('success');
          setMessage('Email verified! You can now log in.');
        })
        .catch((err: unknown) => {
          setStatus('error');
          const errorMessage = err && typeof err === 'object' && 'response' in err
            ? (err as { response: { data: { message: string } } }).response?.data?.message
            : err instanceof Error ? err.message : 'Verification failed. Link may be expired.';
          setMessage(errorMessage);
        });
    } else {
      setStatus('error');
      setMessage('Invalid verification link.');
    }
  }, [token]);

  return (
    <div className="max-w-md w-full mx-auto p-6 bg-white rounded-lg shadow-md text-center">
      <h2 className="text-2xl font-bold mb-4">Email Verification</h2>
      
      {status === 'loading' && <p className="text-gray-600">Verifying your email...</p>}
      
      {status === 'success' && (
        <>
          <p className="text-green-600 mb-6 font-medium">{message}</p>
          <button
            onClick={() => router.push('/login')}
            className="w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            Go to Login
          </button>
        </>
      )}

      {status === 'error' && (
        <>
          <p className="text-red-500 mb-6 font-medium">{message}</p>
          <button
            onClick={() => router.push('/signup')}
            className="w-full py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
          >
            Try Signing Up Again
          </button>
        </>
      )}
    </div>
  );
};
