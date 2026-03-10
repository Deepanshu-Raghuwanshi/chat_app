'use client';

import { Suspense } from 'react';
import { VerifyEmail } from '../../src/features/auth/components/VerifyEmail';

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Suspense fallback={<div>Loading...</div>}>
        <VerifyEmail />
      </Suspense>
    </div>
  );
}
