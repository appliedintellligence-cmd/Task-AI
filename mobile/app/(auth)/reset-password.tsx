import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const { updatePassword, authLinkError, clearRecoveryMode } = useAuth();
  const router = useRouter();

  async function submit() {
    if (password.length < 8) return Alert.alert('Password must be at least 8 characters');
    if (password !== confirmation) return Alert.alert('Passwords do not match');
    setLoading(true);
    try {
      await updatePassword(password);
      Alert.alert('Password updated', 'Your new password is ready to use.');
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Password update failed', error?.message || 'Request a new recovery link.');
    } finally {
      setLoading(false);
    }
  }

  function cancel() {
    clearRecoveryMode();
    router.replace('/(auth)/login');
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.inner}>
        <Text style={styles.title}>Choose a new password</Text>
        {authLinkError && <Text style={styles.error}>{authLinkError}</Text>}
        <TextInput style={styles.input} secureTextEntry autoComplete="new-password" placeholder="New password" placeholderTextColor="#6B7280" value={password} onChangeText={setPassword} />
        <TextInput style={styles.input} secureTextEntry autoComplete="new-password" placeholder="Confirm password" placeholderTextColor="#6B7280" value={confirmation} onChangeText={setConfirmation} />
        <TouchableOpacity style={styles.button} onPress={submit} disabled={loading || Boolean(authLinkError)}><Text style={styles.buttonText}>{loading ? 'Updating…' : 'Update password'}</Text></TouchableOpacity>
        <TouchableOpacity onPress={cancel}><Text style={styles.link}>Back to sign in</Text></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginBottom: 24 },
  error: { color: '#FCA5A5', lineHeight: 20, marginBottom: 16 },
  input: { backgroundColor: '#1A1A1A', borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A', color: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 14, marginBottom: 14 },
  button: { backgroundColor: '#F97316', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  buttonText: { color: '#0A0A0A', fontWeight: '700' },
  link: { color: '#F97316', textAlign: 'center', marginTop: 22 },
});
