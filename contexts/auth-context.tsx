// contexts/auth-context.tsx
// Token-first auth (unlike heydream-app's AsyncStorage-only pattern): the
// bearer token lives in secure storage (api/client.ts), this context just
// tracks the signed-in user object in memory + a lightweight mirror in
// secure storage so a cold app start can restore the session without a
// round trip before first paint. Goes through api/secure-storage.ts rather
// than expo-secure-store directly -- its web build has no implementation
// at all, so calling it straight breaks the web preview.

import React, { createContext, useContext, useEffect, useState } from "react";
import * as secureStorage from "../api/secure-storage";
import * as api from "../api/client";

const USER_KEY = "heydream_visa_user";

export interface VisaUser {
  id: number | string;
  full_name: string;
  email: string;
  title?: string;
  dob?: string;
  country?: string;
  phone?: string;
  profile_pic?: string;
}

interface AuthContextType {
  user: VisaUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  loginWithGoogle: (idToken: string) => Promise<{ success: boolean; message?: string }>;
  register: (
    fullName: string,
    email: string,
    password: string,
    phone?: string
  ) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<VisaUser>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<VisaUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [token, storedUser] = await Promise.all([
          api.getToken(),
          secureStorage.getItem(USER_KEY),
        ]);
        if (token && storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Any API call that comes back "Unauthorized"/"Please sign in." (stale or
  // expired token) should drop the local session immediately, instead of
  // leaving `user` populated while every subsequent request keeps failing.
  useEffect(() => {
    api.registerAuthFailureHandler(() => {
      api.clearToken();
      secureStorage.removeItem(USER_KEY);
      setUser(null);
    });
  }, []);

  const login: AuthContextType["login"] = async (email, password) => {
    const result = await api.login(email, password);
    if (result.success && result.token) {
      await api.setToken(result.token);
      await secureStorage.setItem(USER_KEY, JSON.stringify(result.user));
      setUser(result.user);
      return { success: true };
    }
    return { success: false, message: result.message || "Login failed" };
  };

  const loginWithGoogle: AuthContextType["loginWithGoogle"] = async (idToken) => {
    const result = await api.googleLogin(idToken);
    if (result.success && result.token) {
      await api.setToken(result.token);
      await secureStorage.setItem(USER_KEY, JSON.stringify(result.user));
      setUser(result.user);
      return { success: true };
    }
    return { success: false, message: result.message || "Google sign-in failed" };
  };

  const register: AuthContextType["register"] = async (fullName, email, password, phone) => {
    const result = await api.register(fullName, email, password, phone);
    return { success: !!result.success, message: result.message };
  };

  const logout = async () => {
    await api.clearToken();
    await secureStorage.removeItem(USER_KEY);
    setUser(null);
  };

  const updateUser = async (patch: Partial<VisaUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      secureStorage.setItem(USER_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, loginWithGoogle, register, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
