import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, ScrollView, Alert, SafeAreaView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { analyseImage, saveJob, AnalyseResult } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import RepairCard from '@/components/RepairCard';

type State = 'idle' | 'picked' | 'analysing' | 'result' | 'error';
const ANALYSIS_STAGES = ['Checking image quality', 'Identifying the affected area', 'Assessing hazards', 'Checking DIY eligibility', 'Preparing the result'];

export default function AnalyseScreen() {
  const { user, token, jurisdiction } = useAuth();
  const router = useRouter();
  const previousJurisdiction = useRef(jurisdiction);
  const submitting = useRef(false);
  const [state, setState] = useState<State>('idle');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyseResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [analysisStage, setAnalysisStage] = useState(0);

  useEffect(() => {
    if (state !== 'analysing') return;
    const timer = setInterval(() => setAnalysisStage((value) => Math.min(value + 1, ANALYSIS_STAGES.length - 1)), 1100);
    return () => clearInterval(timer);
  }, [state]);

  useEffect(() => {
    if (previousJurisdiction.current && jurisdiction && previousJurisdiction.current !== jurisdiction && result) {
      setResult({
        ...result,
        steps: [], materials: [], tools_required: [], inpaint_prompt: '',
        requires_reassessment: true,
        diy_assessment: result.diy_assessment ? {
          ...result.diy_assessment,
          safety_level: null,
          assessment_status: 'assessment_pending',
          reason: 'Your profile jurisdiction changed. Reassess this repair before using instructions.',
        } : result.diy_assessment,
      });
      setSaved(false);
    }
    previousJurisdiction.current = jurisdiction;
  }, [jurisdiction]);

  async function pickImage(fromCamera: boolean) {
    const picker = fromCamera
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync;

    const res = await picker({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: false,
    });

    if (!res.canceled && res.assets[0]) {
      const asset = res.assets[0];
      if (asset.fileSize && asset.fileSize > 12 * 1024 * 1024) {
        Alert.alert('Photo too large', 'Choose a photo smaller than 12 MB.');
        return;
      }
      setImageUri(res.assets[0].uri);
      setResult(null);
      setSaved(false);
      setState('picked');
    }
  }

  async function handleAnalyse() {
    if (!imageUri || submitting.current) return;
    if (!jurisdiction) {
      Alert.alert(
        'State or territory required',
        'Choose your state or territory before diagnosis so the correct DIY rules can be applied.',
        [{ text: 'Choose state', onPress: () => router.push('/(tabs)/settings') }],
      );
      return;
    }
    submitting.current = true;
    setAnalysisStage(0);
    setState('analysing');
    try {
      const r = await analyseImage(imageUri, 'repair.jpg', jurisdiction);
      setResult(r);
      setState('result');
    } catch (e: any) {
      setErrorMsg(e.message || 'Analysis failed. Try a clearer photo.');
      setState('error');
    } finally {
      submitting.current = false;
    }
  }

  async function handleSave() {
    if (result?.requires_reassessment) {
      Alert.alert('Reassessment required', 'Run the diagnosis again using your current state or territory before saving.');
      return;
    }
    if (!result || !user || !token) {
      Alert.alert('Sign in to save analyses');
      return;
    }
    setSaving(true);
    try {
      await saveJob(result.image_url ?? imageUri ?? null, result, token);
      setSaved(true);
    } catch (e: any) {
      Alert.alert('Save failed', e.message);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setImageUri(null);
    setResult(null);
    setSaved(false);
    setState('idle');
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>task.ai</Text>
        {state !== 'idle' && (
          <TouchableOpacity onPress={reset}>
            <Text style={styles.resetText}>New</Text>
          </TouchableOpacity>
        )}
      </View>

      {state === 'idle' && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔧</Text>
          <Text style={styles.emptyTitle}>Not sure how to fix it? Take a photo.</Text>
          <Text style={styles.emptySubtitle}>
            We’ll assess visible hazards and check DIY eligibility for {jurisdiction || 'your jurisdiction'}.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => pickImage(true)}>
            <Text style={styles.primaryBtnText}>📷  Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => pickImage(false)}>
            <Text style={styles.secondaryBtnText}>🖼  Choose from Library</Text>
          </TouchableOpacity>
        </View>
      )}

      {(state === 'picked' || state === 'error') && imageUri && (
        <View style={styles.pickedContainer}>
          <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
          {state === 'error' && (
            <Text style={styles.errorText}>{errorMsg}</Text>
          )}
          <TouchableOpacity style={styles.primaryBtn} onPress={handleAnalyse}>
            <Text style={styles.primaryBtnText}>Analyse Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => pickImage(false)}>
            <Text style={styles.secondaryBtnText}>Choose Different Photo</Text>
          </TouchableOpacity>
        </View>
      )}

      {state === 'analysing' && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F97316" />
          <Text accessibilityLiveRegion="polite" style={styles.loadingTitle}>{ANALYSIS_STAGES[analysisStage]}…</Text>
          {ANALYSIS_STAGES.map((item, index) => <Text key={item} style={styles.loadingSubtitle}>{index < analysisStage ? '✓' : index === analysisStage ? '●' : '○'} {item}</Text>)}
        </View>
      )}

      {state === 'result' && result && (
        <View style={{ flex: 1 }}>
          {/* Save button */}
          <View style={styles.saveRow}>
            {imageUri && (
              <Image source={{ uri: imageUri }} style={styles.thumbNail} />
            )}
            <TouchableOpacity
              style={[styles.saveBtn, saved && styles.saveBtnDone]}
              onPress={handleSave}
              disabled={saving || saved || result.requires_reassessment}
            >
              {saving ? (
                <ActivityIndicator color="#0A0A0A" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>{saved ? '✓ Saved' : 'Save Analysis'}</Text>
              )}
            </TouchableOpacity>
          </View>
          <RepairCard result={result} imageUri={imageUri ?? undefined} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0A0A' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  logo: { fontSize: 22, fontWeight: '800', color: '#F97316' },
  resetText: { color: '#F97316', fontWeight: '600', fontSize: 15 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyIcon: { fontSize: 56, marginBottom: 20 },
  emptyTitle: { fontSize: 24, fontWeight: '700', color: '#FFFFFF', marginBottom: 10, textAlign: 'center' },
  emptySubtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 23, marginBottom: 36 },
  primaryBtn: {
    backgroundColor: '#F97316', borderRadius: 12, paddingVertical: 15,
    paddingHorizontal: 32, alignItems: 'center', width: '100%', marginBottom: 12,
  },
  primaryBtnText: { color: '#0A0A0A', fontWeight: '700', fontSize: 16 },
  secondaryBtn: {
    backgroundColor: '#1A1A1A', borderRadius: 12, paddingVertical: 15,
    paddingHorizontal: 32, alignItems: 'center', width: '100%',
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  secondaryBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  pickedContainer: { flex: 1, padding: 20, gap: 12 },
  preview: { width: '100%', height: 240, borderRadius: 14, marginBottom: 4 },
  errorText: { color: '#EF4444', fontSize: 14, marginBottom: 4 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loadingTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  loadingSubtitle: { fontSize: 14, color: '#6B7280' },
  saveRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 10, gap: 12, borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  thumbNail: { width: 44, height: 44, borderRadius: 8 },
  saveBtn: {
    flex: 1, backgroundColor: '#1A1A1A', borderRadius: 10, paddingVertical: 10,
    alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A',
  },
  saveBtnDone: { backgroundColor: '#14532D', borderColor: '#22C55E' },
  saveBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
});
