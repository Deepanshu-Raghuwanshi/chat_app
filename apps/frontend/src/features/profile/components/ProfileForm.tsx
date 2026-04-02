import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useProfile } from '../hooks/useProfile';
import { Spinner } from '../../../shared/components/ui/spinner';

const ProfileForm = () => {
  const t = useTranslations('features.profile');
  const { profile, updateProfile, isUpdating } = useProfile();
  const [formData, setFormData] = useState({
    fullName: '',
    bio: '',
    status: '',
    phoneNumber: '',
    countryCode: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        fullName: profile.fullName || '',
        bio: profile.bio || '',
        status: profile.status || '',
        phoneNumber: profile.phoneNumber || '',
        countryCode: profile.countryCode || '',
      });
    }
  }, [profile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <h2 className="text-lg font-semibold text-gray-900 border-b pb-4">{t('sections.basic_info')}</h2>
      
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
            {t('fields.fullName')}
          </label>
          <input
            type="text"
            id="fullName"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            placeholder={t('placeholders.fullName')}
            className="block w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="status" className="block text-sm font-medium text-gray-700">
            {t('fields.status')}
          </label>
          <input
            type="text"
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            placeholder={t('placeholders.status')}
            className="block w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
          />
        </div>

        <div className="sm:col-span-2 space-y-1">
          <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
            {t('fields.bio')}
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={3}
            value={formData.bio}
            onChange={handleChange}
            placeholder={t('placeholders.bio')}
            className="block w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none"
          />
        </div>
      </div>

      <div className="pt-4 flex justify-end">
        <button
          type="submit"
          disabled={isUpdating}
          className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium disabled:opacity-50"
        >
          {isUpdating && <Spinner className="w-4 h-4 text-white" />}
          {t('buttons.update')}
        </button>
      </div>
    </form>
  );
};

export { ProfileForm };
