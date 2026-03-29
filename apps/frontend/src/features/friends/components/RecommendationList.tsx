'use client';

import React from 'react';
import { Sparkles, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface UserRecommendation {
  id: string;
  username: string;
  fullName?: string;
  avatarUrl?: string | null;
}

interface RecommendationListProps {
  recommendations?: UserRecommendation[];
  onSendRequest: (userId: string) => void;
}

export const RecommendationList = ({ recommendations, onSendRequest }: RecommendationListProps) => {
  const t = useTranslations('features.friends');

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-5 h-5 text-amber-500" />
        <h2 className="text-xl font-bold text-gray-900">{t('sections.recommended')}</h2>
      </div>
      
      {recommendations && recommendations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recommendations.map((user) => (
            <div key={user.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{user.fullName || user.username}</p>
                </div>
              </div>
              <button
                onClick={() => onSendRequest(user.id)}
                className="px-4 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dark transition-colors shadow-sm"
              >
                {t('buttons.add_friend')}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center p-8 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-gray-500 text-sm italic">{t('placeholders.no_recommendations')}</p>
        </div>
      )}
    </section>
  );
};
