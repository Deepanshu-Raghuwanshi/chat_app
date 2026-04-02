import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profileService } from '../services/profile.service';
import { useAuthStore } from '../../auth/store/useAuthStore';
import { UserProfile } from '@shared-types';
import { toast } from 'sonner';

export const useProfile = () => {
  const setUser = useAuthStore((state) => state.setUser);
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: () => profileService.getProfile(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 3,
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: Parameters<typeof profileService.updateProfile>[0]) =>
      profileService.updateProfile(data),
    onSuccess: (updatedUser: UserProfile) => {
      setUser(updatedUser);
      queryClient.setQueryData(['profile'], updatedUser);
      toast.success('Profile updated successfully');
    },
    onError: () => {
      toast.error('Failed to update profile');
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: (file: File) => profileService.uploadAvatar(file),
    onSuccess: (data) => {
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        const updatedUser = { ...currentUser, avatarUrl: data.avatarUrl };
        setUser(updatedUser);
        queryClient.setQueryData(['profile'], updatedUser);
      }
      toast.success('Avatar updated successfully');
    },
    onError: () => {
      toast.error('Failed to upload avatar');
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
    isError: profileQuery.isError,
    updateProfile: updateProfileMutation.mutate,
    isUpdating: updateProfileMutation.isPending,
    uploadAvatar: uploadAvatarMutation.mutate,
    isUploading: uploadAvatarMutation.isPending,
    changeEmail: changeEmailMutation.mutate,
    isChangingEmail: changeEmailMutation.isPending,
    verifyEmailChange: verifyEmailChangeMutation.mutate,
    isVerifyingEmailChange: verifyEmailChangeMutation.isPending,
  };
};
