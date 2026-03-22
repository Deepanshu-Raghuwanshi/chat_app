'use client';

import { Suspense } from 'react';
import { SetPasswordForm } from '../../src/features/auth/components/SetPasswordForm';
import { Spinner } from '../../src/shared/components/ui/spinner';

export default function SetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary p-4">
      <Suspense fallback={<Spinner className="w-10 h-10 text-primary" />}>
        <SetPasswordForm />
      </Suspense>
    </div>
  );
}
