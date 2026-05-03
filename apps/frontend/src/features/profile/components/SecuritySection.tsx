import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useProfile } from '../hooks/useProfile';
import { Spinner } from '../../../shared/components/ui/spinner';
import { useAuthStore } from '../../auth/store/useAuthStore';
import { Shield, Mail, Lock, ChevronRight } from 'lucide-react';
import Link from 'next/link';

const SecuritySection = ({ userId }: { userId?: string }) => {
  const t = useTranslations('features.profile');
  const { user } = useAuthStore();
  const { changeEmail, isChangingEmail } = useProfile(userId);
  const [newEmail, setNewEmail] = useState('');
  const [isChanging, setIsChanging] = useState(false);

  const handleEmailChange = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = newEmail.trim();
    if (trimmedEmail && trimmedEmail !== user?.email) {
      changeEmail(trimmedEmail);
      setIsChanging(false);
      setNewEmail('');
    }
  };

  const isEmailDirty = newEmail.trim() !== '' && newEmail.trim() !== user?.email;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim());
  const canSubmitEmail = isEmailDirty && isEmailValid && !isChangingEmail;

  return (
    <div className="space-y-6 bg-white p-6 rounded-xl shadow-sm border border-gray-100 mt-6">
      <div className="flex items-center gap-2 text-lg font-semibold text-gray-900 border-b pb-4">
        <Shield className="w-5 h-5 text-primary" />
        <h2>{t('sections.security')}</h2>
      </div>

      <div className="space-y-4">
        {/* Email Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-100 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">{t('fields.email')}</p>
              <p className="text-gray-500">{user?.email}</p>
            </div>
          </div>
          
          {!isChanging ? (
            <button
              onClick={() => setIsChanging(true)}
              className="px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
            >
              {t('buttons.change_email')}
            </button>
          ) : (
            <form onSubmit={handleEmailChange} className="flex items-center gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="New email address"
                className="px-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-primary/20"
                required
              />
              <button
                type="submit"
                disabled={!canSubmitEmail}
                className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isChangingEmail ? <Spinner className="w-4 h-4 text-white" /> : t('common.buttons.submit')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsChanging(false);
                  setNewEmail('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {t('common.buttons.cancel')}
              </button>
            </form>
          )}
        </div>

        {/* Password Section */}
        <Link 
          href="/forgot-password"
          className="flex items-center justify-between p-4 rounded-lg bg-gray-50 border border-gray-100 group transition-colors hover:bg-gray-100"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Lock className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">{t('buttons.change_password')}</p>
              <p className="text-gray-500">••••••••••••</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
        </Link>
      </div>
    </div>
  );
};

export { SecuritySection };
