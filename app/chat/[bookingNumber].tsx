// app/chat/[bookingNumber].tsx
// Per-booking chat with HeyDream staff, mirroring the "Chat with HeyDream"
// button on visa/profile.php's booking cards. `booking-chat.php` opens the
// thread (and hands back its conversation id); polling + the typing
// indicator then run through api/chat_sync.php -- the same incremental
// endpoint admin/messages.php uses -- so a "HeyDream is typing…" shows both
// ways and new agent replies land without a full reload.

import { ScreenHeader } from "@/components/screen-header";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { TypingDots } from "@/components/typing-dots";
import { Colors } from "@/constants/theme";
import * as api from "@/api/client";
import { useAuth } from "@/contexts/auth-context";
import { useLocalSearchParams, useRouter } from "expo-router";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

interface ChatMessage {
  id: number;
  sender_type: "Customer" | "Admin" | "Staff" | "Partner";
  sender_name: string;
  message: string;
  formatted_time: string;
  is_own: boolean;
}

const POLL_INTERVAL_MS = 4000;

// Who the other side is, shown as a small caption above their bubbles.
function roleLabel(senderType: ChatMessage["sender_type"]): string {
  if (senderType === "Partner") return "Partner";
  return "HeyDream Support";
}

export default function BookingChatScreen() {
  const { bookingNumber } = useLocalSearchParams<{ bookingNumber: string }>();
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const convoIdRef = useRef<number | null>(null);
  const lastIdRef = useRef(0);
  const typingSentAtRef = useRef(0);
  const typingClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rememberIds = (list: ChatMessage[]) => {
    lastIdRef.current = list.reduce((max, m) => Math.max(max, m.id), lastIdRef.current);
  };

  const initialLoad = useCallback(async () => {
    const result = await api.openBookingChat(String(bookingNumber));
    if (result.success) {
      const list: ChatMessage[] = result.messages || [];
      setMessages(list);
      rememberIds(list);
      convoIdRef.current = result.convo_id ?? null;
      setErrorMessage(null);
    } else {
      setErrorMessage(result.message || "Unable to load this conversation.");
    }
  }, [bookingNumber]);

  const poll = useCallback(async () => {
    const convoId = convoIdRef.current;
    if (!convoId) return;
    const sync = await api.syncBookingChat(convoId, lastIdRef.current);
    setOtherTyping(!!sync.admin_is_typing || !!sync.partner_is_typing);
    if (sync.messages.length > 0) {
      setMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const merged = [...prev, ...sync.messages.filter((m) => !seen.has(m.id))];
        return merged;
      });
      rememberIds(sync.messages);
    }
  }, []);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user) {
      router.replace("/(auth)/login");
      return;
    }
    (async () => {
      setIsLoading(true);
      await initialLoad();
      setIsLoading(false);
    })();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [initialLoad, poll, user, isAuthLoading, router]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length, otherTyping]);

  const stopTyping = useCallback(() => {
    if (typingClearRef.current) {
      clearTimeout(typingClearRef.current);
      typingClearRef.current = null;
    }
    if (typingSentAtRef.current === 0) return;
    typingSentAtRef.current = 0;
    if (convoIdRef.current) api.setBookingChatTyping(convoIdRef.current, false);
  }, []);

  const signalTyping = useCallback(() => {
    const convoId = convoIdRef.current;
    if (!convoId) return;
    const now = Date.now();
    if (now - typingSentAtRef.current > 2500) {
      typingSentAtRef.current = now;
      api.setBookingChatTyping(convoId, true);
    }
    if (typingClearRef.current) clearTimeout(typingClearRef.current);
    typingClearRef.current = setTimeout(stopTyping, 3500);
  }, [stopTyping]);

  useEffect(() => () => stopTyping(), [stopTyping]);

  const send = async () => {
    const text = draft.trim();
    if (!text || isSending) return;
    setIsSending(true);
    setDraft("");
    stopTyping();
    const result = await api.sendBookingChatMessage(String(bookingNumber), text);
    setIsSending(false);
    if (result.success) {
      await poll();
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
                  {!m.is_own && (
                    <ThemedText
                      style={[styles.senderCaption, m.sender_type === "Partner" && styles.senderCaptionPartner]}
                    >
                      {roleLabel(m.sender_type)}
                    </ThemedText>
                  )}
                  <View style={[styles.bubble, m.is_own ? styles.bubbleOwn : styles.bubbleOther]}>
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

            {otherTyping && (
              <View style={[styles.bubbleRow, styles.bubbleRowOther]}>
                <ThemedText style={styles.senderCaption}>HeyDream Support</ThemedText>
                <View style={[styles.bubble, styles.bubbleOther, styles.typingBubble]}>
                  <TypingDots />
                </View>
              </View>
            )}
          </ScrollView>
        )}

        <View style={[styles.inputRow, { paddingBottom: 12 + insets.bottom }]}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#94a3b8"
            value={draft}
            onChangeText={(t) => {
              setDraft(t);
              if (t.trim()) signalTyping();
            }}
            onBlur={stopTyping}
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
  bubbleRow: { marginBottom: 10, maxWidth: "82%" },
  bubbleRowOwn: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubbleRowOther: { alignSelf: "flex-start", alignItems: "flex-start" },
  senderCaption: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    color: Colors.primary,
    marginBottom: 3,
    marginLeft: 4,
  },
  senderCaptionPartner: { color: Colors.accent },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleOwn: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: Colors.white, borderBottomLeftRadius: 4 },
  typingBubble: { paddingVertical: 12 },
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
