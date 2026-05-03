import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileService } from '../services/profile.service';
import { useAuthStore } from '../../auth/store/useAuthStore';
import { UserProfile } from '@shared-types';
import { toast } from 'sonner';

export const useProfile = (userId?: string) => {
  const { user: currentUser, setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const isOwnProfile = !userId || userId === currentUser?.id;

  const profileQuery = useQuery({
    queryKey: ['profile', userId || currentUser?.id],
    queryFn: () => profileService.getProfile(userId),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3,
    enabled: !!(userId || currentUser?.id),
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: Parameters<typeof profileService.updateProfile>[0]) => {
      if (!isOwnProfile) throw new Error('Cannot update another user\'s profile');
      return profileService.updateProfile(data);
    },
    onSuccess: (updatedUser: UserProfile) => {
      setUser(updatedUser);
      queryClient.setQueryData(['profile', currentUser?.id], updatedUser);
      toast.success('Profile updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update profile');
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: (file: File) => {
      if (!isOwnProfile) throw new Error('Cannot update another user\'s avatar');
      return profileService.uploadAvatar(file);
    },
    onSuccess: (data) => {
      if (currentUser) {
        const updatedUser = { ...currentUser, avatarUrl: data.avatarUrl };
        setUser(updatedUser);
        queryClient.setQueryData(['profile', currentUser.id], updatedUser);
      }
      toast.success('Avatar updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload avatar');
    },
  });

  const changeEmailMutation = useMutation({
    mutationFn: (newEmail: string) => profileService.changeEmail(newEmail),
    onSuccess: () => {
      toast.success('Verification email sent to new address');
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Failed to request email change');
    },
  });

  const verifyEmailChangeMutation = useMutation({
    mutationFn: ({ token, newEmail }: { token: string; newEmail: string }) =>
      profileService.verifyEmailChange(token, newEmail),
    onSuccess: () => {
      toast.success('Email updated successfully');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (error: { response?: { data?: { message?: string } } }) => {
      toast.error(error.response?.data?.message || 'Failed to verify email change');
    },
  });

  return {
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    isPending: profileQuery.isPending,
    isError: profileQuery.isError,
    updateProfile: updateProfileMutation.mutate,
    updateProfileAsync: updateProfileMutation.mutateAsync,
    isUpdating: updateProfileMutation.isPending,
    uploadAvatar: uploadAvatarMutation.mutate,
    isUploading: uploadAvatarMutation.isPending,
    changeEmail: changeEmailMutation.mutate,
    isChangingEmail: changeEmailMutation.isPending,
    verifyEmailChange: verifyEmailChangeMutation.mutate,
    isVerifyingEmailChange: verifyEmailChangeMutation.isPending,
    isOwnProfile,
  };
};
