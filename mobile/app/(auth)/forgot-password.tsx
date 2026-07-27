import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { requestPasswordReset } = useAuth();
  const router = useRouter();

  async function submit() {
    if (!email.trim()) return;
    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      Alert.alert('Check your email', 'Open the Task AI recovery link on this device to choose a new password.');
      router.replace('/(auth)/login');
    } catch (error: any) {
      Alert.alert('Reset request failed', error?.message || 'Try again later.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.inner}>
        <Text style={styles.title}>Reset your password</Text>
        <Text style={styles.help}>We’ll email a secure link that opens Task AI.</Text>
        <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="Email" placeholderTextColor="#6B7280" value={email} onChangeText={setEmail} />
        <TouchableOpacity style={styles.button} onPress={submit} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Sending…' : 'Send recovery link'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/(auth)/login')}><Text style={styles.link}>Back to sign in</Text></TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginBottom: 8 },
  help: { color: '#9CA3AF', lineHeight: 20, marginBottom: 24 },
  input: { backgroundColor: '#1A1A1A', borderRadius: 12, borderWidth: 1, borderColor: '#2A2A2A', color: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 14, marginBottom: 14 },
  button: { backgroundColor: '#F97316', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  buttonText: { color: '#0A0A0A', fontWeight: '700' },
  link: { color: '#F97316', textAlign: 'center', marginTop: 22 },
});
