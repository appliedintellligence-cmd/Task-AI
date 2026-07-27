import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, SafeAreaView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { sendChat, Material } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import ChatBubble from '@/components/ChatBubble';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  materials?: Material[];
}

export default function ChatScreen() {
  const { user, token, jurisdiction } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatId, setChatId] = useState<string | undefined>();
  const listRef = useRef<FlatList>(null);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    if (!jurisdiction) {
      Alert.alert('State or territory required', 'Choose your jurisdiction before requesting repair advice.', [
        { text: 'Choose state', onPress: () => router.push('/(tabs)/settings') },
      ]);
      return;
    }

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await sendChat(text, chatId, token ?? undefined, jurisdiction);
      setChatId(res.chat_id);
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.reply,
        materials: res.materials,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e: any) {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Sorry, I couldn't connect. Please try again.",
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setSending(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [input, chatId, user, token, jurisdiction, sending]);

  function newChat() {
    setMessages([]);
    setChatId(undefined);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Chat</Text>
        {messages.length > 0 && (
          <TouchableOpacity onPress={newChat}>
            <Text style={styles.newChat}>New Chat</Text>
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>Ask the Repair Assistant</Text>
            <Text style={styles.emptySubtitle}>
              Ask about any home repair — tiles, plumbing, painting, timber, and more
            </Text>
            {['How do I fix a cracked tile?', 'What causes rising damp?', 'How to patch a hole in plaster?'].map((q) => (
              <TouchableOpacity key={q} style={styles.suggestionChip} onPress={() => setInput(q)}>
                <Text style={styles.suggestionText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => (
              <View>
                <ChatBubble role={item.role} content={item.content} />
                {item.materials && item.materials.length > 0 && (
                  <View style={styles.materialsChips}>
                    {item.materials.map((m: Material, i: number) => (
                      <View key={i} style={styles.chip}>
                        <Text style={styles.chipText}>{m.name}</Text>
                        {m.estimated_cost_aud ? (
                          <Text style={styles.chipCost}>${m.estimated_cost_aud}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
            contentContainerStyle={{ paddingVertical: 12 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {sending && (
          <View style={styles.typingIndicator}>
            <ActivityIndicator size="small" color="#F97316" />
            <Text style={styles.typingText}>task.ai is thinking…</Text>
          </View>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask about any home repair…"
            placeholderTextColor="#4B5563"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={send}
            blurOnSubmit={false}
          />
          <TouchableOpacity style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]} onPress={send} disabled={!input.trim() || sending}>
            <Text style={styles.sendBtnText}>↑</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  newChat: { color: '#F97316', fontWeight: '600', fontSize: 15 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  suggestionChip: {
    backgroundColor: '#1A1A1A', borderRadius: 20, paddingHorizontal: 16,
    paddingVertical: 10, marginBottom: 10, borderWidth: 1, borderColor: '#2A2A2A',
  },
  suggestionText: { color: '#D1D5DB', fontSize: 14 },
  typingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  typingText: { color: '#6B7280', fontSize: 13 },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: '#1A1A1A',
  },
  input: {
    flex: 1, backgroundColor: '#1A1A1A', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 15,
    color: '#FFFFFF', maxHeight: 120, borderWidth: 1, borderColor: '#2A2A2A',
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#2A2A2A' },
  sendBtnText: { color: '#0A0A0A', fontWeight: '700', fontSize: 20 },
  materialsChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, marginBottom: 4 },
  chip: {
    backgroundColor: '#1A1A1A', borderRadius: 8, paddingHorizontal: 10,
    paddingVertical: 6, flexDirection: 'row', gap: 6, borderWidth: 1, borderColor: '#2A2A2A',
  },
  chipText: { color: '#D1D5DB', fontSize: 12 },
  chipCost: { color: '#F97316', fontSize: 12, fontWeight: '600' },
});
