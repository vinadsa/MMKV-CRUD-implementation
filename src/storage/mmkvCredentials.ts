// src/storage/mmkvCredentials.ts
import { createMMKV} from "react-native-mmkv";

const storage = createMMKV();
const CREDENTIALS_KEY = "credentials";

export type LoginCredentials = {
  email: string;
  password: string;
};

export function saveCredentials(creds: LoginCredentials) {
  try {
    storage.set(CREDENTIALS_KEY, JSON.stringify(creds));
  } catch (e) {
    console.warn("Gagal menyimpan kredensial ke MMKV", e);
  }
}

export function getStoredCredentials(): LoginCredentials | null {
  try {
    const json = storage.getString(CREDENTIALS_KEY);
    if (!json) return null;
    return JSON.parse(json) as LoginCredentials;
  } catch (e) {
    console.warn("Gagal membaca kredensial dari MMKV", e);
    return null;
  }
}

export function clearCredentials() {
  try {
    storage.remove(CREDENTIALS_KEY);
  } catch (e) {
    console.warn("Gagal menghapus kredensial dari MMKV", e);
  }
}