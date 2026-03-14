import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { authService } from '../services/auth.service';
import { useAuthStore, UserProfile } from '../store/useAuthStore';

export const useProfile = (options: Partial<UseQueryOptions<UserProfile>> = {}) => {
  const setUser = useAuthStore((state) => state.setUser);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return useQuery({
    queryKey: ['profile'],
    queryFn: () => authService.getProfile(),
    enabled: isAuthenticated,
    meta: {
      onSuccess: (data: UserProfile) => {
        setUser(data);
      },
    },
    ...options,
  } as UseQueryOptions<UserProfile>);
};
