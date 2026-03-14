import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authService } from '../services/auth.service';
import { useAuthStore, UserProfile } from '../store/useAuthStore';
import { useRouter } from 'next/navigation';

export const useLogin = () => {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();

  return useMutation({
    mutationFn: (credentials: Record<string, string>) => authService.login(credentials),
    onSuccess: (userData: UserProfile) => {
      setUser(userData);
      queryClient.setQueryData(['profile'], userData);
      router.push('/chat');
    },
  });
};

export const useSignup = () => {
  return useMutation({
    mutationFn: (data: Record<string, string>) => authService.register(data),
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  const logoutStore = useAuthStore((state) => state.logout);
  const router = useRouter();

  return useMutation({
    mutationFn: () => authService.logout(),
    onSuccess: () => {
      logoutStore();
      queryClient.clear();
      router.push('/login');
    },
  });
};

export const useRefresh = () => {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();

  return useMutation({
    mutationFn: () => authService.refresh(),
    onSuccess: (userData: UserProfile) => {
      setUser(userData);
      queryClient.setQueryData(['profile'], userData);
      router.push('/chat');
    },
    onError: () => {
      router.push('/login');
    },
  });
};

export const useSetPassword = () => {
  return useMutation({
    mutationFn: (data: Record<string, string>) => authService.setPassword(data),
  });
};

export const useForgotPassword = () => {
  return useMutation({
    mutationFn: (email: string) => authService.forgotPassword(email),
  });
};

export const useResetPassword = () => {
  return useMutation({
    mutationFn: (data: Record<string, string>) => authService.resetPassword(data),
  });
};
