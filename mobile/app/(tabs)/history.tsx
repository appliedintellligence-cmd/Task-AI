import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, TouchableOpacity,
  ActivityIndicator, SafeAreaView, RefreshControl, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getJobs, Job } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import RepairCard from '@/components/RepairCard';

const SEVERITY_COLOR = { low: '#22C55E', medium: '#F59E0B', high: '#EF4444' };

export default function HistoryScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const fetchJobs = useCallback(async (isRefresh = false) => {
    if (!user || !token) return;
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const data = await getJobs(user.id, token);
      setJobs(data);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, token]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  if (!user) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.title}>History</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔒</Text>
          <Text style={styles.emptyTitle}>Sign in to view history</Text>
          <Text style={styles.emptySubtitle}>
            Create a free account to save and revisit your repair analyses
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.primaryBtnText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(auth)/signup')}>
            <Text style={styles.secondaryBtnText}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.count}>{jobs.length} analyses</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F97316" />
        </View>
      ) : jobs.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>No saved analyses yet</Text>
          <Text style={styles.emptySubtitle}>
            Analyse a repair and tap "Save Analysis" to see it here
          </Text>
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(j) => j.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchJobs(true)}
              tintColor="#F97316"
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => setSelectedJob(item)}>
              <View style={styles.cardLeft}>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.thumbnail} />
                ) : (
                  <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                    <Text style={styles.thumbnailIcon}>🔧</Text>
                  </View>
                )}
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.jobProblem} numberOfLines={2}>{item.result.problem}</Text>
                <Text style={styles.jobMaterial}>{item.result.surface_material}</Text>
                <View style={styles.jobMeta}>
                  <View style={[styles.severityDot, { backgroundColor: SEVERITY_COLOR[item.result.severity] }]} />
                  <Text style={styles.jobMetaText}>{item.result.severity}</Text>
                  <Text style={styles.jobMetaDivider}>·</Text>
                  <Text style={styles.jobMetaText}>{item.result.difficulty}</Text>
                  <Text style={styles.jobMetaDivider}>·</Text>
                  <Text style={styles.jobMetaText}>
                    ${item.result.estimated_cost_aud_min}–${item.result.estimated_cost_aud_max}
                  </Text>
                </View>
                <Text style={styles.jobDate}>
                  {new Date(item.created_at).toLocaleDateString('en-AU', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Detail modal */}
      <Modal visible={!!selectedJob} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelectedJob(null)}>
              <Text style={styles.modalClose}>✕ Close</Text>
            </TouchableOpacity>
          </View>
          {selectedJob && (
            <RepairCard result={selectedJob.result} imageUri={selectedJob.image_url} />
          )}
        </SafeAreaView>
      </Modal>
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
  title: { fontSize: 22, fontWeight: '800', color: '#F97316' },
  count: { fontSize: 13, color: '#6B7280' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  primaryBtn: {
    backgroundColor: '#F97316', borderRadius: 12, paddingVertical: 14,
    paddingHorizontal: 32, alignItems: 'center', width: '100%', marginBottom: 12,
  },
  primaryBtnText: { color: '#0A0A0A', fontWeight: '700', fontSize: 16 },
  secondaryBtn: {
    backgroundColor: '#1A1A1A', borderRadius: 12, paddingVertical: 14,
    paddingHorizontal: 32, alignItems: 'center', width: '100%',
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  secondaryBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  card: {
    backgroundColor: '#1A1A1A', borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  cardLeft: {},
  thumbnail: { width: 64, height: 64, borderRadius: 10 },
  thumbnailPlaceholder: { backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' },
  thumbnailIcon: { fontSize: 28 },
  cardBody: { flex: 1, gap: 3 },
  jobProblem: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', lineHeight: 21 },
  jobMaterial: { fontSize: 13, color: '#6B7280' },
  jobMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  severityDot: { width: 7, height: 7, borderRadius: 4 },
  jobMetaText: { fontSize: 12, color: '#9CA3AF', textTransform: 'capitalize' },
  jobMetaDivider: { color: '#4B5563', fontSize: 12 },
  jobDate: { fontSize: 11, color: '#4B5563', marginTop: 2 },
  chevron: { color: '#4B5563', fontSize: 22 },
  modal: { flex: 1, backgroundColor: '#0A0A0A' },
  modalHeader: {
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  modalClose: { color: '#F97316', fontWeight: '600', fontSize: 16 },
});
