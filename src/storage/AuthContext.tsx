// src/context/AuthContext.tsx
import React, { createContext, useEffect, useState } from "react";
import {
  loginUser as loginUserService,
  logoutUser as logoutUserService,
  registerUser as registerUserService,
} from "../services/firebaseService";
import { clearCredentials, getStoredCredentials } from "../storage/mmkvCredentials";
import { clearUser, getStoredUser, StoredUser } from "../storage/mmkvUser";

type AuthContextType = {
  user: StoredUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Auto-login saat app dibuka
  useEffect(() => {
    const init = async () => {
      try {
        // 1. kalau user sudah ada di MMKV, set dulu (biar UI cepat)
        const storedUser = getStoredUser();
        if (storedUser) {
          setUser(storedUser);
        }

        // 2. coba auto-login kalau ada email+password yang tersimpan
        const creds = getStoredCredentials();
        if (creds) {
          const result = await loginUserService(creds.email, creds.password);
          if (result.success && result.user) {
            setUser(result.user);
          } else {
            clearCredentials();
            clearUser();
            setUser(null);
          }
        }
      } catch (e) {
        console.warn("Auto login gagal, hapus kredensial", e);
        clearCredentials();
        clearUser();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const login = async (email: string, password: string) => {
    const result = await loginUserService(email, password);
    if (!result.success || !result.user) {
      throw new Error(result.error || "Login gagal");
    }
    setUser(result.user);
  };

  const register = async (email: string, password: string) => {
    const result = await registerUserService(email, password);
    if (!result.success || !result.user) {
      throw new Error(result.error || "Registrasi gagal");
    }
    setUser(result.user);
  };

  const logout = async () => {
    await logoutUserService();
    setUser(null);
    clearUser();
    clearCredentials();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};