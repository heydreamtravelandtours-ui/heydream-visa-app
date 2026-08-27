// components/chat-assistant.tsx
// Floating in-app help assistant, mounted once in app/_layout.tsx so it
// rides on top of every screen the same way chatbot_widget.php's bubble
// does on the website. Deliberately has NO text input: the user only ever
// taps curated question chips (constants/assistant-knowledge.ts), so the
// assistant can't be handed a question it wasn't built to answer. The one
// networked path is "Talk to a live agent", which reuses the website's
// ai_chat.php / get_chat_updates.php session + reply-polling so an agent
// picks it up in the same admin panel list as a website chat.

import { ThemedText } from "@/components/themed-text";
import { VISA_WEB_BASE_URL } from "@/api/config";
import * as api from "@/api/client";
import { useAuth } from "@/contexts/auth-context";
import * as secureStorage from "@/api/secure-storage";
import {
  STARTER_TOPIC_IDS,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
  TOPICS_BY_ID,
  type AssistantAnswer,
} from "@/constants/assistant-knowledge";
import { Colors } from "@/constants/theme";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { usePathname, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SESSION_KEY = "heydream_visa_assistant_session";
const POLL_MS = 4000;

// Screens where a floating helper would get in the way (a bubble sitting on
// top of form fields), duplicate an existing chat surface, or sit over the
// auth flow. Mirrors chatbot_widget.php bailing out on the website's
// ?id=/booking pages.
const HIDDEN_PREFIXES = [
  "/login",
  "/register",
  "/oauthredirect",
  "/chat/",
  "/apply/",
  "/documents/",
  "/visa/",
  "/support",
  "/edit-profile",
  "/change-password",
];
const TAB_PATHS = ["/", "/applications", "/profile"];

type ChipTone = "default" | "agent" | "reset";
interface Chip {
  key: string;
  label: string;
  tone?: ChipTone;
  onPress: () => void;
}

type Message =
  | { id: string; kind: "bot"; text: string; answer?: AssistantAnswer }
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "agent"; text: string }
  | { id: string; kind: "note"; text: string };

let msgSeq = 0;
const nextId = () => `m${Date.now()}_${msgSeq++}`;

function htmlToText(s?: string): string {
  if (!s) return "";
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function ChatAssistant() {
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chips, setChips] = useState<Chip[]>([]);
  const [agentMode, setAgentMode] = useState(false);
  const [agentJoined, setAgentJoined] = useState(false);
  const [busy, setBusy] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const sessionRef = useRef<string | null>(null);
  const lastAgentIdRef = useRef(0);
  const agentJoinedRef = useRef(false);
  const anim = useRef(new Animated.Value(0)).current;

  const hidden = useMemo(
    () => !pathname || HIDDEN_PREFIXES.some((p) => pathname.startsWith(p)),
    [pathname]
  );
  const onTab = pathname ? TAB_PATHS.includes(pathname) : false;
  const bubbleBottom = onTab
    ? (Platform.OS === "ios" ? 96 + insets.bottom : 80 + insets.bottom)
    : insets.bottom + 22;

  const firstName = user?.full_name ? user.full_name.trim().split(/\s+/)[0] : "";

  useEffect(() => {
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    if (!open) setMenuOpen(false);
  }, [open, anim]);

  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [messages, chips]);

  // ---------- helpers (plain closures -- always see current state) ----------
  const pushBot = (text: string, answer?: AssistantAnswer) =>
    setMessages((prev) => [...prev, { id: nextId(), kind: "bot", text, answer }]);
  const pushUser = (text: string) =>
    setMessages((prev) => [...prev, { id: nextId(), kind: "user", text }]);
  const pushNote = (text: string) =>
    setMessages((prev) => [...prev, { id: nextId(), kind: "note", text }]);

  async function ensureSession() {
    if (sessionRef.current) return sessionRef.current;
    let s = await secureStorage.getItem(SESSION_KEY);
    if (!s) {
      s = `hd_visaapp_${Math.random().toString(36).slice(2, 11)}_${Date.now()}`;
      await secureStorage.setItem(SESSION_KEY, s);
    }
    sessionRef.current = s;
    return s;
  }

  function topicChips(ids: string[]): Chip[] {
    const list: Chip[] = ids
      .map((id) => TOPICS_BY_ID[id])
      .filter(Boolean)
      .map((t) => ({ key: t.id, label: t.question, onPress: () => handleTopic(t.id) }));
    if (!ids.includes("live-agent")) {
      list.push({ key: "live-agent", label: "Talk to a live agent", tone: "agent", onPress: startLiveAgent });
    }
    list.push({ key: "reset", label: "Back to start", tone: "reset", onPress: backToStart });
    return list;
  }

  function backToStart() {
    setAgentMode(false);
    pushBot(firstName ? `Anything else I can help with, ${firstName}?` : "What else can I help you with?");
    setChips(topicChips(STARTER_TOPIC_IDS));
  }

  function handleTopic(id: string) {
    const topic = TOPICS_BY_ID[id];
    if (!topic) return;
    pushUser(topic.question);
    pushBot(topic.answer.body, topic.answer);
    setChips(topicChips(topic.answer.followUps ?? STARTER_TOPIC_IDS));
  }

  function greet() {
    if (started) return;
    setStarted(true);
    pushBot(
      `Hi${firstName ? ` ${firstName}` : ""}! I'm the HeyDream Visa assistant. Pick a question below and I'll walk you through it.`
    );
    setChips(topicChips(STARTER_TOPIC_IDS));
  }

  function openPanel() {
    setOpen(true);
    if (!started) setTimeout(greet, 260);
  }

  // ---------- live agent (networked) ----------
  function applyBackendReply(reply?: string, suggestions?: string[]) {
    const text = htmlToText(reply);
    if (text) pushBot(text);

    const netChips: Chip[] = (suggestions ?? []).map((s, i) => ({
      key: `net_${i}_${s}`,
      label: s,
      onPress: () => sendToBackend(s),
    }));

    if (/phone number/i.test(reply ?? "")) {
      const phone = (user?.phone ?? "").trim();
      if (phone) {
        netChips.unshift({
          key: "phone_confirm",
          label: `Call me at ${phone}`,
          tone: "agent",
          onPress: () =>
            sendToBackend(`${phone.replace(/\s+/g, "")} - Live agent requested from the HeyDream Visa app`),
        });
      } else {
        pushNote(
          `Add your phone number in Profile → Edit Profile so an agent can call you, or reach us now at ${SUPPORT_PHONE}.`
        );
      }
    }

    netChips.push({ key: "agent_done", label: "Back to questions", tone: "reset", onPress: backToStart });
    setChips(netChips);
  }

  function agentUnreachable(retry: () => void) {
    pushBot(
      `I couldn't reach an agent just now. Please call ${SUPPORT_PHONE} or email ${SUPPORT_EMAIL}, or use Contact Support from your Profile.`
    );
    setChips([
      { key: "retry", label: "Try again", tone: "agent", onPress: retry },
      { key: "reset", label: "Back to start", tone: "reset", onPress: backToStart },
    ]);
  }

  async function sendToBackend(message: string) {
    if (busy) return;
    setBusy(true);
    pushUser(message);
    setChips([]);
    const session = await ensureSession();
    const res = await api.sendAssistantMessage({
      message,
      session_id: session,
      customer_name: user?.full_name || "HeyDream Visa app user",
      customer_email: user?.email || "",
    });
    setBusy(false);
    if (!res || (!res.reply && !res.suggestions)) {
      agentUnreachable(() => sendToBackend(message));
      return;
    }
    applyBackendReply(res.reply, res.suggestions);
  }

  async function startLiveAgent() {
    if (busy) return;
    setMenuOpen(false);
    setAgentMode(true);
    setAgentJoined(false);
    agentJoinedRef.current = false;
    pushUser("I'd like to talk to a live agent");
    setChips([]);
    setBusy(true);
    const session = await ensureSession();
    // Anchor polling past anything already logged on a reused session id so
    // only replies from here on surface.
    const init = await api.getAssistantUpdates(session, 0);
    lastAgentIdRef.current = init.messages.reduce((max, m) => Math.max(max, m.id), 0);
    const res = await api.sendAssistantMessage({
      message: "[REQUEST_LIVE_AGENT]",
      session_id: session,
      customer_name: user?.full_name || "HeyDream Visa app user",
      customer_email: user?.email || "",
    });
    setBusy(false);
    if (!res || (!res.reply && !res.suggestions)) {
      agentUnreachable(startLiveAgent);
      return;
    }
    applyBackendReply(res.reply, res.suggestions);
  }

  // Poll for agent replies while the panel is open and a handoff is active.
  useEffect(() => {
    if (!open || !agentMode) return;
    let cancelled = false;

    const markJoined = () => {
      if (!agentJoinedRef.current) {
        agentJoinedRef.current = true;
        setAgentJoined(true);
        setMessages((prev) => [...prev, { id: nextId(), kind: "note", text: "A live agent has joined the chat." }]);
      }
    };

    const tick = async () => {
      const session = sessionRef.current;
      if (!session) return;
      const { messages: updates, deleted } = await api.getAssistantUpdates(session, lastAgentIdRef.current);
      if (cancelled) return;
      if (deleted) {
        setAgentMode(false);
        setMessages((prev) => [
          ...prev,
          { id: nextId(), kind: "note", text: "This support session was closed. Start again any time." },
        ]);
        setChips([{ key: "reset", label: "Back to start", tone: "reset", onPress: backToStart }]);
        return;
      }
      for (const m of updates) {
        lastAgentIdRef.current = Math.max(lastAgentIdRef.current, m.id);
        if (m.sender === "customer") continue;
        if (m.message === "[AGENT_JOINED]") {
          markJoined();
          continue;
        }
        if (m.sender === "admin") {
          markJoined();
          setMessages((prev) => [
            ...prev,
            { id: `agent_${m.id}`, kind: "agent", text: htmlToText(m.message) },
          ]);
        }
      }
    };

    const iv = setInterval(tick, POLL_MS);
    tick();
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, agentMode]);

  // ---------- menu actions ----------
  async function visitWebsite() {
    setMenuOpen(false);
    try {
      await WebBrowser.openBrowserAsync(VISA_WEB_BASE_URL);
    } catch {
      Linking.openURL(VISA_WEB_BASE_URL).catch(() => {});
    }
  }
  function reportIssue() {
    setMenuOpen(false);
    setOpen(false);
    router.push("/support");
  }

  if (hidden) return null;

  const panelTranslate = anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {open && (
        <Animated.View
          style={[
            styles.panel,
            {
              top: insets.top + 44,
              bottom: bubbleBottom + 74,
              opacity: anim,
              transform: [{ translateY: panelTranslate }],
            },
          ]}
        >
          <LinearGradient
            colors={[Colors.primary, "#1667d6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.headerAvatar}>
              <Image
                source={require("@/assets/images/heydream-logo.png")}
                style={styles.headerAvatarImg}
                contentFit="contain"
              />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.headerTitle}>HeyDream Help</ThemedText>
              <View style={styles.headerStatusRow}>
                <View style={styles.onlineDot} />
                <ThemedText style={styles.headerStatus}>
                  {agentMode
                    ? agentJoined
                      ? "Agent connected"
                      : "Connecting you to an agent…"
                    : "Online"}
                </ThemedText>
              </View>
            </View>
            <Pressable style={styles.headerBtn} onPress={() => setMenuOpen((v) => !v)} hitSlop={8}>
              <Ionicons name={menuOpen ? "close" : "menu"} size={18} color={Colors.white} />
            </Pressable>
            <Pressable style={styles.headerBtn} onPress={() => setOpen(false)} hitSlop={8}>
              <Ionicons name="chevron-down" size={20} color={Colors.white} />
            </Pressable>
          </LinearGradient>

          {menuOpen && (
            <View style={styles.menu}>
              <MenuItem icon="headset" label="Live Agents" onPress={startLiveAgent} />
              <MenuItem icon="globe-outline" label="Visit Our Website" onPress={visitWebsite} />
              <MenuItem icon="alert-circle-outline" label="Report Issue" onPress={reportIssue} />
            </View>
          )}

          <ScrollView
            ref={scrollRef}
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((m) => {
              if (m.kind === "note") {
                return (
                  <View key={m.id} style={styles.noteRow}>
                    <ThemedText style={styles.noteText}>{m.text}</ThemedText>
                  </View>
                );
              }
              if (m.kind === "user") {
                return (
                  <View key={m.id} style={[styles.bubbleRow, styles.bubbleRowRight]}>
                    <View style={[styles.bubble, styles.bubbleUser]}>
                      <ThemedText style={styles.bubbleUserText}>{m.text}</ThemedText>
                    </View>
                  </View>
                );
              }
              const isAgent = m.kind === "agent";
              return (
                <View key={m.id} style={[styles.bubbleRow, styles.bubbleRowLeft]}>
                  <View style={[styles.bubble, isAgent ? styles.bubbleAgent : styles.bubbleBot]}>
                    {isAgent && <ThemedText style={styles.agentName}>Agent</ThemedText>}
                    <ThemedText style={styles.bubbleBotText}>{m.text}</ThemedText>
                    {m.kind === "bot" && m.answer?.link && (
                      <Pressable
                        style={styles.answerAction}
                        onPress={() => WebBrowser.openBrowserAsync(m.answer!.link!.url)}
                      >
                        <Ionicons name="open-outline" size={14} color={Colors.primary} />
                        <ThemedText style={styles.answerActionText}>{m.answer.link.label}</ThemedText>
                      </Pressable>
                    )}
                    {m.kind === "bot" && m.answer?.route && (
                      <Pressable
                        style={styles.answerAction}
                        onPress={() => {
                          setOpen(false);
                          router.push(m.answer!.route!.path as any);
                        }}
                      >
                        <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
                        <ThemedText style={styles.answerActionText}>{m.answer.route.label}</ThemedText>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}

            {busy && (
              <View style={[styles.bubbleRow, styles.bubbleRowLeft]}>
                <View style={[styles.bubble, styles.bubbleBot]}>
                  <ThemedText style={styles.bubbleBotText}>…</ThemedText>
                </View>
              </View>
            )}

            {chips.length > 0 && (
              <View style={styles.chipWrap}>
                {chips.map((c) => (
                  <Pressable
                    key={c.key}
                    style={[
                      styles.chip,
                      c.tone === "agent" && styles.chipAgent,
                      c.tone === "reset" && styles.chipReset,
                    ]}
                    onPress={c.onPress}
                    disabled={busy}
                  >
                    {c.tone === "agent" && (
                      <Ionicons name="headset" size={12} color={Colors.primary} style={{ marginRight: 5 }} />
                    )}
                    <ThemedText style={[styles.chipText, c.tone === "reset" && styles.chipResetText]}>
                      {c.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <ThemedText style={styles.footerText}>Tap a question — no typing needed</ThemedText>
          </View>
        </Animated.View>
      )}

      <Pressable
        style={[styles.fab, { bottom: bubbleBottom, right: 18 }]}
        onPress={() => (open ? setOpen(false) : openPanel())}
      >
        {open ? (
          <Ionicons name="close" size={26} color={Colors.primary} />
        ) : (
          <Image
            source={require("@/assets/images/heydream-logo.png")}
            style={styles.fabLogo}
            contentFit="contain"
          />
        )}
        {!open && !started && <View style={styles.fabBadge} />}
      </Pressable>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={17} color={Colors.primary} />
      <ThemedText style={styles.menuItemText}>{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    left: 12,
    right: 12,
    backgroundColor: Colors.white,
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
    padding: 5,
  },
  headerAvatarImg: { width: "100%", height: "100%" },
  headerTitle: { color: Colors.white, fontSize: 15, fontWeight: "800" },
  headerStatusRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#4ade80" },
  headerStatus: { color: "rgba(255,255,255,0.85)", fontSize: 11 },
  headerBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  menu: {
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: "#E7EDF5",
    padding: 10,
    gap: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  menuItemPressed: { backgroundColor: "#F0F6FF" },
  menuItemText: { fontSize: 13.5, fontWeight: "700", color: Colors.dark },
  body: { flex: 1, backgroundColor: "#F4F7FB" },
  bodyContent: { padding: 14, paddingBottom: 8 },
  bubbleRow: { flexDirection: "row", marginBottom: 10, maxWidth: "100%" },
  bubbleRowLeft: { justifyContent: "flex-start" },
  bubbleRowRight: { justifyContent: "flex-end" },
  bubble: { maxWidth: "86%", borderRadius: 16, paddingHorizontal: 13, paddingVertical: 10 },
  bubbleBot: {
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 4,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  bubbleAgent: {
    backgroundColor: "#E8F0FE",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(13,71,161,0.14)",
  },
  bubbleUser: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
  bubbleBotText: { color: Colors.dark, fontSize: 13.5, lineHeight: 20 },
  bubbleUserText: { color: Colors.white, fontSize: 13.5, lineHeight: 20 },
  agentName: { color: Colors.primary, fontSize: 11, fontWeight: "800", marginBottom: 3 },
  answerAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 9,
    alignSelf: "flex-start",
    backgroundColor: "#EEF4FF",
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  answerActionText: { color: Colors.primary, fontSize: 12, fontWeight: "700" },
  noteRow: { alignItems: "center", marginVertical: 8, paddingHorizontal: 12 },
  noteText: {
    fontSize: 11.5,
    color: Colors.text,
    textAlign: "center",
    backgroundColor: "#EEF2F7",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: "hidden",
    lineHeight: 16,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4, paddingBottom: 4 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { color: Colors.primary, fontSize: 12.5, fontWeight: "700" },
  chipAgent: { backgroundColor: "#FFF7E6", borderColor: Colors.accent },
  chipReset: { borderColor: "#CBD5E1", backgroundColor: "#F8FAFC" },
  chipResetText: { color: Colors.text },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#E7EDF5",
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: Colors.white,
  },
  footerText: { fontSize: 10.5, color: "#94A3B8", fontWeight: "600" },
  fab: {
    position: "absolute",
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.white,
    borderWidth: 3,
    borderColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  fabLogo: { width: 34, height: 34 },
  fabBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.white,
  },
});
