import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function HomeScreen() {
  const router = useRouter();
  const { jurisdiction } = useAuth();
  return <SafeAreaView style={styles.safe}><View style={styles.content}><Text style={styles.eyebrow}>TASK AI</Text><Text style={styles.title}>Repair with confidence.</Text><Text style={styles.body}>Photograph the problem, check DIY eligibility and follow guidance that respects your state or territory.</Text><TouchableOpacity accessibilityRole="button" style={styles.cta} onPress={() => router.push('/(tabs)')}><Text style={styles.ctaText}>Scan a repair</Text></TouchableOpacity><View style={styles.card}><Text style={styles.cardLabel}>CURRENT JURISDICTION</Text><Text style={styles.cardValue}>{jurisdiction || 'Choose in Profile'}</Text></View></View></SafeAreaView>;
}
const styles = StyleSheet.create({ safe:{flex:1,backgroundColor:'#F7F3E9'},content:{padding:24,paddingTop:48},eyebrow:{color:'#B95320',fontSize:12,fontWeight:'800',letterSpacing:2},title:{color:'#102F36',fontSize:38,lineHeight:44,fontWeight:'900',marginTop:10},body:{color:'#52676A',fontSize:17,lineHeight:26,marginTop:16},cta:{minHeight:52,backgroundColor:'#F28B45',borderRadius:16,alignItems:'center',justifyContent:'center',marginTop:30},ctaText:{color:'#102F36',fontSize:17,fontWeight:'800'},card:{marginTop:28,backgroundColor:'#EAF0DF',borderRadius:18,padding:18},cardLabel:{color:'#607166',fontSize:11,fontWeight:'800',letterSpacing:1},cardValue:{color:'#102F36',fontSize:20,fontWeight:'800',marginTop:6} });
