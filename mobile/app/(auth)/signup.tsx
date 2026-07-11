import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();

  async function handleSignup() {
    if (!email || !password) return;
    if (password.length < 6) {
      Alert.alert('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password);
      Alert.alert('Account created', 'Check your email to confirm your account, then sign in.');
      router.replace('/(auth)/login');
    } catch (e: any) {
      Alert.alert('Sign up failed', e.message);
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
        <Text style={styles.tagline}>Create your account</Text>

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
          placeholder="Password (min 6 characters)"
          placeholderTextColor="#6B7280"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity style={styles.btn} onPress={handleSignup} disabled={loading}>
          <Text style={styles.btnText}>{loading ? 'Creating account…' : 'Create Account'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.link}>Already have an account? <Text style={styles.linkAccent}>Sign In</Text></Text>
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
});
