// app/_layout.tsx
import { Stack } from 'expo-router';
import { AuthProvider } from '/Users/indramec/ReactNative/login/src/storage/AuthContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}