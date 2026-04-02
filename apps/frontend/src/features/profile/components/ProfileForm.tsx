import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useProfile } from '../hooks/useProfile';
import { Spinner } from '../../../shared/components/ui/spinner';

const ProfileForm = ({ userId }: { userId?: string }) => {
  const t = useTranslations('features.profile');
  const { profile, updateProfile, isUpdating, isOwnProfile } = useProfile(userId);
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
    if (!isOwnProfile) return;
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwnProfile) return;
    
    // Trim values before submission
    const trimmedData = {
      fullName: formData.fullName.trim(),
      bio: formData.bio.trim(),
      status: formData.status.trim(),
      phoneNumber: formData.phoneNumber.trim(),
      countryCode: formData.countryCode.trim(),
    };

    updateProfile(trimmedData);
  };

  const isFormDirty = () => {
    if (!profile || !isOwnProfile) return false;
    return (
      formData.fullName.trim() !== (profile.fullName || '') ||
      formData.bio.trim() !== (profile.bio || '') ||
      formData.status.trim() !== (profile.status || '') ||
      formData.phoneNumber.trim() !== (profile.phoneNumber || '') ||
      formData.countryCode.trim() !== (profile.countryCode || '')
    );
  };

  const isFormValid = () => {
    // Basic validation: Full name cannot be empty or just spaces
    return formData.fullName.trim().length > 0;
  };

  const canUpdate = isOwnProfile && isFormDirty() && isFormValid() && !isUpdating;

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
            className="block w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none disabled:bg-gray-50 disabled:text-gray-500"
            required
            disabled={!isOwnProfile}
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
            className="block w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none disabled:bg-gray-50 disabled:text-gray-500"
            disabled={!isOwnProfile}
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
            className="block w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none resize-none disabled:bg-gray-50 disabled:text-gray-500"
            disabled={!isOwnProfile}
          />
        </div>
      </div>

      {isOwnProfile && (
        <div className="pt-4 flex justify-end">
          <button
            type="submit"
            disabled={!canUpdate}
            className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isUpdating && <Spinner className="w-4 h-4 text-white" />}
            {t('buttons.update')}
          </button>
        </div>
      )}
    </form>
  );
};

export { ProfileForm };
