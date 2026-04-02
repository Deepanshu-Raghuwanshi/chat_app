'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ProfileHeader } from '../../src/features/profile/components/ProfileHeader';
import { ProfileForm } from '../../src/features/profile/components/ProfileForm';
import { SecuritySection } from '../../src/features/profile/components/SecuritySection';
import { useProfile } from '../../src/features/profile/hooks/useProfile';
import { Spinner } from '../../src/shared/components/ui/spinner';

const ProfilePage = () => {
  const t = useTranslations('features.profile');
  const { isLoading } = useProfile();

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center pt-16">
        <Spinner className="w-12 h-12 text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50/50 pt-16 pb-12 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
          <p className="text-gray-500 mt-2">{t('subtitle')}</p>
        </header>

        <div className="space-y-8">
          <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <ProfileHeader />
          </section>

          <section>
            <ProfileForm />
          </section>

          <section>
            <SecuritySection />
          </section>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
