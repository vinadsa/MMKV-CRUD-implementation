// src/storage/mmkvUser.ts
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV();
const USER_KEY = 'user';

export type StoredUser = {
  uid: string;
  email: string | null;
};

export function saveUser(user: StoredUser) {
  try {
    storage.set(USER_KEY, JSON.stringify(user));
  } catch (e) {
    console.warn('Gagal menyimpan user ke MMKV', e);
  }
}

export function getStoredUser(): StoredUser | null {
  try {
    const json = storage.getString(USER_KEY);
    if (!json) return null;
    return JSON.parse(json) as StoredUser;
  } catch (e) {
    console.warn('Gagal membaca user dari MMKV', e);
    return null;
  }
}

export function clearUser() {
  try {
    storage.remove(USER_KEY);
  } catch (e) {
    console.warn('Gagal menghapus user dari MMKV', e);
  }
}