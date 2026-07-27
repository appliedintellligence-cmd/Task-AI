interface NavigationState {
  loading: boolean;
  hasSession: boolean;
  inAuthGroup: boolean;
  recoveryMode: boolean;
}

export function navigationTarget({
  loading,
  hasSession,
  inAuthGroup,
  recoveryMode,
}: NavigationState): '/(auth)/login' | '/(auth)/reset-password' | '/(tabs)' | null {
  if (loading) return null;
  if (recoveryMode) return '/(auth)/reset-password';
  if (!hasSession && !inAuthGroup) return '/(auth)/login';
  if (hasSession && inAuthGroup) return '/(tabs)';
  return null;
}
