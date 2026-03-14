import axios from 'axios';
import { UserProfile } from '../store/useAuthStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

export const authService = {
  async login(credentials: Record<string, string>): Promise<UserProfile> {
    const response = await apiClient.post<UserProfile>('/auth/login', credentials);
    return response.data;
  },

  async register(data: Record<string, string>): Promise<UserProfile> {
    const response = await apiClient.post<UserProfile>('/auth/register', data);
    return response.data;
  },

  async logout() {
    const response = await apiClient.post('/auth/logout');
    return response.data;
  },

  async refresh() {
    const response = await apiClient.post('/auth/refresh');
    return response.data;
  },

  async verifyEmail(token: string) {
    const response = await apiClient.get(`/auth/verify-email?token=${token}`);
    return response.data;
  },

  async setPassword(data: Record<string, string>) {
    const response = await apiClient.post('/auth/set-password', data);
    return response.data;
  },

  async getProfile() {
    const response = await apiClient.get('/profile');
    return response.data;
  },
};

export default apiClient;
