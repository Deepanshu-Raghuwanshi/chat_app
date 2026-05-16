import apiClient from "../../../shared/lib/apiClient";
import { UserProfile } from "@shared-types";

export const profileService = {
  async getProfile(userId?: string): Promise<UserProfile> {
    const url = userId ? `/profile/${userId}` : "/profile";
    const response = await apiClient.get<UserProfile>(url);
    return response.data;
  },

  async updateProfile(data: {
    fullName?: string;
    bio?: string;
    phoneNumber?: string;
    countryCode?: string;
    status?: string;
    theme?: "light" | "dark";
  }): Promise<UserProfile> {
    const response = await apiClient.patch<UserProfile>("/profile", data);
    return response.data;
  },

  async uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.post<{ avatarUrl: string }>(
      "/profile/avatar",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return response.data;
  },

  async changeEmail(newEmail: string) {
    const response = await apiClient.post("/auth/change-email", { newEmail });
    return response.data;
  },

  async verifyEmailChange(token: string, newEmail: string) {
    const response = await apiClient.post("/auth/verify-email-change", {
      token,
      newEmail,
    });
    return response.data;
  },
};
