import React, { useRef } from 'react';
import { Camera } from 'lucide-react';
import { Avatar } from '../../../shared/components/ui/Avatar';
import { Spinner } from '../../../shared/components/ui/spinner';
import { useProfile } from '../hooks/useProfile';

const ProfileHeader = () => {
  const { profile, uploadAvatar, isUploading } = useProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadAvatar(file);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
        <Avatar
          avatarUrl={profile?.avatarUrl}
          fullName={profile?.fullName}
          username={profile?.username}
          size="xl"
          className="ring-4 ring-white shadow-lg transition-transform group-hover:scale-105"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
          {isUploading ? (
            <Spinner className="text-white w-8 h-8" />
          ) : (
            <Camera className="text-white w-8 h-8" />
          )}
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">{profile?.fullName || profile?.username}</h1>
        <p className="text-gray-500">@{profile?.username}</p>
      </div>
    </div>
  );
};

export { ProfileHeader };
