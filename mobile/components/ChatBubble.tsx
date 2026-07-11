import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatBubble({ role, content }: Props) {
  const isUser = role === 'user';
  return (
    <View style={[styles.row, isUser && styles.rowUser]}>
      {!isUser && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>AI</Text>
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={[styles.text, isUser && styles.textUser]}>{content}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginVertical: 6, marginHorizontal: 16, gap: 8 },
  rowUser: { justifyContent: 'flex-end' },
  avatar: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  avatarText: { color: '#000', fontWeight: '700', fontSize: 11 },
  bubble: { maxWidth: '80%', borderRadius: 16, padding: 12 },
  bubbleUser: { backgroundColor: '#F97316', borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: '#1A1A1A', borderBottomLeftRadius: 4 },
  text: { fontSize: 14, color: '#FFFFFF', lineHeight: 21 },
  textUser: { color: '#0A0A0A' },
});
