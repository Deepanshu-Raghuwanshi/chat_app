import React from 'react';
import { User, UserX, Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface FriendCardProps {
  userId: string;
  username?: string;
  fullName?: string;
  avatarUrl?: string;
  isIncomingRequest?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onRemove?: () => void;
}

export const FriendCard: React.FC<FriendCardProps> = ({
  userId,
  username,
  fullName,
  avatarUrl,
  isIncomingRequest,
  onAccept,
  onReject,
  onRemove,
}) => {
  const t = useTranslations('features.friends.buttons');

  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center overflow-hidden">
          {avatarUrl ? (
            <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
          ) : (
            <User className="w-6 h-6 text-primary" />
          )}
        </div>
        <div>
          <p className="font-semibold text-gray-900">{fullName || username || userId}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isIncomingRequest ? (
          <>
            <button
              onClick={onAccept}
              className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
              title={t('accept')}
            >
              <Check className="w-5 h-5" />
            </button>
            <button
              onClick={onReject}
              className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
              title={t('reject')}
            >
              <X className="w-5 h-5" />
            </button>
          </>
        ) : (
          <button
            onClick={onRemove}
            className="p-2 bg-gray-50 text-gray-400 rounded-lg hover:bg-gray-100 hover:text-red-500 transition-colors"
            title={t('remove')}
          >
            <UserX className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};
