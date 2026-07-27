import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Login failed', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>task.ai</Text>
        <Text style={styles.tagline}>Home repair intelligence</Text>
        <Text style={styles.accountNotice}>
          An account is required to protect repair photos, run diagnosis, and save jobs securely.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#6B7280"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#6B7280"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
          <Text style={styles.btnText}>{loading ? 'Signing in…' : 'Sign In'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
          <Text style={styles.link}>Don't have an account? <Text style={styles.linkAccent}>Sign Up</Text></Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
          <Text style={styles.forgot}>Forgot password?</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  logo: { fontSize: 40, fontWeight: '800', color: '#F97316', marginBottom: 6 },
  tagline: { fontSize: 15, color: '#6B7280', marginBottom: 40 },
  accountNotice: { color: '#9CA3AF', fontSize: 13, lineHeight: 19, marginTop: -24, marginBottom: 24 },
  input: {
    backgroundColor: '#1A1A1A', borderRadius: 12, paddingHorizontal: 16,
    paddingVertical: 14, fontSize: 15, color: '#FFFFFF', marginBottom: 14,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  btn: {
    backgroundColor: '#F97316', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 6, marginBottom: 20,
  },
  btnText: { color: '#0A0A0A', fontWeight: '700', fontSize: 16 },
  link: { textAlign: 'center', color: '#6B7280', fontSize: 14 },
  linkAccent: { color: '#F97316', fontWeight: '600' },
  forgot: { textAlign: 'center', color: '#F97316', fontSize: 13, marginTop: 20 },
});
