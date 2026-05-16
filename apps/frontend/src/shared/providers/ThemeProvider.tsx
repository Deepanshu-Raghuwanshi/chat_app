"use client";

import { useEffect } from "react";
import { useAuthStore } from "../../features/auth/store/useAuthStore";
import { useThemeStore } from "../store/useThemeStore";

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const user = useAuthStore((state) => state.user);
  const setTheme = useThemeStore((s) => s.setTheme);

  useEffect(() => {
    const profileTheme = user?.theme;
    if (profileTheme && profileTheme !== useThemeStore.getState().theme) {
      setTheme(profileTheme);
    }
  }, [user, setTheme]);

  return <>{children}</>;
};
