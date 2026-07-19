import React, { useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { JURISDICTIONS, JURISDICTION_LABELS, Jurisdiction } from '@/constants/jurisdiction';
import { useAuth } from '@/context/AuthContext';

export default function SettingsScreen() {
  const { jurisdiction, updateJurisdiction } = useAuth();
  const [selected, setSelected] = useState<Jurisdiction | null>(jurisdiction);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!selected) {
      Alert.alert('Select a state or territory');
      return;
    }
    setSaving(true);
    try {
      await updateJurisdiction(selected);
      Alert.alert('Saved', 'Future diagnoses will use this jurisdiction. Historical assessments are unchanged.');
    } catch (error: any) {
      Alert.alert('Could not save', error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.label}>State or territory</Text>
        <Text style={styles.help}>
          Australian DIY licensing rules vary by jurisdiction. Task AI does not use GPS, infer your location, or collect a precise address.
        </Text>
        <View style={styles.options} accessibilityLabel="Australian state or territory">
          {JURISDICTIONS.map((code) => (
            <TouchableOpacity
              key={code}
              accessibilityRole="radio"
              accessibilityLabel={JURISDICTION_LABELS[code]}
              accessibilityState={{ selected: selected === code }}
              style={[styles.option, selected === code && styles.selected]}
              onPress={() => setSelected(code)}
            >
              <Text style={[styles.code, selected === code && styles.selectedText]}>{code}</Text>
              <Text style={[styles.name, selected === code && styles.selectedText]}>{JURISDICTION_LABELS[code]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[styles.save, saving && styles.disabled]} onPress={save} disabled={saving || selected === jurisdiction}>
          <Text style={styles.saveText}>{saving ? 'Saving…' : jurisdiction ? 'Change state or territory' : 'Save state or territory'}</Text>
        </TouchableOpacity>
        {jurisdiction && <Text style={styles.current}>Current selection: {jurisdiction}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0A0A' },
  container: { flex: 1, padding: 24 },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginBottom: 32 },
  label: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', marginBottom: 6 },
  help: { color: '#9CA3AF', fontSize: 14, lineHeight: 20, marginBottom: 18 },
  options: { gap: 8 },
  option: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 10, padding: 13, backgroundColor: '#151515' },
  selected: { borderColor: '#F97316', backgroundColor: '#431407' },
  code: { width: 46, color: '#F97316', fontWeight: '800' },
  name: { color: '#D1D5DB', fontSize: 14 },
  selectedText: { color: '#FFFFFF' },
  save: { marginTop: 22, backgroundColor: '#F97316', borderRadius: 12, padding: 15, alignItems: 'center' },
  disabled: { opacity: 0.5 },
  saveText: { color: '#0A0A0A', fontWeight: '800' },
  current: { color: '#9CA3AF', textAlign: 'center', marginTop: 12 },
});
