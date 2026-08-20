// app/chat/[bookingNumber].tsx
// Per-booking chat with HeyDream staff, mirroring the "Chat with HeyDream"
// button on visa/profile.php's booking cards. Talks to
// visa/api/booking-chat.php, which just got bearer-token support added
// (was session-only) -- same customer_conversations/customer_messages
// tables the website itself reads, so a message sent here shows up in the
// admin panel and vice versa in real time (poll-based, no websocket).

import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors } from "@/constants/theme";
import * as api from "@/api/client";
import { useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ChatMessage {
  id: number;
  sender_type: "Customer" | "Admin" | "Staff" | "Partner";
  sender_name: string;
  message: string;
  formatted_time: string;
  is_own: boolean;
}

const POLL_INTERVAL_MS = 5000;

export default function BookingChatScreen() {
  const { bookingNumber } = useLocalSearchParams<{ bookingNumber: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    const result = await api.openBookingChat(String(bookingNumber));
    if (result.success) {
      setMessages(result.messages || []);
      setErrorMessage(null);
    } else {
      setErrorMessage(result.message || "Unable to load this conversation.");
    }
  }, [bookingNumber]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await load();
      setIsLoading(false);
    })();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text || isSending) return;
    setIsSending(true);
    setDraft("");
    const result = await api.sendBookingChatMessage(String(bookingNumber), text);
    setIsSending(false);
    if (result.success) {
      await load();
    } else {
      setDraft(text);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <StatusBar style="light" />
      <ScreenHeader title="Chat with HeyDream" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={90}
      >
        {isLoading ? (
          <ActivityIndicator style={styles.loading} color={Colors.primary} />
        ) : errorMessage ? (
          <View style={styles.centered}>
            <Ionicons name="alert-circle-outline" size={36} color="#B00020" />
            <ThemedText style={styles.errorText}>{errorMessage}</ThemedText>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.scrollContent}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {messages.length === 0 ? (
              <View style={styles.centered}>
                <Ionicons name="chatbubbles-outline" size={36} color={Colors.text} />
                <ThemedText style={styles.emptyText}>
                  Send a message about booking {bookingNumber} and our team will reply here.
                </ThemedText>
              </View>
            ) : (
              messages.map((m) => (
                <View
                  key={m.id}
                  style={[styles.bubbleRow, m.is_own ? styles.bubbleRowOwn : styles.bubbleRowOther]}
                >
                  <View style={[styles.bubble, m.is_own ? styles.bubbleOwn : styles.bubbleOther]}>
                    {!m.is_own && <ThemedText style={styles.senderName}>{m.sender_name}</ThemedText>}
                    <ThemedText style={[styles.bubbleText, m.is_own && styles.bubbleTextOwn]}>
                      {m.message}
                    </ThemedText>
                    <ThemedText style={[styles.bubbleTime, m.is_own && styles.bubbleTimeOwn]}>
                      {m.formatted_time}
                    </ThemedText>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#94a3b8"
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <Pressable style={styles.sendButton} onPress={send} disabled={isSending || !draft.trim()}>
            {isSending ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Ionicons name="send" size={18} color={Colors.white} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { marginTop: 60 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  errorText: { color: "#B00020", textAlign: "center" },
  emptyText: { color: Colors.text, textAlign: "center", lineHeight: 20 },
  scrollContent: { padding: 16, flexGrow: 1 },
  bubbleRow: { flexDirection: "row", marginBottom: 10 },
  bubbleRowOwn: { justifyContent: "flex-end" },
  bubbleRowOther: { justifyContent: "flex-start" },
  bubble: { maxWidth: "80%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleOwn: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: Colors.white, borderBottomLeftRadius: 4 },
  senderName: { fontSize: 11, fontWeight: "700", color: Colors.gold, marginBottom: 2 },
  bubbleText: { color: Colors.dark, fontSize: 14.5, lineHeight: 20 },
  bubbleTextOwn: { color: Colors.white },
  bubbleTime: { color: Colors.text, fontSize: 10, marginTop: 4, alignSelf: "flex-end" },
  bubbleTimeOwn: { color: "rgba(255,255,255,0.7)" },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
    backgroundColor: Colors.white,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    color: Colors.dark,
    fontSize: 14.5,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
