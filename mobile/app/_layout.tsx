import 'react-native-url-polyfill/auto';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { navigationTarget } from '@/services/navigation';

SplashScreen.preventAutoHideAsync();

function NavigationGuard() {
  const { session, loading, recoveryMode } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    SplashScreen.hideAsync();

    const target = navigationTarget({
      loading,
      hasSession: Boolean(session),
      inAuthGroup: segments[0] === '(auth)',
      recoveryMode,
    });
    if (target) router.replace(target);
  }, [session, loading, recoveryMode, segments, router]);

  return null;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <NavigationGuard />
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0A0A' } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="guided" />
      </Stack>
    </AuthProvider>
  );
}
