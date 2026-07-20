import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { AnalyseResult, RepairState, inpaintImage } from '@/services/api';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const router = useRouter();
  const [inpaintUrl, setInpaintUrl] = useState<string | null>(null);
  const [inpainting, setInpainting] = useState(false);
  const [showInpaint, setShowInpaint] = useState(false);
  const [inpaintError, setInpaintError] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const assessment = result.diy_assessment;
  const ackKey = `taskai:precaution:${assessment?.validation_version || 'unknown'}:${assessment?.policy_source?.policy_version || 'unknown'}:${assessment?.assessed_at || 'unknown'}`;
  const completeLevel = assessment?.assessment_status === 'complete' ? assessment.safety_level : null;
  const instructionsAllowed = completeLevel === 1 || (completeLevel === 2 && acknowledged);

  useEffect(() => { AsyncStorage.getItem(ackKey).then((value) => setAcknowledged(value === 'true')); }, [ackKey]);
  async function acknowledge(){await AsyncStorage.setItem(ackKey,'true');setAcknowledged(true)}

  async function handleInpaint() {
    if (inpaintUrl) { setShowInpaint(true); return; }
    setInpainting(true);
    setInpaintError(null);
    try {
      const res = await inpaintImage(result.inpaint_prompt);
      setInpaintUrl(res.repaired_image_url);
      setShowInpaint(true);
    } catch (error: any) {
      setInpaintError(error?.message || 'Could not generate the illustrative preview. Try again.');
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

      {assessment && (
        <View style={styles.eligibility}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eligibilityTitle}>DIY eligibility · {assessment.jurisdiction || 'State required'}</Text>
            <Text style={styles.eligibilityStatus}>
              {completeLevel == null ? assessment.assessment_status.replace(/_/g, ' ') : `Level ${completeLevel} — ${['','Safe for DIY','DIY with caution','Professional required','Emergency'][completeLevel]}`}
            </Text>
            <Text style={styles.eligibilityReason}>{assessment.reason}</Text>
            <Text style={styles.eligibilityReason}>Legal: {assessment.legal_status || 'not available'} · Safety: {assessment.safety_status || 'not available'}</Text>
            {assessment.warning_signs?.map((item) => <Text key={item} style={styles.reassessment}>Stop condition: {item}</Text>)}
            {assessment.allowed_actions?.map((item) => <Text key={item} style={styles.eligibilityReason}>Allowed: {item}</Text>)}
            {assessment.prohibited_actions?.map((item) => <Text key={item} style={styles.reassessment}>Do not: {item}</Text>)}
            {completeLevel === 2 && !acknowledged && <TouchableOpacity onPress={acknowledge} style={styles.ackButton}><Text style={styles.ackText}>Acknowledge precautions</Text></TouchableOpacity>}
            {completeLevel === 2 && acknowledged && <Text style={styles.eligibilityReason}>✓ Precautions acknowledged for this version</Text>}
            {(completeLevel === 3 || completeLevel === 4 || completeLevel == null) && <Text style={styles.reassessment}>Guided repair is locked.</Text>}
            {result.requires_reassessment && <Text style={styles.reassessment}>State changed — reassess before using instructions.</Text>}
          </View>
          <TouchableOpacity accessibilityLabel="Change state or territory" onPress={() => router.push('/(tabs)/settings')}>
            <Text style={styles.changeState}>Change</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Stats row */}
      <View style={styles.statsRow}>
        <Stat label="Difficulty" value={result.difficulty} />
        <Stat label="Time" value={`${result.estimated_time_hours}h`} />
        <Stat label="Cost" value={`$${result.estimated_cost_aud_min}–$${result.estimated_cost_aud_max}`} />
      </View>

      {/* Repair State Engine — before/after */}
      {instructionsAllowed && result.repair_state && (
        <RepairStatePanel state={result.repair_state} />
      )}

      {/* Root cause */}
      <Section title="Root Cause">
        <Text style={styles.body}>{result.root_cause}</Text>
        {result.is_structural && (
          <Text style={styles.structuralWarning}>⚠️ Structural — consider a licensed tradesperson</Text>
        )}
      </Section>

      {/* Steps */}
      {instructionsAllowed && <Section title="Repair Steps">
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
      </Section>}

      {/* Materials */}
      {instructionsAllowed && <Section title="Materials">
        {result.materials.map((m, i) => (
          <View key={i} style={styles.materialRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.materialName}>{m.name}</Text>
              {m.purpose && <Text style={styles.materialPurpose}>{m.purpose}</Text>}
            </View>
            <Text style={styles.materialCost}>${m.estimated_cost_aud}</Text>
          </View>
        ))}
      </Section>}

      {/* Safety */}
      {result.safety_notes.length > 0 && (
        <Section title="Safety">
          {result.safety_notes.map((n, i) => (
            <Text key={i} style={styles.safetyItem}>• {n}</Text>
          ))}
        </Section>
      )}

      {/* Tools */}
      {instructionsAllowed && <Section title="Tools Required">
        <Text style={styles.body}>{result.tools_required.join(' · ')}</Text>
      </Section>}

      {/* When to call pro */}
      <Section title="When to Call a Professional">
        <Text style={styles.body}>{result.when_to_call_professional}</Text>
      </Section>

      {/* Inpaint preview */}
      {instructionsAllowed && <TouchableOpacity style={styles.inpaintBtn} onPress={handleInpaint} disabled={inpainting}>
        {inpainting ? (
          <ActivityIndicator color="#0A0A0A" />
        ) : (
          <Text style={styles.inpaintBtnText}>{inpaintError ? 'Try preview again' : 'See illustrative repaired preview'}</Text>
        )}
      </TouchableOpacity>}
      {instructionsAllowed && result.steps.length > 0 && <TouchableOpacity style={styles.guideBtn} onPress={() => router.push({ pathname: '/guided', params: { result: JSON.stringify(result) } })}><Text style={styles.guideText}>Start guided repair</Text></TouchableOpacity>}
      {instructionsAllowed && inpaintError && <Text style={styles.previewError}>{inpaintError}</Text>}

      {instructionsAllowed && showInpaint && inpaintUrl && (
        <View style={styles.inpaintContainer}>
          <Text style={styles.inpaintLabel}>Illustrative AI preview — not a guarantee of repair outcome</Text>
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

function RepairStatePanel({ state }: { state: RepairState }) {
  const [expanded, setExpanded] = useState(false);
  const damageList = state.before.damage_types;

  return (
    <View style={rsStyles.container}>
      <TouchableOpacity style={rsStyles.header} onPress={() => setExpanded((v) => !v)}>
        <View>
          <Text style={rsStyles.engineLabel}>Repair State Engine</Text>
          <Text style={rsStyles.confidence}>Prompt confidence {state.prompt_confidence}%</Text>
        </View>
        <Text style={rsStyles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {/* Always-visible before → after strip */}
      <View style={rsStyles.strip}>
        <View style={rsStyles.stripSide}>
          <Text style={rsStyles.stripLabel}>BEFORE</Text>
          <Text style={rsStyles.stripMaterial}>
            {[state.before.colour, state.before.finish, state.before.material]
              .filter(Boolean).join(' ')}
          </Text>
          {damageList.length > 0 && (
            <View style={rsStyles.tags}>
              {damageList.map((d) => (
                <View key={d} style={[rsStyles.tag, rsStyles.tagBefore]}>
                  <Text style={rsStyles.tagText}>{d.replace('_', ' ')}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <Text style={rsStyles.arrow}>→</Text>

        <View style={rsStyles.stripSide}>
          <Text style={rsStyles.stripLabel}>AFTER</Text>
          <Text style={rsStyles.stripMaterial}>
            {[state.after.colour, state.after.finish, state.after.material]
              .filter(Boolean).join(' ')}
          </Text>
          <View style={rsStyles.tags}>
            <View style={[rsStyles.tag, rsStyles.tagAfter]}>
              <Text style={rsStyles.tagText}>repaired ✓</Text>
            </View>
          </View>
        </View>
      </View>

      {expanded && (
        <View style={rsStyles.detail}>
          <Text style={rsStyles.detailLabel}>Surface profile</Text>
          <Text style={rsStyles.detailValue}>{state.after.texture_profile}</Text>
          <Text style={rsStyles.detailLabel}>Lighting model</Text>
          <Text style={rsStyles.detailValue}>{state.after.light_profile}</Text>
          {Object.entries(state.after.resolutions).map(([dmg, res]) => (
            <View key={dmg} style={rsStyles.resolutionRow}>
              <Text style={rsStyles.resolutionDmg}>{dmg.replace('_', ' ')}</Text>
              <Text style={rsStyles.resolutionDesc}>{res}</Text>
            </View>
          ))}
          <Text style={rsStyles.detailLabel}>Inpaint prompt</Text>
          <Text style={rsStyles.promptText}>{state.inpaint_prompt}</Text>
        </View>
      )}
    </View>
  );
}

const rsStyles = StyleSheet.create({
  container: { marginHorizontal: 20, marginBottom: 20, backgroundColor: '#111827', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#1F2937' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  engineLabel: { fontSize: 12, fontWeight: '700', color: '#F97316', letterSpacing: 0.8, textTransform: 'uppercase' },
  confidence: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  chevron: { color: '#4B5563', fontSize: 14 },
  strip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 14, gap: 8 },
  stripSide: { flex: 1 },
  stripLabel: { fontSize: 9, fontWeight: '700', color: '#4B5563', letterSpacing: 1, marginBottom: 4 },
  stripMaterial: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', marginBottom: 6, textTransform: 'capitalize' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tag: { borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 },
  tagBefore: { backgroundColor: '#EF444420' },
  tagAfter: { backgroundColor: '#22C55E20' },
  tagText: { fontSize: 11, color: '#D1D5DB' },
  arrow: { color: '#F97316', fontSize: 20, fontWeight: '700' },
  detail: { padding: 14, paddingTop: 0, gap: 6 },
  detailLabel: { fontSize: 10, fontWeight: '700', color: '#4B5563', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 8 },
  detailValue: { fontSize: 13, color: '#9CA3AF', lineHeight: 19 },
  resolutionRow: { backgroundColor: '#1F2937', borderRadius: 8, padding: 10, marginTop: 4 },
  resolutionDmg: { fontSize: 11, fontWeight: '700', color: '#F97316', textTransform: 'capitalize', marginBottom: 2 },
  resolutionDesc: { fontSize: 12, color: '#9CA3AF', lineHeight: 18 },
  promptText: { fontSize: 11, color: '#6B7280', lineHeight: 18, fontStyle: 'italic', marginTop: 2 },
});

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
  eligibility: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#92400E', backgroundColor: '#1C1917' },
  ackButton: { minHeight: 44, marginTop: 12, borderRadius: 10, backgroundColor: '#F28B45', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  ackText: { color: '#102F36', fontWeight: '800', fontSize: 13 },
  eligibilityTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  eligibilityStatus: { color: '#F97316', fontSize: 12, marginTop: 3, textTransform: 'capitalize' },
  eligibilityReason: { color: '#9CA3AF', fontSize: 12, lineHeight: 17, marginTop: 6 },
  reassessment: { color: '#FBBF24', fontSize: 12, marginTop: 6 },
  changeState: { color: '#F97316', fontSize: 12, fontWeight: '700', paddingLeft: 10 },
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
  guideBtn: { minHeight: 48, marginHorizontal: 20, backgroundColor: '#EAF0DF', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  guideText: { color: '#102F36', fontSize: 15, fontWeight: '800' },
  inpaintBtnText: { fontSize: 15, fontWeight: '700', color: '#0A0A0A' },
  inpaintContainer: { marginHorizontal: 20, marginBottom: 16 },
  inpaintLabel: { fontSize: 13, color: '#9CA3AF', marginBottom: 10 },
  previewError: { marginHorizontal: 20, marginBottom: 12, color: '#FCA5A5', fontSize: 13 },
  inpaintImage: { width: '100%', height: 240, borderRadius: 12 },
  hideText: { color: '#6B7280', fontSize: 13, marginTop: 8, textAlign: 'center' },
});
