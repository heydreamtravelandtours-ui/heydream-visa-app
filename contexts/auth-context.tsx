// contexts/auth-context.tsx
// Token-first auth (unlike heydream-app's AsyncStorage-only pattern): the
// bearer token lives in SecureStore (api/client.ts), this context just
// tracks the signed-in user object in memory + a lightweight mirror in
// SecureStore so a cold app start can restore the session without a round
// trip before first paint.

import React, { createContext, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import * as api from "../api/client";

const USER_KEY = "heydream_visa_user";

export interface VisaUser {
  id: number | string;
  full_name: string;
  email: string;
}

interface AuthContextType {
  user: VisaUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (
    fullName: string,
    email: string,
    password: string,
    phone?: string
  ) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
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
          SecureStore.getItemAsync(USER_KEY),
        ]);
        if (token && storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login: AuthContextType["login"] = async (email, password) => {
    const result = await api.login(email, password);
    if (result.success && result.token) {
      await api.setToken(result.token);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(result.user));
      setUser(result.user);
      return { success: true };
    }
    return { success: false, message: result.message || "Login failed" };
  };

  const register: AuthContextType["register"] = async (fullName, email, password, phone) => {
    const result = await api.register(fullName, email, password, phone);
    return { success: !!result.success, message: result.message };
  };

  const logout = async () => {
    await api.clearToken();
    await SecureStore.deleteItemAsync(USER_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
