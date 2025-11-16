// src/context/AuthContext.tsx
import React, { createContext, useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User as FirebaseUser,
} from "firebase/auth";
import { auth } from "../firebaseConfig";
import {
  saveUser,
  getStoredUser,
  clearUser,
  StoredUser,
} from "../storage/mmkvUser";
import {
  saveCredentials,
  getStoredCredentials,
  clearCredentials,
} from "../storage/mmkvCredentials";

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
          const cred = await signInWithEmailAndPassword(
            auth,
            creds.email,
            creds.password
          );
          const firebaseUser = cred.user;
          const data: StoredUser = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
          };
          setUser(data);
          saveUser(data); // refresh data user di MMKV
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
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser: FirebaseUser = cred.user;

    const data: StoredUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
    };

    setUser(data);
    saveUser(data); // simpan info user di MMKV
    saveCredentials({ email, password }); // simpan kredensial di MMKV
  };

  const register = async (email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser: FirebaseUser = cred.user;

    const data: StoredUser = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
    };

    setUser(data);
    saveUser(data);
    saveCredentials({ email, password });
  };

  const logout = async () => {
    await signOut(auth);
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