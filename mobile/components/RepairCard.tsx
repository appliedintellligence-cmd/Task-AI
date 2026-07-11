import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { AnalyseResult, inpaintImage } from '@/services/api';

const SEVERITY_COLOR = { low: '#22C55E', medium: '#F59E0B', high: '#EF4444' };
const PHASE_LABEL: Record<string, string> = {
  preparation: 'Preparation',
  tools_required: 'Tools',
  products_needed: 'Products',
  how_to_fix: 'Repair',
  post_fix: 'Post-Fix',
};

interface Props {
  result: AnalyseResult;
  imageUri?: string;
}

export default function RepairCard({ result, imageUri }: Props) {
  const [inpaintUrl, setInpaintUrl] = useState<string | null>(null);
  const [inpainting, setInpainting] = useState(false);
  const [showInpaint, setShowInpaint] = useState(false);

  async function handleInpaint() {
    if (inpaintUrl) { setShowInpaint(true); return; }
    setInpainting(true);
    try {
      const res = await inpaintImage(result.inpaint_prompt);
      setInpaintUrl(res.repaired_image_url);
      setShowInpaint(true);
    } catch {
      // silently ignore — user can retry
    } finally {
      setInpainting(false);
    }
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.severityBadge, { backgroundColor: SEVERITY_COLOR[result.severity] + '22' }]}>
          <Text style={[styles.severityText, { color: SEVERITY_COLOR[result.severity] }]}>
            {result.severity.toUpperCase()}
          </Text>
        </View>
        <Text style={styles.problem}>{result.problem}</Text>
        <Text style={styles.material}>{result.surface_material}</Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <Stat label="Difficulty" value={result.difficulty} />
        <Stat label="Time" value={`${result.estimated_time_hours}h`} />
        <Stat label="Cost" value={`$${result.estimated_cost_aud_min}–$${result.estimated_cost_aud_max}`} />
        <Stat label="Confidence" value={`${result.confidence}%`} />
      </View>

      {/* Root cause */}
      <Section title="Root Cause">
        <Text style={styles.body}>{result.root_cause}</Text>
        {result.is_structural && (
          <Text style={styles.structuralWarning}>⚠️ Structural — consider a licensed tradesperson</Text>
        )}
      </Section>

      {/* Steps */}
      <Section title="Repair Steps">
        {result.steps.map((step) => (
          <View key={step.step_number} style={styles.step}>
            <View style={styles.stepHeader}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{step.step_number}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepPhase}>{PHASE_LABEL[step.phase] ?? step.phase}</Text>
                <Text style={styles.stepTitle}>{step.title}</Text>
              </View>
              <Text style={styles.stepDuration}>{step.duration_minutes}m</Text>
            </View>
            <Text style={styles.stepDesc}>{step.description}</Text>
            {step.pro_tip && (
              <Text style={styles.proTip}>💡 {step.pro_tip}</Text>
            )}
            {step.safety_note && (
              <Text style={styles.safetyNote}>⚠️ {step.safety_note}</Text>
            )}
          </View>
        ))}
      </Section>

      {/* Materials */}
      <Section title="Materials">
        {result.materials.map((m, i) => (
          <View key={i} style={styles.materialRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.materialName}>{m.name}</Text>
              {m.purpose && <Text style={styles.materialPurpose}>{m.purpose}</Text>}
            </View>
            <Text style={styles.materialCost}>${m.estimated_cost_aud}</Text>
          </View>
        ))}
      </Section>

      {/* Safety */}
      {result.safety_notes.length > 0 && (
        <Section title="Safety">
          {result.safety_notes.map((n, i) => (
            <Text key={i} style={styles.safetyItem}>• {n}</Text>
          ))}
        </Section>
      )}

      {/* Tools */}
      <Section title="Tools Required">
        <Text style={styles.body}>{result.tools_required.join(' · ')}</Text>
      </Section>

      {/* When to call pro */}
      <Section title="When to Call a Professional">
        <Text style={styles.body}>{result.when_to_call_professional}</Text>
      </Section>

      {/* Inpaint preview */}
      <TouchableOpacity style={styles.inpaintBtn} onPress={handleInpaint} disabled={inpainting}>
        {inpainting ? (
          <ActivityIndicator color="#0A0A0A" />
        ) : (
          <Text style={styles.inpaintBtnText}>✨ See Repaired Preview</Text>
        )}
      </TouchableOpacity>

      {showInpaint && inpaintUrl && (
        <View style={styles.inpaintContainer}>
          <Text style={styles.inpaintLabel}>AI-Generated Repair Preview</Text>
          <Image source={{ uri: inpaintUrl }} style={styles.inpaintImage} resizeMode="cover" />
          <TouchableOpacity onPress={() => setShowInpaint(false)}>
            <Text style={styles.hideText}>Hide</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  header: { padding: 20, paddingTop: 8 },
  severityBadge: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 },
  severityText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  problem: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  material: { fontSize: 14, color: '#9CA3AF' },
  statsRow: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 8, backgroundColor: '#1A1A1A', borderRadius: 12, padding: 16 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 14, fontWeight: '700', color: '#F97316', marginBottom: 2 },
  statLabel: { fontSize: 11, color: '#6B7280' },
  section: { marginHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#F97316', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 },
  body: { fontSize: 14, color: '#D1D5DB', lineHeight: 22 },
  structuralWarning: { fontSize: 13, color: '#EF4444', marginTop: 8, fontWeight: '600' },
  step: { backgroundColor: '#1A1A1A', borderRadius: 10, padding: 14, marginBottom: 10 },
  stepHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, gap: 10 },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#000', fontWeight: '700', fontSize: 13 },
  stepPhase: { fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 },
  stepTitle: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  stepDuration: { fontSize: 12, color: '#6B7280' },
  stepDesc: { fontSize: 14, color: '#D1D5DB', lineHeight: 21 },
  proTip: { fontSize: 13, color: '#34D399', marginTop: 8, lineHeight: 20 },
  safetyNote: { fontSize: 13, color: '#FBBF24', marginTop: 6, lineHeight: 20 },
  materialRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1F1F1F' },
  materialName: { fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  materialPurpose: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  materialCost: { fontSize: 14, color: '#F97316', fontWeight: '600' },
  safetyItem: { fontSize: 14, color: '#FBBF24', lineHeight: 24 },
  inpaintBtn: { marginHorizontal: 20, backgroundColor: '#F97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 16 },
  inpaintBtnText: { fontSize: 15, fontWeight: '700', color: '#0A0A0A' },
  inpaintContainer: { marginHorizontal: 20, marginBottom: 16 },
  inpaintLabel: { fontSize: 13, color: '#9CA3AF', marginBottom: 10 },
  inpaintImage: { width: '100%', height: 240, borderRadius: 12 },
  hideText: { color: '#6B7280', fontSize: 13, marginTop: 8, textAlign: 'center' },
});
