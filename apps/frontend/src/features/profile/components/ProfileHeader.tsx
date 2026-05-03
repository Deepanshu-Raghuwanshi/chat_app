import React, { useRef } from 'react';
import { Camera } from 'lucide-react';
import { Avatar } from '../../../shared/components/ui/Avatar';
import { Spinner } from '../../../shared/components/ui/spinner';
import { useProfile } from '../hooks/useProfile';
import { useAuthStore } from '../../auth/store/useAuthStore';
import { cn } from '../../../shared/utils/cn';

const ProfileHeader = ({ userId }: { userId?: string }) => {
  const { profile, uploadAvatar, isUploading, isOwnProfile } = useProfile(userId);
  const { user: currentUser } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Use auth store data as fallback for own profile so initials show immediately
  // before the profile query resolves (avoids showing '?' on first render)
  const fallback = isOwnProfile ? currentUser : null;

  const handleAvatarClick = () => {
    if (isOwnProfile) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && isOwnProfile) {
      uploadAvatar(file);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div 
        className={cn(
          "relative group",
          isOwnProfile && "cursor-pointer"
        )} 
        onClick={handleAvatarClick}
      >
        <Avatar
          avatarUrl={profile?.avatarUrl ?? fallback?.avatarUrl}
          fullName={profile?.fullName ?? fallback?.fullName}
          username={profile?.username ?? fallback?.username}
          size="xl"
          className={cn(
            "ring-4 ring-white shadow-lg transition-transform",
            isOwnProfile && "group-hover:scale-105"
          )}
        />
        {isOwnProfile && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
            {isUploading ? (
              <Spinner className="text-white w-8 h-8" />
            ) : (
              <Camera className="text-white w-8 h-8" />
            )}
          </div>
        )}
        {isOwnProfile && (
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
        )}
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">{profile?.fullName || profile?.username}</h1>
        <p className="text-gray-500">@{profile?.username}</p>
      </div>
    </div>
  );
};

export { ProfileHeader };
